import { Box, Typography, IconButton, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import { NAVY, MUTED, BORDER, BG, STATUS_SUCCESS, STATUS_SUCCESS_BG, HOVER_BG } from '../../theme';
import { CARD_SX } from './AppCards';
import constants from '../../constants.json';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

/**
 * One organisation in the gallery. Mirrors HotelCard's shape so the two lists
 * read as the same product rather than two designs.
 */
function OrganisationCard({ data: organisation, onEdit, onDelete }) {
  if (!organisation) return null;

  // StatusChip maps request statuses and would fall through to a neutral chip
  // for these two, so active reads as green here rather than as "unknown".
  const labels = constants.ORGANISATIONS;
  const isActive = organisation.status === 'active';
  const statusLabel = isActive ? labels.STATUS_ACTIVE_LABEL : labels.STATUS_DISABLED_LABEL;

  const contacts = [
    { key: 'email', Icon: EmailIcon, value: organisation.contactEmail },
    { key: 'phone', Icon: PhoneIcon, value: organisation.contactPhone },
  ].filter((c) => !!c.value);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ height: '100%' }}>
      <Box sx={{ ...CARD_SX, display: 'flex', flexDirection: 'column', height: '100%', p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              bgcolor: BG,
              border: `1px solid ${BORDER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BusinessIcon sx={{ fontSize: 19, color: MUTED }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {organisation.name}
            </Typography>
            <Chip
              label={statusLabel}
              size="small"
              sx={{
                fontSize: 10,
                height: 20,
                fontWeight: 700,
                mt: 0.4,
                border: 'none',
                bgcolor: isActive ? STATUS_SUCCESS_BG : HOVER_BG,
                color: isActive ? STATUS_SUCCESS : MUTED,
              }}
            />
          </Box>
        </Box>

        {organisation.description && (
          <Typography
            sx={{
              fontSize: 12,
              color: MUTED,
              mb: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {organisation.description}
          </Typography>
        )}

        {contacts.map(({ key, Icon, value }) => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, minWidth: 0 }}>
            <Icon sx={{ fontSize: 13, color: MUTED, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value}
            </Typography>
          </Box>
        ))}

        <Box sx={{ pt: 1.5, mt: 'auto', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <PeopleIcon sx={{ fontSize: 14, color: MUTED }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{organisation.memberCount ?? 0}</Typography>
            <Typography sx={{ fontSize: 12, color: MUTED }}>members</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {onEdit && (
              <IconButton size="small" onClick={() => onEdit(organisation)} aria-label="Edit organisation">
                <EditIcon sx={{ fontSize: 16, color: MUTED }} />
              </IconButton>
            )}
            {onDelete && (
              <IconButton size="small" onClick={() => onDelete(organisation)} aria-label="Delete organisation">
                <DeleteOutlineIcon sx={{ fontSize: 16, color: MUTED }} />
              </IconButton>
            )}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

export default OrganisationCard;
