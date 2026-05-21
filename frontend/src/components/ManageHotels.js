import { useEffect, useState } from 'react';
import { Box, Typography, TextField, IconButton, InputAdornment } from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import TableRowsIcon from '@mui/icons-material/TableRows';
import SearchIcon from '@mui/icons-material/Search';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import MapComponent from './MapComponent';
import HotelCard, { HotelTableRow } from './cards/HotelCard';
import { ColumnLabel, CARD_SX } from './cards/AppCards';
import { BRAND_GRADIENT, NAVY, BORDER, SHADOW, MUTED, PRIMARY_CONTRAST, BG } from '../theme';
import constants from '../constants.json';
import AddHotelOnboarding from './AddHotelOnboarding';

const TABLE_COLS = ['Property', 'Brand', 'Check-in / Check-out', ''];

function ManageHotels({ loading, setLoading, account, navigate, alertSuccess, alertError }) {
  const [hotels, setHotels] = useState([]);
  const [openRequestsTotal, setOpenRequestsTotal] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [view, setView] = useState('gallery');
  const [search, setSearch] = useState('');

  const fetchHotels = async () => {
    const res = await request({ endpoint: '/hotels', method: 'GET', setLoading, defaultData: [], alertError, setData: setHotels, delay: false });
    setOpenRequestsTotal(res?.meta?.totalOpenRequests ?? 0);
  };

  useEffect(() => {
    if (account) fetchHotels();
  }, [account]);

  const CAN_ADD_HOTEL = !!constants.PERMISSIONS.CAN_ADD_HOTEL[account?.role];

  const visible = search
    ? hotels.filter(h => h.name?.toLowerCase().includes(search.toLowerCase()) || h.address?.toLowerCase().includes(search.toLowerCase()))
    : hotels;

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: { xs: 'flex-end', sm: 'space-between' }, mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main', mb: 0.5 }}>Management</Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY }}>Hotels</Typography>
          </Box>
          {CAN_ADD_HOTEL && (
            <motion.button
              onClick={() => setShowAddForm(true)}
              whileTap={{ scale: 0.97 }}
              style={{ background: BRAND_GRADIENT, border: 'none', borderRadius: 10, padding: '10px 22px', color: PRIMARY_CONTRAST, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: SHADOW }}
            >
              + Add Hotel
            </motion.button>
          )}
        </Box>

        {/* KPI Strip */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Properties', value: hotels.length },
            { label: 'Open Requests', value: openRequestsTotal },
          ].map(({ label, value }) => (
            <Box key={label} sx={{ ...CARD_SX, flex: '1 1 120px', p: 2 }}>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: NAVY }}>{value}</Typography>
              <Typography sx={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Filter rail */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search by name or address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: MUTED }} /></InputAdornment> }}
            sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2.5, fontSize: 13 } }}
          />
          <Box sx={{ display: 'flex', gap: 0.5, bgcolor: BG, borderRadius: 2, p: 0.5, flexShrink: 0 }}>
            <IconButton size="small" onClick={() => setView('gallery')} sx={{ borderRadius: 1.5, bgcolor: view === 'gallery' ? 'background.paper' : 'transparent', boxShadow: view === 'gallery' ? SHADOW : 'none' }}>
              <GridViewIcon sx={{ fontSize: 18, color: view === 'gallery' ? NAVY : MUTED }} />
            </IconButton>
            <IconButton size="small" onClick={() => setView('table')} sx={{ borderRadius: 1.5, bgcolor: view === 'table' ? 'background.paper' : 'transparent', boxShadow: view === 'table' ? SHADOW : 'none' }}>
              <TableRowsIcon sx={{ fontSize: 18, color: view === 'table' ? NAVY : MUTED }} />
            </IconButton>
          </Box>
        </Box>
      </motion.div>

      <AddHotelOnboarding
        open={showAddForm && CAN_ADD_HOTEL}
        onClose={() => setShowAddForm(false)}
        onHotelCreated={() => { fetchHotels(); setShowAddForm(false); }}
        alertError={alertError}
        alertSuccess={alertSuccess}
      />

      {view === 'gallery'
        ? <DataGrid CardComponent={HotelCard} data={visible} isLoading={loading} navigate={navigate} />
        : (
          <Box sx={{ ...CARD_SX }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', px: 2.5, py: 1.25, bgcolor: BG, borderBottom: `1px solid ${BORDER}` }}>
              <MapComponent Component={ColumnLabel} data={TABLE_COLS} showNoDataAvailable={false} />
            </Box>
            <MapComponent Component={HotelTableRow} data={visible} isLoading={loading} navigate={navigate} />
          </Box>
        )
      }
    </Box>
  );
}

export default ManageHotels;
