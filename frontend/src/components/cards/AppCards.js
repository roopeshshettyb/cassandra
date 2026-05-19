/**
 * AppCards.js
 * Generic, reusable card and row components for the entire app.
 * Components accept neutral data props — callers map their domain data before passing.
 * All list components are MapComponent-compatible (accept { data, ...props }).
 */
import React, { useEffect } from 'react';
import { Avatar, Box, Chip, Grid, Typography } from '@mui/material';
import { motion, animate, useMotionValue, useTransform } from 'framer-motion';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
  NAVY, MUTED, BORDER, SHADOW, BG, HOVER_BG,
  STATUS_INFO_BG,
} from '../../theme';
import { REQUEST_STATUS } from '../../constants/requestConfig';

// ── Shared style constants ──────────────────────────────────────────────────

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

// ── Shared helpers ──────────────────────────────────────────────────────────

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Shared UI primitives ────────────────────────────────────────────────────

/**
 * StatusChip — renders a colored Chip for any request/booking status.
 * Reads label + colors from REQUEST_STATUS; falls back gracefully.
 */
export function StatusChip({ status }) {
  const s = REQUEST_STATUS[status] || { bg: HOVER_BG, color: MUTED, label: status };
  const label = s.label || String(status).replace('_', ' ');
  return (
    <Chip label={label} size="small"
      sx={{ fontSize: 10, height: 20, fontWeight: 700, bgcolor: s.bg, color: s.color, border: 'none' }} />
  );
}

/**
 * AnimatedNumber — counts up from 0 to `value` on mount/change.
 */
export function AnimatedNumber({ value }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const controls = animate(count, value, { duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94] });
    return controls.stop;
  }, [value]);
  return <motion.span>{rounded}</motion.span>;
}

// ── Layout components ───────────────────────────────────────────────────────

/**
 * CardHeader — eyebrow label + bold title + optional right slot.
 * Use for property pulse, action queue, any labelled card.
 */
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

/**
 * SectionHeader — uppercase label + bold title + "View all →" link.
 * Use for recent lists (requests, bookings, etc.).
 */
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

// ── Generic card components ─────────────────────────────────────────────────

/**
 * StatCard — KPI stat card with animated count-up and colored left border.
 *
 * data shape: { label: string, value: number, sub: string, accent: string }
 */
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

/**
 * ListRow — generic clickable row with icon, text, optional right slot.
 * Use for action queue, recent requests, any compact list.
 *
 * data shape: {
 *   icon: ComponentClass,   // icon to render (null → HelpOutlineIcon)
 *   iconBg: string,          // icon container background
 *   iconColor: string,       // icon color
 *   title: string,           // bold top text
 *   subtitle: string,        // secondary text below title
 *   time: string,            // ISO date → rendered as timeAgo
 *   via: string,             // "via X" attribution line (optional)
 *   right: ReactNode,        // right slot — status chip, count, etc. (optional)
 *   route: string,           // navigate target on click
 * }
 */
export function ListRow({ data: d, navigate }) {
  const Icon = d.icon || HelpOutlineIcon;
  return (
    <Box onClick={() => d.route && navigate(d.route)}
      sx={{ ...ROW_SX, px: 2, py: 1.5, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: d.iconBg || STATUS_INFO_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
        <Icon sx={{ fontSize: 16, color: d.iconColor || MUTED }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.35 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</Typography>
          {d.time && <Typography sx={{ fontSize: 10.5, color: MUTED, flexShrink: 0 }}>{timeAgo(d.time)}</Typography>}
        </Box>
        {d.subtitle && <Typography sx={{ fontSize: 12.5, color: 'text.primary', lineHeight: 1.45, mb: 0.35, textTransform: 'capitalize' }}>{d.subtitle}</Typography>}
        {d.right && <Box sx={{ mt: 0.25 }}>{d.right}</Box>}
        {d.via && <Typography sx={{ fontSize: 11, color: MUTED }}>via {d.via}</Typography>}
      </Box>
    </Box>
  );
}

/**
 * TableRow — property pulse row with avatar, name, and flexible column values.
 * Desktop: renders all columns in a grid. Mobile: compact badge only.
 *
 * data shape: {
 *   avatar: string,        // image URL (falls back to first letter)
 *   name: string,          // property/entity name
 *   columns: any[],        // desktop column values (rendered as Typography)
 *   badge: ReactNode,      // mobile compact badge
 * }
 */
export function TableRow({ data: row }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', md: `2fr ${row.columns?.map(() => '1fr').join(' ')}` }, px: 2.5, py: { xs: 1.25, md: 1.75 }, alignItems: 'center', borderBottom: `1px solid ${BORDER}`, gap: 1, '&:last-child': { borderBottom: 'none' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Avatar src={row.avatar || undefined} sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, bgcolor: NAVY, flexShrink: 0 }}>
          {!row.avatar && row.name?.[0]?.toUpperCase()}
        </Avatar>
        <Typography sx={{ fontSize: { xs: 13, md: 13.5 }, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</Typography>
      </Box>
      <Box sx={{ display: { xs: 'flex', md: 'none' } }}>{row.badge}</Box>
      {(row.columns || []).map((col, i) => (
        <Box key={i} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
          {typeof col === 'object' ? col : <Typography sx={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{col}</Typography>}
        </Box>
      ))}
    </Box>
  );
}

/**
 * DateTileRow — booking row with check-in date tile, guest name, hotel info, status chip.
 *
 * data shape: {
 *   ciDate: Date,            // check-in date object
 *   title: string,           // guest name
 *   subtitle: string,        // hotel · nights · room
 *   right: ReactNode,        // status chip
 *   route: string,
 * }
 */
export function DateTileRow({ data: d, navigate }) {
  return (
    <Box onClick={() => d.route && navigate(d.route)}
      sx={{ ...ROW_SX, px: 2.5, py: 1.75, display: 'flex', alignItems: 'center', gap: 1.75 }}>
      {d.ciDate && (
        <Box sx={{ width: 42, height: 46, borderRadius: 1.5, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, bgcolor: BG }}>
          <Typography sx={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: '0.06em' }}>
            {d.ciDate.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
          </Typography>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: NAVY, lineHeight: 1 }}>{d.ciDate.getDate()}</Typography>
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</Typography>
        <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.subtitle}</Typography>
      </Box>
      {d.right}
    </Box>
  );
}

/**
 * ColumnLabel — plain uppercase label cell for table headers.
 * data: string
 */
export function ColumnLabel({ data: h }) {
  return <Typography sx={{ ...LABEL_SX, fontSize: 10 }}>{h}</Typography>;
}
