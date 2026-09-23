export const floatTo16BitPCM = (input: Float32Array): Int16Array => {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < input.length; i += 1, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Int16Array(buffer);
};

export const arrayBufferToBase64 = (buffer: ArrayBufferLike): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const playPcmChunk = (
  base64: string,
  audioContextRef: { current: AudioContext | null },
  playbackTimeRef: { current: number },
): void => {
  const bytes = base64ToUint8Array(base64);
  const win: any = window;
  const AudioContextImpl = win.AudioContext || win.webkitAudioContext;
  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContextImpl({ sampleRate: 24000 });
  }
  const audioContext = audioContextRef.current;
  if (!audioContext) return;
  // Chrome's autoplay policy suspends a context not created during a user
  // gesture — this one is built inside a socket handler, so without resuming it
  // the audio is scheduled and never heard.
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  const bufferLength = Math.floor(bytes.byteLength / 2);
  if (bufferLength === 0) return;
  const audioBuffer = audioContext.createBuffer(1, bufferLength, 24000);
  const channelData = audioBuffer.getChannelData(0);
  const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < bufferLength; i += 1) {
    const sample = dataView.getInt16(i * 2, true);
    channelData[i] = sample / 0x8000;
  }
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  const now = audioContext.currentTime;
  const startAt = Math.max(playbackTimeRef.current || now, now);
  source.start(startAt);
  playbackTimeRef.current = startAt + audioBuffer.duration;
};

/**
 * Call `onDone` when the audio scheduled up to `scheduledEndTime` has actually
 * been heard, and return a function that cancels the wait.
 *
 * Chunks are scheduled ahead of the clock, so a socket going quiet says nothing
 * about whether sound is still coming out of the speaker — only the context's
 * own clock knows. Both voice surfaces need that answer before reopening a
 * microphone, or the agent ends up transcribing itself.
 *
 * Polled on animation frames, with a timer behind it: a backgrounded tab stops
 * firing frames and a suspended context stops advancing its clock, and neither
 * should strand a call mid-turn.
 */
export const watchPlaybackEnd = (
  audioContextRef: { current: AudioContext | null },
  scheduledEndTime: number,
  onDone: () => void,
  graceMs: number,
): (() => void) => {
  let raf: number | null = null;
  let fallback: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
    if (fallback !== null) {
      clearTimeout(fallback);
      fallback = null;
    }
  };

  const finish = () => {
    cancel();
    onDone();
  };

  const poll = () => {
    const audioContext = audioContextRef.current;
    if (!audioContext || audioContext.currentTime >= scheduledEndTime) {
      finish();
      return;
    }
    raf = requestAnimationFrame(poll);
  };
  raf = requestAnimationFrame(poll);

  const audioContext = audioContextRef.current;
  const remainingMs = audioContext ? Math.max(0, (scheduledEndTime - audioContext.currentTime) * 1000) : 0;
  fallback = setTimeout(finish, remainingMs + graceMs);

  return cancel;
};
