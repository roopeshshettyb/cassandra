import { useEffect, useState } from 'react';
import { Box, Typography, MenuItem, TextField, Button, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { motion } from 'framer-motion';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import request from '../../helper/api';
import DataGrid from '../DataGrid';
import AiBookingCard from './AiBookingCard';
import { PageHeader } from '../cards/AppCards';
import { NAVY, MUTED, BORDER } from '../../theme';
import constants from '../../constants.json';

/**
 * Reservations the public AI agent gathered, per property. Read-only: the agent
 * captures the enquiry, the team confirms it out of band.
 */
function AiBookings({ loading, setLoading, alertError, alertSuccess }) {
  const [hotels, setHotels] = useState([]);
  const [hotelId, setHotelId] = useState('');
  const [conversations, setConversations] = useState([]);
  // Most visitors ask a question and leave, so conversations that captured a
  // booking would otherwise be buried under the ones that did not.
  const [showAll, setShowAll] = useState(false);

  const fetchEnquiries = (id) => {
    if (!id) return;
    request({
      endpoint: `/reservation/enquiries?hotelId=${id}`,
      method: 'GET',
      setLoading,
      setData: setConversations,
      defaultData: [],
      alertError,
      delay: false,
    });
  };

  useEffect(() => {
    request({
      endpoint: '/hotels',
      method: 'GET',
      setLoading,
      defaultData: [],
      alertError,
      delay: false,
    }).then((result) => {
      const rows = result?.data || [];
      setHotels(rows);
      if (rows.length > 0) {
        setHotelId(rows[0].id);
        fetchEnquiries(rows[0].id);
      }
    });
  }, []);

  const onHotelChange = (event) => {
    const id = event.target.value;
    setHotelId(id);
    setConversations([]);
    fetchEnquiries(id);
  };

  const shareLink = hotelId ? `${window.location.origin}/reservation/${hotelId}` : '';
  const booked = conversations.filter((row) => row.enquiries?.length > 0);
  const visible = showAll ? conversations : booked;

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title={constants.AI_BOOKINGS_TITLE}
          right={
            <TextField
              select
              size="small"
              value={hotelId}
              onChange={onHotelChange}
              sx={{ minWidth: 220 }}
              label={constants.AI_BOOKINGS_PROPERTY_LABEL}
            >
              {hotels.map((hotel) => (
                <MenuItem key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </MenuItem>
              ))}
            </TextField>
          }
        />
      </motion.div>

      {shareLink && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
            mb: 3,
            p: 2,
            borderRadius: 3,
            border: `1px dashed ${BORDER}`,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
              {constants.AI_BOOKINGS_SHARE_TITLE}
            </Typography>
            <Typography noWrap sx={{ fontSize: 12, color: MUTED, mt: 0.3 }}>
              {shareLink}
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<ContentCopyIcon sx={{ fontSize: 16 }} />}
            onClick={() => {
              navigator.clipboard?.writeText(shareLink);
              alertSuccess?.(constants.AI_BOOKINGS_LINK_COPIED);
            }}
            sx={{ textTransform: 'none', color: NAVY }}
          >
            {constants.AI_BOOKINGS_COPY_LINK}
          </Button>
        </Box>
      )}

      {!loading && conversations.length > 0 && (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={showAll ? 'all' : 'booked'}
          onChange={(event, next) => next && setShowAll(next === 'all')}
          sx={{ mb: 2.5 }}
        >
          <ToggleButton value="booked" sx={{ textTransform: 'none', px: 2 }}>
            {constants.AI_BOOKINGS_FILTER_BOOKED} ({booked.length})
          </ToggleButton>
          <ToggleButton value="all" sx={{ textTransform: 'none', px: 2 }}>
            {constants.AI_BOOKINGS_FILTER_ALL} ({conversations.length})
          </ToggleButton>
        </ToggleButtonGroup>
      )}

      <DataGrid CardComponent={AiBookingCard} data={visible} isLoading={loading} />
    </Box>
  );
}

export default AiBookings;
