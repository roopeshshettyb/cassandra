import { Injectable } from '@nestjs/common';
import WebSocket from 'ws';
import type { ISttSession, SttSessionFactory, SttSessionOptions } from './stt-session.interface';
import { ConstantsService } from '../common/constants/constants.service';
import { LoggerService } from '../common/logger.service';

/** Sarvam speaks 'auto' or a region-qualified code; everything else is another provider's dialect. */
function isSarvamLanguage(value?: string | null): boolean {
  return typeof value === 'string' && (value === 'auto' || /^[a-z]{2}-[A-Z]{2}$/.test(value));
}

/**
 * Rate conversion for PCM that has to cross a provider boundary.
 *
 * The whole pipeline speaks 24kHz — browser mic, TTS, playback — but not every
 * speech provider does, and a chunk handed over at the wrong rate is not an
 * error, it is a transcript of a chipmunk.
 */

/**
 * A stateful 24k->16k (or any ratio) converter. Stateful matters: the filter
 * and the read position have to carry across chunks, or every 100ms boundary
 * lands a click in the middle of the caller's speech and the words either side
 * of it get lost.
 *
 * Low-passed before decimating, because anything above the new Nyquist does not
 * disappear — it folds back down into the speech as noise.
 */
function createPcmResampler(fromRate: number, toRate: number, cutoffHz: number) {
  const ratio = fromRate / toRate;
  const dt = 1 / fromRate;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = dt / (rc + dt);

  let filtered = 0;
  let previous = 0;
  let phase = 0;

  return (input: Buffer): Buffer => {
    const count = input.length >> 1;
    if (count === 0) {
      return Buffer.alloc(0);
    }

    // One sample of the previous chunk sits at index 0, so a read position that
    // falls between chunks still has both neighbours to interpolate from.
    const samples = new Float32Array(count + 1);
    samples[0] = previous;
    for (let i = 0; i < count; i += 1) {
      filtered += alpha * (input.readInt16LE(i * 2) / 32768 - filtered);
      samples[i + 1] = filtered;
    }

    const out: number[] = [];
    while (phase <= count) {
      const index = Math.floor(phase);
      const fraction = phase - index;
      const value = samples[index] * (1 - fraction) + (samples[index + 1] ?? samples[index]) * fraction;
      out.push(Math.max(-32768, Math.min(32767, Math.round(value * 32768))));
      phase += ratio;
    }
    phase -= count;
    previous = samples[count];

    const buffer = Buffer.alloc(out.length * 2);
    out.forEach((value, i) => buffer.writeInt16LE(value, i * 2));
    return buffer;
  };
}

/**
 * Sarvam realtime STT for the public booking line.
 *
 * Chosen over nova-3 on measured behaviour, not preference. Asked for an email
 * the way people give one here, Deepgram's nova-3 returns the words and Sarvam returns
 * the address: "shrijit at the rate gmail dot com" comes back as
 * "srijit@gmail.com". Same for dates, and it reads Hindi and English without
 * being told which is coming — which removes the choice between the two that
 * the language flag otherwise forces.
 *
 * It does its own endpointing, so utteranceEndMs has nothing to set here; the
 * turn ends when Sarvam says speech ended.
 */
@Injectable()
export class SarvamSttService implements SttSessionFactory {
  constructor(
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
  ) {}

  createSession(options?: SttSessionOptions): ISttSession {
    const logger = this.logger;
    const cfg = this.constantsService.private.LLM.STT_CONFIG.SARVAM;
    const common = this.constantsService.private.LLM.STT_CONFIG.COMMON;
    if (!cfg.API_KEY) {
      throw new Error('SARVAM_API_KEY is required for STT provider sarvam');
    }

    // Keyterms are why the model is v4: proper nouns the model has never seen —
    // this property's name, the caller's own — come back right only when they
    // are listed. Measured on "My name is Shrijit ... Taj Cidade De Goa
    // Horizon": without them v4 hears "Rajit ... Taj Siddade", with them it
    // hears both exactly. The endpoint rejects them on any other model.
    const keyterms = (options?.keyterms ?? []).filter((term) => term.length > 0);

    const query = new URLSearchParams({
      model: cfg.MODEL,
      // 'auto' is the point of choosing this provider: a caller who answers in
      // Hindi is understood without anyone having configured Hindi.
      //
      // A caller-supplied code is only honoured in Sarvam's own spelling
      // ('auto', or a region-qualified 'hi-IN'). A surface configured for
      // Deepgram asks for plain 'en', and passing that through would both be
      // rejected and throw away the detection that is the reason for being here.
      language_code: isSarvamLanguage(options?.language) ? String(options?.language) : cfg.LANGUAGE,
      mode: cfg.MODE,
      encoding: common.ENCODING,
      sample_rate: String(cfg.SAMPLE_RATE),
      /**
       * How long a caller may pause before the turn is treated as finished.
       * Sarvam's own default is 1000ms, which is shorter than an ordinary
       * thinking pause: "I'd like a room for… the twenty sixth" came back as
       * two separate turns, and the agent answered the first half.
       */
      silence_duration_ms: String(options?.utteranceEndMs ?? cfg.SILENCE_DURATION_MS),
    });
    if (keyterms.length > 0) {
      // A JSON array, not a comma-joined string — the endpoint is strict.
      query.set('keyterms', JSON.stringify(keyterms));
    }

    // The pipeline is 24kHz throughout; Sarvam takes 8k or 16k and nothing else.
    const resample = createPcmResampler(common.SAMPLE_RATE, cfg.SAMPLE_RATE, cfg.RESAMPLE_CUTOFF_HZ);

    let transcriptCb: ((text: string, isFinal?: boolean) => void) | null = null;
    let endOfSpeechCb: (() => void) | null = null;
    let destroyed = false;
    // The gateway opens a session when the caller taps the mic and starts
    // sending immediately. Anything spoken before the socket is up is held
    // rather than dropped — that gap is where opening words go missing.
    let pending: string[] = [];
    let socket: WebSocket;
    let retryMs = cfg.RECONNECT_MS;

    const send = (payload: string) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      } else {
        pending.push(payload);
      }
    };

    const connect = () => {
      socket = new WebSocket(`${cfg.WS_URL}?${query.toString()}`, {
        headers: { 'API-SUBSCRIPTION-KEY': cfg.API_KEY },
      });

      socket.on('open', () => {
        retryMs = cfg.RECONNECT_MS;
        for (const payload of pending) {
          socket.send(payload);
        }
        pending = [];
      });

      // A connection refused or dropped is opened again, holding what is said
      // meanwhile. Measured: Sarvam refused a connection opened soon after five
      // others, and a session that kept the refused socket heard nothing more for
      // the rest of the call.
      socket.on('close', () => {
        if (destroyed) return;
        setTimeout(() => !destroyed && connect(), retryMs);
        retryMs = Math.min(retryMs * 2, cfg.RECONNECT_MAX_MS);
      });

      socket.on('message', (raw: Buffer) => {
        if (destroyed) return;
        let message: any;
        try {
          message = JSON.parse(raw.toString());
        } catch {
          return;
        }
        const text = typeof message?.text === 'string' ? message.text.trim() : '';
        if (message?.event === cfg.EVENT_TRANSCRIPT_PARTIAL && text && transcriptCb) {
          transcriptCb(text, false);
        } else if (message?.event === cfg.EVENT_TRANSCRIPT_FINAL && text && transcriptCb) {
          transcriptCb(text, true);
        } else if (message?.event === cfg.EVENT_SPEECH_END && endOfSpeechCb) {
          endOfSpeechCb();
        } else if (message?.event === cfg.EVENT_ERROR) {
          logger.warn({
            message: message?.message ?? 'sarvam stt error',
            serviceName: 'SarvamSttService',
            actionName: 'createSession',
            traces: [{ stage: 'ws', code: message?.code }],
          });
        }
      });

      socket.on('error', (err: any) => {
        if (destroyed) return;
        logger.warn({
          message: err?.message ?? String(err),
          serviceName: 'SarvamSttService',
          actionName: 'createSession',
          traces: [{ stage: 'socket' }],
        });
      });
    };
    connect();

    return {
      writeAudio(buffer: Buffer) {
        if (destroyed) return;
        const converted = resample(buffer);
        if (converted.length === 0) return;
        send(JSON.stringify({ event: cfg.EVENT_AUDIO_INPUT, audio: converted.toString('base64') }));
      },
      endInput() {
        if (destroyed) return;
        send(JSON.stringify({ event: cfg.EVENT_AUDIO_END }));
      },
      onTranscript(callback: (text: string, isFinal?: boolean) => void) {
        transcriptCb = callback;
      },
      onEndOfSpeech(callback: () => void) {
        endOfSpeechCb = callback;
      },
      destroy() {
        destroyed = true;
        transcriptCb = null;
        endOfSpeechCb = null;
        pending = [];
        try {
          socket.close();
        } catch {
          // already gone
        }
      },
    };
  }
}
