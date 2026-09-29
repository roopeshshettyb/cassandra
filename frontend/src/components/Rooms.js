import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { BedOutlined, MeetingRoomOutlined, CalendarMonthOutlined, EventAvailableOutlined } from '@mui/icons-material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import ManageRooms from './ManageRooms';
import HotelPicker from './HotelPicker';
import { DetailTabBar } from './DetailShell';
import { PageHeader, CARD_SX, inputSx } from './cards/AppCards';
import { MUTED, NAVY, BORDER } from '../theme';

const TABS = [
  { key: 'types', label: 'Room types', Icon: BedOutlined },
  { key: 'rooms', label: 'Rooms', Icon: MeetingRoomOutlined },
  { key: 'inventory', label: 'Inventory', Icon: CalendarMonthOutlined },
  { key: 'availability', label: 'Availability', Icon: EventAvailableOutlined },
];

function Rooms({ loading, setLoading, account, alertSuccess, alertError, isMobile }) {
  const [hotels, setHotels] = useState([]);
  const [hotelId, setHotelId] = useState('');
  // Kept here so the open tab survives ManageRooms remounting on a hotel switch.
  const [tab, setTab] = useState('types');

  useEffect(() => {
    request({ endpoint: '/hotels', method: 'GET', defaultData: [], alertError, setData: setHotels });
  }, []);

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="Rooms & Inventory"
          right={(
            <HotelPicker hotels={hotels} value={hotelId} onChange={setHotelId} sx={{ ...inputSx, width: { xs: '100%', sm: 300 } }} />
          )}
        />

        {hotelId ? (
          <>
            <DetailTabBar tabs={TABS} active={tab} onChange={setTab} />
            {/* Keyed by hotel so switching hotels reloads everything. */}
            <ManageRooms
              key={hotelId}
              hotelId={Number(hotelId)}
              tab={tab}
              isMobile={isMobile}
              account={account}
              loading={loading}
              setLoading={setLoading}
              alertSuccess={alertSuccess}
              alertError={alertError}
            />
          </>
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
