import { Box, Typography, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import { NAVY, MUTED, BORDER, BG } from '../../theme';
import { CARD_SX } from './AppCards';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import constants from '../../constants.json';

const labels = constants.ORGANISATIONS;

/**
 * One organisation in the gallery. Mirrors HotelCard's shape so the two lists
 * read as the same product rather than two designs.
 */
function OrganisationCard({ data: organisation, onEdit, onDelete }) {
  if (!organisation) return null;

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
          <Typography
            sx={{
              fontSize: 15,
              fontWeight: 800,
              color: NAVY,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {organisation.name}
          </Typography>
        </Box>

        {organisation.description && (
          <Typography
            sx={{
              fontSize: 12,
              color: MUTED,
              mb: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {organisation.description}
          </Typography>
        )}

        <Box sx={{ pt: 1.5, mt: 'auto', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <PeopleIcon sx={{ fontSize: 14, color: MUTED }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: NAVY }}>{organisation.memberCount ?? 0}</Typography>
            <Typography sx={{ fontSize: 12, color: MUTED }}>{labels.MEMBERS_LABEL.toLowerCase()}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {onEdit && (
              <IconButton size="small" onClick={() => onEdit(organisation)} aria-label={labels.EDIT_TITLE}>
                <EditIcon sx={{ fontSize: 16, color: MUTED }} />
              </IconButton>
            )}
            {onDelete && (
              <IconButton size="small" onClick={() => onDelete(organisation)} aria-label={labels.DELETE_TITLE}>
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
