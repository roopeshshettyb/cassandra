import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ConstantsService } from '../common/constants/constants.service';
import { LoggerService } from '../common/logger.service';

interface StreamOptions {
  emitEnd?: boolean;
  languageCode?: string | null;
}

interface TtsProvider {
  streamToClient: (client: any, text: string, options?: StreamOptions) => Promise<void>;
}

/**
 * Echo (echospeaks.ai): a shared cache of synthesised sentences. An agent says
 * the same things again and again — "And how many of you will be staying?" —
 * and every repeat is paid for again. Here a sentence is looked up first; a hit
 * plays the stored audio and the TTS provider is never called, a miss is
 * synthesised as usual and stored on the way past.
 *
 * Off unless ECHO_API_KEY is set, and strictly fail-open: a slow, down or
 * refusing cache is a plain miss, so it can cost money but never a reply.
 *
 * The text normalisation is Echo's own (echospeaks/cache/keying.py), so the same
 * sentences match. The hash is Node's blake2b cut to 128 bits, which is not
 * the Python SDK's blake2b-128: our entries are ours alone, shared only between
 * our own servers.
 */
@Injectable()
export class EchoTtsCacheService {
  constructor(
    private readonly constantsService: ConstantsService,
    private readonly logger: LoggerService,
  ) {}

  /** Speak `text` through the cache when it is enabled, straight through the provider when not. */
  async speak(client: any, text: string, options: StreamOptions, provider: TtsProvider, providerName: string): Promise<void> {
    const cfg = this.constantsService.private.ECHO_TTS_CACHE;
    if (!cfg.API_KEY || new RegExp(cfg.PERSONAL_PATTERN, 'u').test(text)) {
      return provider.streamToClient(client, text, options);
    }
    const key = this.cacheKey(text, providerName, options.languageCode ?? null);
    const startedAt = Date.now();
    const cached = await this.lookup(key, providerName);
    if (cached) {
      for (let offset = 0; offset < cached.length; offset += cfg.CHUNK_BYTES) {
        client.emit('voice_audio_chunk', { delta: cached.subarray(offset, offset + cfg.CHUNK_BYTES).toString('base64') });
      }
      if (options.emitEnd !== false) {
        client.emit('voice_audio_end');
      }
      this.record('hit', text, Date.now() - startedAt);
      return;
    }

    // A miss: synthesise as normal, and keep a copy of the audio on its way to
    // the caller. The provider streams the whole sentence even if the caller
    // talks over it, so what is stored is never a truncated sentence.
    const audio: Buffer[] = [];
    const tee = {
      emit: (event: string, payload?: any) => {
        if (event === 'voice_audio_chunk' && payload?.delta) {
          audio.push(Buffer.from(payload.delta, 'base64'));
        }
        client.emit(event, payload);
      },
    };
    await provider.streamToClient(tee, text, options);
    this.record('miss', text, Date.now() - startedAt);
    if (audio.length > 0) {
      void this.store(key, providerName, text, Buffer.concat(audio));
    }
  }

  /** Echo's normalize_for_cache: what counts as "the same sentence". */
  private normalize(text: string): string {
    const chars = Array.from(text.normalize('NFC').toLowerCase());
    const digit = (ch: string) => /\p{Nd}/u.test(ch);
    const out = chars.map((ch, i) => {
      const prev = chars[i - 1] ?? '';
      const next = chars[i + 1] ?? '';
      if (/[​‌‍﻿'’‘"“”`]/.test(ch)) return '';
      if (ch === '?' || ch === '!') return ch;
      if (ch === ',' || ch === '.') return digit(prev) && digit(next) ? ch : ' ';
      if (ch === '%') return digit(prev) ? '%' : ' ';
      if (/\p{Sc}/u.test(ch)) return digit(prev) || digit(next) ? ch : ' ';
      return /[\p{P}\p{S}]/u.test(ch) ? ' ' : ch;
    });
    return out.join('').replace(/([?!])\1+/g, '$1').replace(/\s+([?!])/g, '$1').split(/\s+/).filter(Boolean).join(' ');
  }

  /** Everything that changes the sound goes in the key, so a hit is always the right audio. */
  private cacheKey(text: string, providerName: string, languageCode: string | null): string {
    const cfg = this.constantsService.private.ECHO_TTS_CACHE;
    const voice = this.constantsService.private.LLM.TTS_CONFIG.ELEVENLABS;
    const settings = createHash('sha256')
      .update(JSON.stringify({ ...voice.VOICE_SETTINGS, audioTag: voice.AUDIO_TAG, languageCode }))
      .digest('hex')
      .slice(0, 12);
    const raw = [providerName, voice.MODEL, voice.VOICE_ID, cfg.SAMPLE_RATE, cfg.CHANNELS, cfg.ENCODING, settings, this.normalize(text)].join(':');
    return createHash('blake2b512').update(raw).digest('hex').slice(0, 32);
  }

  private url(key: string, providerName: string): string {
    const cfg = this.constantsService.private.ECHO_TTS_CACHE;
    return `${cfg.URL}/v1/entries/${key}?provider=${encodeURIComponent(providerName)}&transport=${cfg.TRANSPORT}`;
  }

  /** The stored PCM, or null for a miss — including every failure. */
  private async lookup(key: string, providerName: string): Promise<Buffer | null> {
    const cfg = this.constantsService.private.ECHO_TTS_CACHE;
    try {
      const res = await fetch(this.url(key, providerName), {
        headers: { Authorization: `Bearer ${cfg.API_KEY}` },
        signal: AbortSignal.timeout(cfg.LOOKUP_TIMEOUT_MS),
      });
      if (res.status !== 200) {
        if (res.status !== 404) {
          this.logger.warn({ message: `Echo lookup returned ${res.status}`, serviceName: 'EchoTtsCacheService', actionName: 'lookup' });
        }
        return null;
      }
      const envelope: any = await res.json();
      return envelope?.v === cfg.ENVELOPE_VERSION && envelope.audio ? Buffer.from(envelope.audio, 'base64') : null;
    } catch (err: any) {
      this.logger.warn({ message: `Echo lookup failed: ${err?.message ?? err}`, serviceName: 'EchoTtsCacheService', actionName: 'lookup' });
      return null;
    }
  }

  /** Fire-and-forget: a store that fails costs a future hit, nothing more. */
  private async store(key: string, providerName: string, text: string, audio: Buffer): Promise<void> {
    const cfg = this.constantsService.private.ECHO_TTS_CACHE;
    try {
      const res = await fetch(this.url(key, providerName), {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          v: cfg.ENVELOPE_VERSION,
          provider: providerName,
          rate: cfg.SAMPLE_RATE,
          ch: cfg.CHANNELS,
          enc: cfg.ENCODING,
          text,
          duration_ms: Math.round((audio.length / (cfg.SAMPLE_RATE * 2 * cfg.CHANNELS)) * 1000),
          wt: [],
          wis: false,
          tag: cfg.TAG,
          ts: Date.now() / 1000,
          audio: audio.toString('base64'),
        }),
        signal: AbortSignal.timeout(cfg.WRITE_TIMEOUT_MS),
      });
      if (res.status !== 201) {
        this.logger.warn({ message: `Echo store returned ${res.status}`, serviceName: 'EchoTtsCacheService', actionName: 'store' });
      }
    } catch (err: any) {
      this.logger.warn({ message: `Echo store failed: ${err?.message ?? err}`, serviceName: 'EchoTtsCacheService', actionName: 'store' });
    }
  }

  /** One line per sentence, so a test call can be read back as hits, misses, characters and time. */
  private record(outcome: 'hit' | 'miss', text: string, ms: number): void {
    this.logger.log({ message: `Echo ${outcome} ${ms}ms ${text.length} chars: ${text.slice(0, 60)}`, serviceName: 'EchoTtsCacheService', actionName: 'speak' });
  }
}
