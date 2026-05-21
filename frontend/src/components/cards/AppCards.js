/**
 * AppCards.js
 * Generic UI primitives reusable across the entire app.
 * Domain-specific rows live in their own card files (RequestCard, BookingCard, HotelCard).
 */
import React, { useEffect } from 'react';
import { Box, Chip, Grid, Typography, TextField, InputAdornment } from '@mui/material';
import {
  Search, AccessTime, Login, Logout, FreeBreakfast, LunchDining, DinnerDining,
  LocalCafe, Pool, FitnessCenter, Restaurant, RoomService, CleaningServices, Wifi,
} from '@mui/icons-material';
import { motion, animate, useMotionValue, useTransform } from 'framer-motion';
import { NAVY, MUTED, BORDER, SHADOW, HOVER_BG, BG } from '../../theme';
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

/** Stat box — label, large value, optional sub-label. Used in HotelCard and BrandCard. */
export function StatBox({ label, value, sub }) {
  return (
    <Box>
      <Typography sx={{ ...LABEL_SX, fontSize: 10, mb: 0.25 }}>{label}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 800, color: NAVY, lineHeight: 1 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 10, color: MUTED, mt: 0.3 }}>{sub}</Typography>}
    </Box>
  );
}

/** Shared input style for outlined text fields. */
export const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } };

/** Operating hours field config — shared between HotelDetails and BrandDetails. */
export const HOURS_FIELDS = [
  { key: 'checkInTime',       label: 'Check-in',        type: 'time', Icon: Login,            placeholder: 'Ex. 15:00' },
  { key: 'checkOutTime',      label: 'Check-out',       type: 'time', Icon: Logout,           placeholder: 'Ex. 12:00' },
  { key: 'breakfastHours',    label: 'Breakfast',                      Icon: FreeBreakfast,    placeholder: 'Ex. 07:00 – 10:30' },
  { key: 'lunchHours',        label: 'Lunch',                          Icon: LunchDining,      placeholder: 'Ex. 12:00 – 14:30' },
  { key: 'dinnerHours',       label: 'Dinner',                         Icon: DinnerDining,     placeholder: 'Ex. 19:00 – 22:30' },
  { key: 'snacksHours',       label: 'All-day snacks',                 Icon: LocalCafe,        placeholder: 'Ex. 10:00 – 22:00' },
  { key: 'poolHours',         label: 'Pool',                           Icon: Pool,             placeholder: 'Ex. 06:00 – 22:00' },
  { key: 'gymHours',          label: 'Gym',                            Icon: FitnessCenter,    placeholder: 'Ex. 06:00 – 23:00' },
  { key: 'restaurantHours',   label: 'Restaurant',                     Icon: Restaurant,       placeholder: 'Ex. 07:00 – 23:00' },
  { key: 'roomServiceHours',  label: 'Room service',                   Icon: RoomService,      placeholder: 'Ex. 24 hours' },
  { key: 'houseKeepingHours', label: 'Housekeeping',                   Icon: CleaningServices, placeholder: 'Ex. 08:00 – 20:00' },
  { key: 'wifiPassword',      label: 'Wi-Fi password',                 Icon: Wifi,             placeholder: 'Ex. Hotel@2024' },
];

/** Editable hours row — icon + label + inline text field. MapComponent-compatible. */
export function HoursRow({ data: f, editValues, handleInputChange, onDirty, accent }) {
  const Icon = f.Icon || AccessTime;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '10px 14px', borderRadius: 1.5, border: `1px solid ${BORDER}`, bgcolor: BG }}>
      <Box sx={{ width: 30, height: 30, borderRadius: 1, bgcolor: 'background.paper', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon sx={{ fontSize: 13, color: accent || 'var(--app-primary)' }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ ...LABEL_SX, fontSize: 10, mb: 0.25 }}>{f.label}</Typography>
        <TextField variant="standard" type={f.type || 'text'} value={editValues[f.key] || ''} placeholder={f.placeholder}
          onChange={e => { handleInputChange(f.key)(e); onDirty?.(f.key); }}
          InputProps={{ disableUnderline: true }}
          sx={{ '& input': { fontSize: 13, fontWeight: 700, p: 0, fontFamily: 'ui-monospace, monospace', color: NAVY } }} />
      </Box>
    </Box>
  );
}

/** Form section card — title, optional subtitle, optional right action. */
export function FormCard({ title, sub, action, children }) {
  return (
    <Box sx={{ ...CARD_SX, p: 2.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5 }}>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{title}</Typography>
          {sub && <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.5 }}>{sub}</Typography>}
        </Box>
        {action}
      </Box>
      {children}
    </Box>
  );
}

/** Form field row — label + optional hint + children input. */
export function FormField({ label, hint, children }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
        <Typography sx={{ ...LABEL_SX, fontSize: 10 }}>{label}</Typography>
        {hint && <Typography sx={{ fontSize: 10, color: MUTED }}>{hint}</Typography>}
      </Box>
      {children}
    </Box>
  );
}

/** Page-level header — eyebrow + bold title + optional right slot. */
export function PageHeader({ eyebrow = 'Management', title, right }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
        <Typography sx={{ ...LABEL_SX, color: 'primary.main', mb: 0.5 }}>{eyebrow}</Typography>
        <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY }}>{title}</Typography>
      </Box>
      {right}
    </Box>
  );
}

/** Reusable search input with leading icon. */
export function SearchBar({ value, onChange, placeholder = 'Search…', sx }) {
  return (
    <TextField
      size="small"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: MUTED }} /></InputAdornment> }}
      sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2.5, fontSize: 13 }, ...sx }}
    />
  );
}
