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
export function createPcmResampler(fromRate: number, toRate: number, cutoffHz: number) {
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
