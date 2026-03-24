/**
 * Generate and play notification tones using Web Audio API
 * Used as fallback when MP3 files are unavailable
 *
 * Cached AudioContext for performance
 */

let audioContext = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

/**
 * Play notification tone
 * @param {string} toneName - 'gentle_chime' or 'alert_sound'
 * @param {number} duration - Duration in milliseconds
 * @returns {boolean} Success status
 */
export const generateAndPlayTone = async (toneName, duration = 1000) => {
  try {
    const context = getAudioContext();

    if (toneName === 'gentle_chime') {
      return playGentleChime(context);
    } else if (toneName === 'alert_sound') {
      return playAlertSound(context, duration);
    }

    return false;
  } catch (error) {
    console.error('Failed to generate tone:', error);
    return false;
  }
};

/**
 * Play gentle chime: 3 descending notes
 */
const playGentleChime = (audioContext) => {
  try {
    const now = audioContext.currentTime;
    const notes = [
      { freq: 880, start: now, duration: 0.2 },
      { freq: 740, start: now + 0.15, duration: 0.2 },
      { freq: 587, start: now + 0.3, duration: 0.3 },
    ];

    notes.forEach(note => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.2, note.start);
      gain.gain.exponentialRampToValueAtTime(0.01, note.start + note.duration);

      osc.start(note.start);
      osc.stop(note.start + note.duration);
    });

    return true;
  } catch (error) {
    console.error('Failed to play gentle chime:', error);
    return false;
  }
};

/**
 * Play alert sound: high frequency beep
 */
const playAlertSound = (audioContext, duration) => {
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = 1000; // 1kHz frequency

    // Volume envelope: fade in then fade out
    const now = audioContext.currentTime;
    const durationSec = duration / 1000;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + durationSec);

    oscillator.start(now);
    oscillator.stop(now + durationSec);

    return true;
  } catch (error) {
    console.error('Failed to play alert sound:', error);
    return false;
  }
};

export default { generateAndPlayTone };
