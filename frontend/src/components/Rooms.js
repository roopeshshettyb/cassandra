import { useEffect, useState } from 'react';
import { Box, MenuItem, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import ManageRooms from './ManageRooms';
import { PageHeader, CARD_SX, inputSx } from './cards/AppCards';
import { MUTED, NAVY, BORDER } from '../theme';

/**
 * Rooms & Inventory as its own top-level page, alongside Manage Hotels.
 *
 * Rooms belong to a hotel, so the hotel is picked here and everything below reacts
 * to it — rather than reaching this screen through a particular hotel, which is how
 * it worked when it lived as a tab on the hotel page.
 */
function Rooms({ loading, setLoading, account, alertSuccess, alertError }) {
  const [hotels, setHotels] = useState([]);
  const [hotelId, setHotelId] = useState('');

  useEffect(() => {
    (async () => {
      const res = await request({ endpoint: '/hotels', method: 'GET', setLoading, defaultData: [], alertError, setData: setHotels, delay: false });
      // Most staff are on a single property, so making them choose it every time is
      // friction for nothing. Anyone with more than one still picks.
      const list = res?.data || [];
      if (list.length === 1) {
        setHotelId(String(list[0].id));
      }
    })();
  }, []);

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="Rooms & Inventory"
          right={(
            <TextField
              select
              size="small"
              label="Hotel"
              value={hotelId}
              onChange={(e) => setHotelId(e.target.value)}
              sx={{ ...inputSx, minWidth: 260 }}
              InputLabelProps={{ shrink: true }}
              SelectProps={{
                displayEmpty: true,
                renderValue: (v) => (v === '' ? 'Select a hotel' : hotels.find((h) => String(h.id) === String(v))?.name || 'Select a hotel'),
              }}
            >
              {hotels.map((h) => (
                <MenuItem key={h.id} value={String(h.id)}>{h.name}</MenuItem>
              ))}
            </TextField>
          )}
        />

        {hotelId ? (
          // Keyed by hotel so switching hotels remounts it: ManageRooms loads its
          // room types and rooms once on mount, and every form and filter inside it
          // belongs to the hotel it was opened for.
          <ManageRooms
            key={hotelId}
            hotelId={Number(hotelId)}
            account={account}
            loading={loading}
            setLoading={setLoading}
            alertSuccess={alertSuccess}
            alertError={alertError}
          />
        ) : (
          <Box sx={{ ...CARD_SX, px: 3, py: 6, textAlign: 'center', border: `1px dashed ${BORDER}` }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Pick a hotel to begin</Typography>
            <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.75 }}>
              Room types, rooms and nightly inventory are managed per property.
            </Typography>
          </Box>
        )}
      </motion.div>
    </Box>
  );
}

export default Rooms;
