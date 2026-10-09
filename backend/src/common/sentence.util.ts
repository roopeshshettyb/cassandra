/**
 * Where a sentence ends, for the two voice surfaces that stream a reply.
 *
 * Both need the same answer — it decides when a phrase is complete enough to
 * hand to TTS, which is what lets the agent start speaking before it has
 * finished thinking. What they do with the pieces differs, so only the question
 * lives here.
 */

const cache = new Map<string, RegExp>();

/**
 * Latin terminators must be followed by whitespace, so "10 a.m." and "₹3.5
 * lakh" are not mistaken for sentence ends. The rest are not ambiguous that
 * way, and are commonly written with nothing after them at all.
 */
function boundary(latin: string, other: string): RegExp {
  const key = `${latin}|${other}`;
  let regex = cache.get(key);
  if (!regex) {
    const escape = (chars: string) => chars.replace(/[.^$*+?()[\]{}|\\-]/g, '\\$&');
    regex = new RegExp(`[${escape(latin)}]\\s+|[${escape(other)}]\\s*`, 'g');
    cache.set(key, regex);
  }
  return regex;
}

/** Complete sentences in the buffer, and the unfinished tail to keep. */
export function splitSentences(
  buffer: string,
  latinTerminators: string,
  otherTerminators: string,
): { parts: string[]; rest: string } {
  const regex = boundary(latinTerminators, otherTerminators);
  regex.lastIndex = 0;
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(buffer)) !== null) {
    const sentence = buffer.slice(lastIndex, match.index + 1).trim();
    if (sentence.length > 0) {
      parts.push(sentence);
    }
    lastIndex = regex.lastIndex;
  }
  return { parts, rest: buffer.slice(lastIndex) };
}

/**
 * Remove delivery cues like [warm] or [thoughtful] from text meant to be read.
 *
 * They are instructions to a voice, not words. A guest should hear the warmth
 * and never see the stage direction in their transcript.
 */
export function stripAudioTags(text: string): string {
  return stripToolEcho(text).replace(/\[[a-z][a-z ]{0,24}\]\s*/gi, '').trim();
}

/**
 * Remove a tool call the model wrote out as words instead of making.
 *
 * Rare, but measured: a reply ended `noted. [note_reservation_dates] {"checkIn…`
 * and on a call that JSON is read aloud to the caller. Everything from the
 * marker on is dropped; a tool name is snake_case, which no sentence is.
 */
export function stripToolEcho(text: string): string {
  return text.replace(/\s*\[[a-z]+(?:_[a-z]+)+\]\s*\{[\s\S]*$/, '');
}
