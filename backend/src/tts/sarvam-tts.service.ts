import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';
import { ConstantsService } from '../common/constants/constants.service';
import { LoggerService } from '../common/logger.service';
import { StreamToClientOptions } from './openai-tts.service';

/** Chat language_code (e.g. en, hi) -> Sarvam BCP-47 target_language_code */
const CHAT_LANGUAGE_TO_SARVAM: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  mr: 'mr-IN',
  pa: 'pa-IN',
  or: 'or-IN',
};

/** One streaming connection, and the utterances waiting to use it in turn. */
interface Line {
  ws: WebSocket | null;
  language: string | null;
  queue: Promise<void>;
}

@Injectable()
export class SarvamTtsService {
  /**
   * One open connection per call. Measured: a connection per sentence was
   * refused with "Rate limit exceeded" within minutes — Sarvam's limiter counts
   * how fast connections open (bulbul:v3 on Starter: 30), not how many are open.
   */
  private readonly lines = new WeakMap<object, Line>();

  constructor(
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Bulbul over Sarvam's streaming socket: the first audio arrives in ~0.2s on
   * an open connection, against 1.5–1.9s for the whole-clip REST call. Audio is
   * raw 16-bit PCM in whole samples, so it goes to the player as it comes.
   */
  async streamToClient(client: any, text: string, options?: StreamToClientOptions): Promise<void> {
    const sarvam = this.constantsService.private.LLM.TTS_CONFIG.SARVAM;
    if (!sarvam.API_KEY) {
      throw new Error('SARVAM_API_KEY is required for TTS provider sarvam');
    }
    const chatLang = options?.languageCode ?? null;
    const languageCode = (chatLang && CHAT_LANGUAGE_TO_SARVAM[chatLang]) || sarvam.DEFAULT_LANGUAGE;
    const line = options?.line ? this.lineFor(options.line) : { ws: null, language: null, queue: Promise.resolve() };

    // A connection speaks one utterance at a time: its audio carries no request id.
    const spoken = line.queue.then(() => this.speak(line, client, text, languageCode));
    line.queue = spoken.catch(() => undefined);
    try {
      await spoken;
      if (options?.emitEnd !== false) {
        client.emit('voice_audio_end');
      }
    } catch (err: any) {
      this.logger.warn({
        message: err?.message ?? String(err),
        serviceName: 'SarvamTtsService',
        actionName: 'streamToClient',
        traces: [{ provider: 'sarvam' }, { model: sarvam.MODEL }],
      });
      throw err;
    } finally {
      if (!options?.line) {
        line.ws?.close();
      }
    }
  }

  private lineFor(key: any): Line {
    const existing = this.lines.get(key);
    if (existing) {
      return existing;
    }
    const line: Line = { ws: null, language: null, queue: Promise.resolve() };
    // Closed with the call, so it stops counting against Sarvam's connection limit.
    key.once?.('disconnect', () => line.ws?.close());
    this.lines.set(key, line);
    return line;
  }

  /** The line's connection, opened or switched to this language as needed. */
  private open(line: Line, languageCode: string): Promise<WebSocket> {
    const sarvam = this.constantsService.private.LLM.TTS_CONFIG.SARVAM;
    const configure = (ws: WebSocket) => {
      ws.send(JSON.stringify({
        type: 'config',
        data: {
          model: sarvam.MODEL,
          language_code: languageCode,
          speaker: sarvam.SPEAKER,
          pace: sarvam.PACE,
          speech_sample_rate: String(sarvam.SPEECH_SAMPLE_RATE),
          output_audio_codec: sarvam.OUTPUT_CODEC,
        },
      }));
      line.language = languageCode;
      return ws;
    };
    const current = line.ws;
    if (current?.readyState === WebSocket.OPEN) {
      return Promise.resolve(line.language === languageCode ? current : configure(current));
    }
    const ws = new WebSocket(`${sarvam.WS_URL}?model=${encodeURIComponent(sarvam.MODEL)}&send_completion_event=true`, {
      headers: { 'Api-Subscription-Key': sarvam.API_KEY },
    });
    line.ws = ws;
    // Sarvam closes a connection left idle for a minute; the next utterance opens another.
    ws.on('close', () => {
      if (line.ws === ws) line.ws = null;
    });
    // Failures surface through close and the utterance's own timer; an 'error'
    // with no listener would take the process down.
    ws.on('error', () => undefined);
    return new Promise((resolve, reject) => {
      ws.once('open', () => resolve(configure(ws)));
      ws.once('error', reject);
    });
  }

  /** Says one utterance on the line, asking once more if no audio came. */
  private async speak(line: Line, client: any, text: string, languageCode: string): Promise<void> {
    const sarvam = this.constantsService.private.LLM.TTS_CONFIG.SARVAM;
    let sentAudio = false;
    const attempt = () => new Promise<void>((resolve, reject) => {
      let ws: WebSocket | null = null;
      const finish = (err?: Error) => {
        clearTimeout(timer);
        ws?.off('message', onMessage);
        ws?.off('close', onClose);
        if (err) reject(err);
        else resolve();
      };
      // A connection that failed mid-utterance could still deliver its audio later, into the next one.
      const fail = (err: Error) => {
        (ws ?? line.ws)?.terminate();
        finish(err);
      };
      const timer = setTimeout(() => fail(new Error(sarvam.NO_AUDIO_ERROR)), sarvam.RESPONSE_TIMEOUT_MS);
      const onMessage = (raw: WebSocket.RawData) => {
        let msg: any;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (msg.type === 'audio') {
          clearTimeout(timer);
          sentAudio = true;
          client.emit('voice_audio_chunk', { delta: msg.data.audio });
        } else if (msg.type === 'event' && msg.data?.event_type === 'final') {
          finish();
        } else if (msg.type === 'error') {
          fail(new Error(msg.data?.message));
        }
      };
      // Closed without its final event: keep what was spoken, or let it be asked again.
      const onClose = () => finish(sentAudio ? undefined : new Error(sarvam.NO_AUDIO_ERROR));
      this.open(line, languageCode).then((opened) => {
        ws = opened;
        ws.on('message', onMessage);
        ws.on('close', onClose);
        ws.send(JSON.stringify({ type: 'text', data: { text } }));
        ws.send(JSON.stringify({ type: 'flush' }));
      }, fail);
    });

    try {
      await attempt();
    } catch (err) {
      // Nothing has reached the caller when no audio came, so it is safe to ask once more.
      if (sentAudio) throw err;
      await new Promise((resolve) => setTimeout(resolve, sarvam.RETRY_DELAY_MS));
      await attempt();
    }
  }
}
