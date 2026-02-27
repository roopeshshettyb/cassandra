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

export interface SttSessionOptions {
  language?: string | null;
}

export interface SttSessionFactory {
  createSession(options?: SttSessionOptions): ISttSession;
}
