/**
 * DetailShell.js
 * Page-level shell primitives shared between HotelDetails and BrandDetails.
 */
import { Box, Typography, TextField } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { motion } from 'framer-motion';
import MapComponent from './MapComponent';
import { FormCard, FormField, HoursRow, HOURS_FIELDS, LABEL_SX, inputSx } from './cards/AppCards';
import { NAVY, NAVY_GRADIENT, NAVY_CONTRAST, MUTED, BORDER, BRAND_GRADIENT, PRIMARY_CONTRAST, TEXT_MUTED_LIGHT } from '../theme';

// ── Shell components ───────────────────────────────────────────────────────

/** Breadcrumb trail. items: [{label, onClick?, color?}] */
export function DetailBreadcrumb({ items }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
      {items.filter(Boolean).map((item, i, arr) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography onClick={item.onClick}
            sx={{ fontSize: 12, fontWeight: 700, color: item.color || (item.onClick ? MUTED : NAVY), cursor: item.onClick ? 'pointer' : 'default', '&:hover': item.onClick ? { color: NAVY } : {} }}>
            {item.label}
          </Typography>
          {i < arr.length - 1 && <ChevronRight sx={{ fontSize: 13, color: MUTED }} />}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Gradient hero banner with watermark letter, logo box, eyebrow, name, meta slot.
 * logoUrl → shows image; fallback → custom JSX (icon); default → first letter of name.
 */
export function DetailHero({ name, gradient, eyebrow, logoUrl, fallback, meta }) {
  return (
    <Box sx={{ borderRadius: 3, overflow: 'hidden', background: gradient, color: NAVY_CONTRAST, p: '20px 24px', position: 'relative', mb: 2.5 }}>
      <Typography sx={{ position: 'absolute', right: -20, top: -40, fontSize: 220, fontWeight: 900, color: 'rgba(255,255,255,0.07)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
        {name?.[0]}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ width: 68, height: 68, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
          {logoUrl
            ? <Box component="img" src={logoUrl} alt={name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (fallback || <Typography sx={{ fontSize: 30, fontWeight: 900, color: NAVY_CONTRAST }}>{name?.[0]}</Typography>)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {eyebrow && <Typography sx={{ ...LABEL_SX, fontSize: 9.5, color: TEXT_MUTED_LIGHT, mb: 0.5 }}>{eyebrow}</Typography>}
          <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>{name}</Typography>
          {meta && <Box sx={{ mt: 0.75 }}>{meta}</Box>}
        </Box>
      </Box>
    </Box>
  );
}

/** Tab strip. tabs: [{key, label, Icon?}]. 'danger' key gets red color. */
export function DetailTabBar({ tabs, active, onChange }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, borderBottom: `1px solid ${BORDER}`, mb: 3, overflowX: 'auto', overflowY: 'hidden', pb: 0 }}>
      {tabs.map(({ key, label, Icon }) => {
        const isActive = key === active;
        const isDanger = key === 'danger';
        return (
          <Box key={key} component="button" onClick={() => onChange(key)}
            sx={{ px: 2, py: 1.5, border: 'none', bgcolor: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 0.75, mb: '-1px',
              color: isActive ? (isDanger ? '#DC2626' : NAVY) : MUTED,
              borderBottom: `2px solid ${isActive ? (isDanger ? '#DC2626' : 'var(--app-primary)') : 'transparent'}` }}>
            {Icon && <Icon sx={{ fontSize: 13 }} />}
            {label}
          </Box>
        );
      })}
    </Box>
  );
}

/** Floating unsaved-changes pill. extra = optional JSX (e.g. propagate checkbox). */
export function UnsavedChangesBar({ onDiscard, onSave, extra }) {
  return (
    <Box sx={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: NAVY_GRADIENT, borderRadius: 99, px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, boxShadow: '0 8px 32px rgba(0,0,0,0.35)', zIndex: 100, whiteSpace: 'nowrap' }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'var(--app-primary)', flexShrink: 0 }} />
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: NAVY_CONTRAST, mr: 0.5 }}>Unsaved changes</Typography>
      {extra}
      <Box component="button" onClick={onDiscard}
        sx={{ border: '1px solid rgba(255,255,255,0.25)', bgcolor: 'transparent', color: NAVY_CONTRAST, px: 1.5, py: 0.6, borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
        Discard
      </Box>
      <Box component="button" onClick={onSave}
        sx={{ border: 'none', background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, px: 1.75, py: 0.6, borderRadius: 99, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
        Save
      </Box>
    </Box>
  );
}

// ── Tab content components ─────────────────────────────────────────────────

/** Hours & Wi-Fi tab — FormCard + HoursRow grid. */
export function HoursTab({ editValues, handleInputChange, accent, sub = 'Used by the AI concierge to answer guest questions accurately.' }) {
  return (
    <FormCard title="Operating hours" sub={sub}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <MapComponent Component={HoursRow} data={HOURS_FIELDS} editValues={editValues} handleInputChange={handleInputChange} accent={accent} showNoDataAvailable={false} />
      </Box>
    </FormCard>
  );
}

/** Concierge AI tab — FormCard + multiline TextField. */
export function AiTab({ editValues, handleInputChange, title = 'Concierge instructions', sub, placeholder }) {
  return (
    <FormCard title={title} sub={sub}>
      <TextField fullWidth multiline minRows={6}
        value={editValues.llmInstructions || ''}
        onChange={handleInputChange('llmInstructions')}
        placeholder={placeholder}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13, lineHeight: 1.6 } }} />
    </FormCard>
  );
}

/** Two-color brand theme picker — primaryColor + secondaryColor. */
export function BasicThemePicker({ editValues, handleInputChange }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
      {[{ key: 'primaryColor', label: 'Primary' }, { key: 'secondaryColor', label: 'Secondary' }].map(({ key, label }) => (
        <FormField key={key} label={label}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '6px 6px 6px 14px', borderRadius: 1.5, border: `1px solid ${BORDER}`, bgcolor: 'background.paper' }}>
            <Typography sx={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: NAVY }}>{editValues[key] || '—'}</Typography>
            <Box component="input" type="color" value={editValues[key] || '#1B2340'} onChange={handleInputChange(key)}
              sx={{ width: 38, height: 38, border: 'none', borderRadius: 1, cursor: 'pointer', p: 0, bgcolor: 'transparent' }} />
          </Box>
        </FormField>
      ))}
    </Box>
  );
}

// ── Helper ─────────────────────────────────────────────────────────────────

/**
 * Extract theme keys from editValues into themeConfig + return cleaned payload.
 * usage: const { themeConfig, payload } = buildThemePayload(editValues, THEME_KEYS);
 */
export function buildThemePayload(editValues, themeKeys) {
  const themeObj = {};
  const payload = { ...editValues };
  for (let i = 0; i < themeKeys.length; i++) {
    const v = editValues[themeKeys[i]];
    if (v?.trim()) themeObj[themeKeys[i]] = v.trim();
    delete payload[themeKeys[i]];
  }
  return { themeConfig: Object.keys(themeObj).length ? themeObj : null, payload };
}
