import { Avatar, Box, Typography } from '@mui/material';
import { NAVY, NAVY_GRADIENT, MUTED, BORDER, HOVER_BG } from '../../theme';
import { ROW_SX } from './AppCards';

// Person row shared by hotel staff and organisation members: avatar, name over
// email, then caller-supplied columns and a trailing action.
export function MemberRow({ name, email, gridTemplateColumns, columns = [], trailing, hover }) {
  const initials = name ? name.trim().slice(0, 2).toUpperCase() : '?';
  return (
    <Box
      sx={{
        ...ROW_SX,
        display: 'grid',
        gridTemplateColumns,
        alignItems: 'center',
        px: { xs: 2, sm: 2.5 },
        py: 1.5,
        gap: 1.5,
        ...(hover && { '&:hover': { bgcolor: HOVER_BG } }),
      }}
    >
      <Avatar sx={{ width: 34, height: 34, fontSize: 12, fontWeight: 800, background: NAVY_GRADIENT }}>{initials}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name || '—'}
        </Typography>
        <Typography sx={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email || '—'}
        </Typography>
      </Box>
      {columns.map((col, i) => (
        <Box key={i} sx={{ minWidth: 0, display: col.hideOnMobile ? { xs: 'none', sm: 'block' } : 'block' }}>
          {typeof col.value === 'string' || typeof col.value === 'number' ? (
            <Typography sx={{ fontSize: col.small ? 11 : 12, fontWeight: col.strong ? 700 : 400, color: col.strong ? NAVY : MUTED, whiteSpace: 'nowrap' }}>
              {col.value}
            </Typography>
          ) : (
            col.value
          )}
        </Box>
      ))}
      {trailing ?? <Box />}
    </Box>
  );
}

/** Pill used for a member's status. */
export function StatusPill({ label, color, background }) {
  return (
    <Box sx={{ borderRadius: 999, px: 1, py: 0.4, fontSize: 11, fontWeight: 700, textAlign: 'center', color, bgcolor: background, border: `1px solid ${BORDER}00` }}>
      {label}
    </Box>
  );
}

export default MemberRow;
