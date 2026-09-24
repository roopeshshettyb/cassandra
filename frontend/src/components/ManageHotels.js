import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import useListControls from '../helper/useListControls';
import DataGrid from './DataGrid';
import ListControls from './ListControls';
import MapComponent from './MapComponent';
import HotelCard, { HotelTableRow } from './cards/HotelCard';
import { ColumnLabel, CARD_SX, PageHeader, ViewToggle } from './cards/AppCards';
import { BRAND_GRADIENT, NAVY, BORDER, SHADOW, MUTED, PRIMARY_CONTRAST, BG } from '../theme';

import constants from '../constants.json';
import AddHotelOnboarding from './AddHotelOnboarding';

const TABLE_COLS = ['Property', 'Brand', 'Check-in / Check-out', ''];

function ManageHotels({ loading, setLoading, account, navigate, alertSuccess, alertError }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [view, setView] = useState('gallery');

  // Searching is the backend's job now, and so are the controls — see /hotels/filters.
  const list = useListControls({ endpoint: '/hotels', setLoading, alertError });
  const fetchHotels = () => list.refetch();

  const CAN_ADD_HOTEL = !!constants.PERMISSIONS.CAN_ADD_HOTEL[account?.role];

  // Same figure the endpoint used to report in meta: the open requests across the listed hotels.
  const openRequestsTotal = list.data.reduce((total, hotel) => total + Number(hotel.openRequestsCount || 0), 0);

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader title="Hotels" right={CAN_ADD_HOTEL && (
          <motion.button onClick={() => setShowAddForm(true)} whileTap={{ scale: 0.97 }}
            style={{ background: BRAND_GRADIENT, border: 'none', borderRadius: 10, padding: '10px 22px', color: PRIMARY_CONTRAST, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: SHADOW }}>
            + Add Hotel
          </motion.button>
        )} />

        {/* KPI Strip */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Properties', value: list.data.length },
            { label: 'Open Requests', value: openRequestsTotal },
          ].map(({ label, value }) => (
            <Box key={label} sx={{ ...CARD_SX, flex: '1 1 120px', p: 2 }}>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: NAVY }}>{value}</Typography>
              <Typography sx={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
            </Box>
          ))}
        </Box>

      </motion.div>

      <ListControls list={list} right={<ViewToggle view={view} onChange={setView} />} />

      <AddHotelOnboarding
        open={showAddForm && CAN_ADD_HOTEL}
        onClose={() => setShowAddForm(false)}
        onHotelCreated={() => { fetchHotels(); setShowAddForm(false); }}
        alertError={alertError}
        alertSuccess={alertSuccess}
      />

      {view === 'gallery'
        ? <DataGrid CardComponent={HotelCard} data={list.data} isLoading={loading} navigate={navigate} />
        : (
          <Box sx={{ ...CARD_SX }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', px: 2.5, py: 1.25, bgcolor: BG, borderBottom: `1px solid ${BORDER}` }}>
              <MapComponent Component={ColumnLabel} data={TABLE_COLS} showNoDataAvailable={false} />
            </Box>
            <MapComponent Component={HotelTableRow} data={list.data} isLoading={loading} navigate={navigate} />
          </Box>
        )
      }
    </Box>
  );
}

export default ManageHotels;
