import { Avatar, Box, Chip, Typography } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import { NAVY, MUTED, STATUS_ERROR_BG, STATUS_ERROR } from '../../theme';
import { ROW_SX } from './AppCards';
import { EntityCard, EntityTableRow } from './EntityCard';

const openCount = (hotel) => parseInt(hotel.openRequestsCount || 0, 10);
const activeCount = (hotel) => parseInt(hotel.activeGuestsCount || 0, 10);

const HotelCard = ({ data: hotel, navigate }) => {
  const primary = hotel.themeConfig?.primaryColor;
  const secondary = hotel.themeConfig?.secondaryColor;
  return (
    <EntityCard
      eyebrow={hotel.brand?.name}
      title={hotel.name}
      subtitle={hotel.address || 'No address'}
      subtitleIcon={LocationOnIcon}
      images={Array.isArray(hotel.images) ? hotel.images : []}
      gradient={primary ? `linear-gradient(135deg, ${primary} 0%, ${secondary || primary} 100%)` : undefined}
      accent={primary || 'var(--app-primary)'}
      borderColor={primary ? primary + '30' : undefined}
      stats={[
        { label: 'Check-in', value: hotel.checkInTime || '—', sub: 'Time' },
        { label: 'Open Req.', value: openCount(hotel), sub: 'Now' },
        { label: 'Active', value: activeCount(hotel), sub: 'Guests' },
      ]}
      openLabel="Open"
      onOpen={() => hotel?.id && navigate?.(`/hotels/${hotel.id}`)}
    />
  );
};

export default HotelCard;

/** Compact table row for ManageHotels table view. MapComponent-compatible. */
export function HotelTableRow({ data: hotel, navigate }) {
  const accent = hotel.themeConfig?.primaryColor || 'var(--app-primary)';
  const open = openCount(hotel);
  return (
    <EntityTableRow
      title={hotel.name}
      subtitle={hotel.address}
      avatarUrl={hotel.logoUrl}
      accent={accent}
      gridTemplateColumns="2fr 1fr 1fr auto"
      badge={open > 0 && <Chip label={`${open} open`} size="small" sx={{ fontSize: 10, height: 18, fontWeight: 700, bgcolor: STATUS_ERROR_BG, color: STATUS_ERROR, border: 'none', flexShrink: 0 }} />}
      columns={[
        { value: hotel.brand?.name || '—' },
        { value: `${hotel.checkInTime || '—'} / ${hotel.checkOutTime || '—'}`, strong: true },
      ]}
      actionLabel="Manage"
      onOpen={() => navigate?.(`/hotels/${hotel.id}`)}
    />
  );
}

/** Property pulse row for dashboard — avatar, name, active/arrivals/open columns. MapComponent-compatible. */
export function PropertyRow({ data: row, navigate }) {
  return (
    <Box onClick={() => navigate?.(`/hotels/${row.id}`)} sx={{ ...ROW_SX, display: 'grid', gridTemplateColumns: { xs: '1fr auto', md: '2fr 1fr 1fr 1fr' }, px: 2.5, py: { xs: 1.25, md: 1.75 }, alignItems: 'center', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Avatar src={row.logoUrl || undefined} sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, bgcolor: NAVY, flexShrink: 0 }}>
          {!row.logoUrl && row.name?.[0]?.toUpperCase()}
        </Avatar>
        <Typography sx={{ fontSize: { xs: 13, md: 13.5 }, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</Typography>
      </Box>
      <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
        {row.open > 0 && <Chip label={`${row.open} open req.`} size="small" sx={{ fontSize: 10, height: 18, fontWeight: 700, bgcolor: STATUS_ERROR_BG, color: STATUS_ERROR, border: 'none' }} />}
      </Box>
      <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: 14, fontWeight: 700, color: NAVY }}>{row.active}</Typography>
      <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: 14, fontWeight: 700, color: NAVY }}>{row.arrivals}</Typography>
      <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
        {row.open > 0
          ? <Chip label={row.open} size="small" sx={{ fontSize: 10, height: 20, fontWeight: 700, bgcolor: row.open > 5 ? STATUS_ERROR_BG : STATUS_WARNING_BG, color: row.open > 5 ? STATUS_ERROR : STATUS_WARNING, border: 'none' }} />
          : <Typography sx={{ fontSize: 13, color: MUTED }}>0</Typography>}
      </Box>
    </Box>
  );
}
