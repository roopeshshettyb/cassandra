import { Box } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import MicIcon from '@mui/icons-material/Mic';
import { NAVY, NAVY_CONTRAST, BRAND_GRADIENT, SHADOW, SHADOW_BRAND } from '../../../theme';

/**
 * The voice control, shared by the in-stay concierge and the public booking
 * line. They run on different sockets with different rules, but to a guest they
 * are the same assistant, so the thing you tap to talk to it looks the same.
 */

/** Five bars breathing out of phase — the button's "I am live" state. */
export function WaveformBars() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: 28 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          style={{ width: 4, height: 20, borderRadius: 99, background: NAVY_CONTRAST, originY: 0.5 }}
          animate={{ scaleY: [0.4, 1.5, 0.4] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
        />
      ))}
    </Box>
  );
}

/**
 * `active` covers listening, thinking and speaking alike: from the caller's
 * side those are one state — the line is busy — and splitting them into
 * different shapes made the button twitch through a conversation.
 *
 * `disabled` makes the button inert. `unavailable` only looks that way and
 * still reports the tap, which is what you want when there is a reason worth
 * telling the guest: a dead button that explains nothing is worse than one
 * that says "only during your stay".
 */
export function VoiceMicButton({ active, disabled, unavailable, onTap, label }) {
  return (
    <motion.button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 140,
        height: 140,
        borderRadius: '50%',
        border: 'none',
        cursor: unavailable ? 'not-allowed' : disabled ? 'default' : 'pointer',
        background: active ? BRAND_GRADIENT : NAVY,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: active ? SHADOW_BRAND : SHADOW,
        outline: 'none',
        opacity: disabled ? 0.4 : 1,
      }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
    >
      <AnimatePresence mode="wait">
        {active ? (
          <motion.div key="waveform" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }}>
            <WaveformBars />
          </motion.div>
        ) : (
          <motion.div key="mic" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }}>
            <MicIcon sx={{ fontSize: 44, color: NAVY_CONTRAST }} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
