/**
 * Streaming STT session: one per voice turn.
 * Gateway pipes audio via writeAudio; provider streams back transcripts and signals end-of-speech.
 */
export interface ISttSession {
  writeAudio(buffer: Buffer): void;
  endInput(): void;
  onTranscript(callback: (text: string, isFinal?: boolean) => void): void;
  onEndOfSpeech(callback: () => void): void;
  destroy(): void;
}

/** Per-session overrides. Omitted fields fall back to the global STT config. */
export interface SttSessionOptions {
  /**
   * Silence in ms that ends a turn. The public reservation call wants a snappier
   * value than the in-stay concierge, so it is set per session rather than
   * globally.
   */
  utteranceEndMs?: number;
}

export interface SttSessionFactory {
  createSession(options?: SttSessionOptions): ISttSession;
}
