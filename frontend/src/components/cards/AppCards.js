/**
 * AppCards.js
 * Generic UI primitives reusable across the entire app.
 * Domain-specific rows live in their own card files (RequestCard, BookingCard, HotelCard).
 */
import React, { useEffect } from 'react';
import { Box, Chip, Grid, Typography } from '@mui/material';
import { motion, animate, useMotionValue, useTransform } from 'framer-motion';
import { NAVY, MUTED, BORDER, SHADOW, HOVER_BG } from '../../theme';
import { REQUEST_STATUS } from '../../constants/requestConfig';

// ── Style constants ─────────────────────────────────────────────────────────

export const LABEL_SX = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: MUTED,
};

export const CARD_SX = {
  bgcolor: 'background.paper',
  borderRadius: 3,
  border: `1px solid ${BORDER}`,
  boxShadow: SHADOW,
  overflow: 'hidden',
};

export const ROW_SX = {
  cursor: 'pointer',
  '&:hover': { bgcolor: 'action.hover' },
  '&:last-child': { borderBottom: 'none' },
  transition: 'background 0.15s',
  borderBottom: `1px solid ${BORDER}`,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── UI primitives ───────────────────────────────────────────────────────────

/** Status chip — reads color + label from requestConfig.REQUEST_STATUS. */
export function StatusChip({ status }) {
  const s = REQUEST_STATUS[status] || { bg: HOVER_BG, color: MUTED, label: status };
  return (
    <Chip label={s.label || String(status).replace('_', ' ')} size="small"
      sx={{ fontSize: 10, height: 20, fontWeight: 700, bgcolor: s.bg, color: s.color, border: 'none' }} />
  );
}

/** Count-up animation from 0 → value on mount. */
export function AnimatedNumber({ value }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const controls = animate(count, value, { duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94] });
    return controls.stop;
  }, [value]);
  return <motion.span>{rounded}</motion.span>;
}

/** Card section header — eyebrow + bold title + optional right slot. */
export function CardHeader({ eyebrow, eyebrowColor, title, right }) {
  return (
    <Box sx={{ px: 2.5, pt: 2.25, pb: 1.5, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Box>
        {eyebrow && <Typography sx={{ ...LABEL_SX, fontSize: 9.5, color: eyebrowColor || MUTED, mb: 0.5 }}>{eyebrow}</Typography>}
        <Typography sx={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{title}</Typography>
      </Box>
      {right}
    </Box>
  );
}

/** Section header with uppercase label + bold title + "View all →". */
export function SectionHeader({ label, title, onViewAll }) {
  return (
    <Box sx={{ px: 2.5, pt: 2.25, pb: 1.75, borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <Box>
        <Typography sx={{ ...LABEL_SX, mb: 0.75 }}>{label}</Typography>
        <Typography sx={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{title}</Typography>
      </Box>
      <Typography onClick={onViewAll} sx={{ fontSize: 12, fontWeight: 700, color: 'primary.main', cursor: 'pointer', mb: 0.25 }}>View all →</Typography>
    </Box>
  );
}

/** KPI stat card — label, animated number, sub-label, colored left border. */
export function StatCard({ data: k, index }) {
  return (
    <Grid item xs={6} sm={3} md={3}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07, duration: 0.35 }}>
        <Box sx={{ ...CARD_SX, p: { xs: '16px 16px', md: '20px 22px' }, borderLeft: `3px solid ${k.accent}` }}>
          <Typography sx={{ ...LABEL_SX, fontSize: { xs: 10, md: 11 }, mb: { xs: 1.25, md: 1.75 } }}>{k.label}</Typography>
          <Typography sx={{ fontSize: { xs: 28, md: 38 }, fontWeight: 800, color: NAVY, letterSpacing: '-0.02em', lineHeight: 1, mb: 0.75 }}>
            <AnimatedNumber value={k.value} />
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED }}>{k.sub}</Typography>
        </Box>
      </motion.div>
    </Grid>
  );
}

/** Column header label for table headers. data = string. */
export function ColumnLabel({ data: h }) {
  return <Typography sx={{ ...LABEL_SX, fontSize: 10 }}>{h}</Typography>;
}
