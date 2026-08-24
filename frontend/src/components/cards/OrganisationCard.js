import { Avatar, Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import { NAVY, NAVY_GRADIENT, MUTED, BORDER, SHADOW, SHADOW_HOVER, NAVY_CONTRAST } from '../../theme';
import { CARD_SX, ROW_SX, LABEL_SX, StatBox } from './AppCards';
import constants from '../../constants.json';

const labels = constants.ORGANISATIONS;
const memberCount = (organisation) => parseInt(organisation.memberCount || 0, 10);

/**
 * Deliberately the same shape as HotelCard — hero, eyebrow, name, stat row, an
 * Open button into the detail page — so the two lists read as one product.
 * Organisations have no photos or theme, so the hero is the initial on the
 * standard navy gradient, which is exactly HotelCard's own no-images fallback.
 */
const OrganisationCard = ({ data, navigate }) => {
  const organisation = data;
  if (!organisation) return null;

  return (
    <motion.div whileTap={{ scale: 0.98 }} whileHover={{ y: -3 }} transition={{ duration: 0.15 }} style={{ width: '100%' }}>
      <Box
        sx={{
          ...CARD_SX,
          border: `1px solid ${BORDER}`,
          boxShadow: SHADOW,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          '@media (hover: hover)': {
            '&:hover': { boxShadow: SHADOW_HOVER },
          },
        }}
      >
        <Box sx={{ height: 150, background: NAVY_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 56, fontWeight: 900, color: 'rgba(255,255,255,0.35)', userSelect: 'none' }}>
            {organisation.name?.[0]?.toUpperCase()}
          </Typography>
        </Box>

        <Box sx={{ px: 2.5, pt: 2, pb: 1.75, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ ...LABEL_SX, fontSize: 9.5, color: MUTED, mb: 0.5 }}>{labels.PAGE_EYEBROW}</Typography>

          <Typography
            sx={{
              fontWeight: 800,
              fontSize: 17,
              color: NAVY,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {organisation.name}
          </Typography>

          <Typography
            sx={{
              fontSize: 11,
              color: MUTED,
              mt: 0.75,
              mb: 1.75,
              minHeight: 16,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {organisation.description || labels.NO_DESCRIPTION_LABEL}
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, mb: 1.75 }}>
            <StatBox label={labels.MEMBERS_LABEL} value={memberCount(organisation)} sub={labels.MEMBERS_SUB_LABEL} />
            <StatBox label={labels.ID_LABEL} value={`#${organisation.id}`} sub={labels.ID_SUB_LABEL} />
          </Box>

          <Box sx={{ mt: 'auto', pt: 1.5, borderTop: `1px solid ${BORDER}` }}>
            <Box
              component="button"
              onClick={() => organisation?.id && navigate?.(`/organisations/${organisation.id}`)}
              sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                border: 'none',
                borderRadius: 2,
                py: 0.9,
                background: NAVY_GRADIENT,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                color: NAVY_CONTRAST,
                '&:hover': { opacity: 0.92 },
              }}
            >
              {labels.OPEN_BUTTON_LABEL}
              <ArrowForwardIosIcon sx={{ fontSize: 10 }} />
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
};

export default OrganisationCard;

/** Compact table row for the ManageOrganisations table view. MapComponent-compatible. */
export function OrganisationTableRow({ data: organisation, navigate }) {
  const accent = 'var(--app-primary)';
  return (
    <Box
      onClick={() => navigate?.(`/organisations/${organisation.id}`)}
      sx={{ ...ROW_SX, display: 'grid', gridTemplateColumns: '2fr 1fr auto', px: 2.5, py: 1.75, alignItems: 'center', gap: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Avatar sx={{ width: 36, height: 36, fontSize: 14, fontWeight: 700, bgcolor: accent, flexShrink: 0 }}>
          {organisation.name?.[0]?.toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {organisation.name}
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {organisation.description || '—'}
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: 13, color: MUTED }}>
        {memberCount(organisation)} {labels.MEMBERS_LABEL.toLowerCase()}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: accent }}>{labels.MANAGE_BUTTON_LABEL}</Typography>
        <ArrowForwardIosIcon sx={{ fontSize: 9, color: accent }} />
      </Box>
    </Box>
  );
}
