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
  /**
   * BCP-47 code, or 'multi' to let nova-3 follow a caller who switches mid
   * sentence. Omitted means the provider's own default, which for Deepgram is
   * English — fine for the in-stay concierge, wrong for a public line anyone
   * can ring.
   */
  language?: string;
  /**
   * Proper nouns to bias the transcript towards. A model has never seen this
   * property's name, so it guesses, and a guessed name in the first sentence
   * derails everything the agent says after it.
   */
  keyterms?: string[];
}

export interface SttSessionFactory {
  createSession(options?: SttSessionOptions): ISttSession;
}
