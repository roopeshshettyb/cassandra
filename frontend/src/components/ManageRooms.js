import { useEffect, useState } from 'react';
import { Box, Typography, TextField, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, MenuItem as MuiMenuItem } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import MapComponent from './MapComponent';
import { CARD_SX, ROW_SX, ColumnLabel } from './cards/AppCards';
import { NAVY, MUTED, BORDER, BG, BRAND_GRADIENT, STATUS_ERROR, STATUS_ERROR_BG, STATUS_SUCCESS, STATUS_SUCCESS_BG, STATUS_WARNING, STATUS_WARNING_BG } from '../theme';
import constants from '../constants.json';

const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } };
const noSpinnerSx = {
  ...inputSx,
  '& input[type=number]': { MozAppearance: 'textfield' },
  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
};

const ROOM_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'out_of_service', label: 'Out of service' },
];

const STATUS_COLOURS = {
  active: { fg: STATUS_SUCCESS, bg: STATUS_SUCCESS_BG },
  maintenance: { fg: STATUS_WARNING, bg: STATUS_WARNING_BG },
  out_of_service: { fg: STATUS_ERROR, bg: STATUS_ERROR_BG },
};

const TYPE_COLS = ['Room type', 'Max occupancy', 'Total rooms', ''];
const TYPE_GRID = '2fr 1fr 1fr 130px';
const ROOM_COLS = ['Room number', 'Room type', 'Status', ''];
const ROOM_GRID = '1.5fr 1.5fr 1fr 130px';
const INVENTORY_COLS = ['Date', 'Total', 'Reserved', 'Blocked', 'Available'];
const INVENTORY_GRID = '1.6fr 1fr 1fr 1fr 1fr';
const AVAILABILITY_COLS = ['Room type', 'Max occupancy', 'Available'];
const AVAILABILITY_GRID = '2fr 1fr 1fr';

// Mirrors ROOM_TYPE_IMAGES_MAX_COUNT in the backend constants service, which is the
// one that actually enforces this. Kept here only to grey out the button before an
// upload starts — without it the file would reach S3 and then be rejected, leaving
// an orphaned object behind. Change both together.
const ROOM_TYPE_IMAGES_MAX = 8;

const RoomTypeImage = ({ data: url, onRemove }) => (
  <Box sx={{ position: 'relative', width: 96, height: 72, borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
    <Box component="img" src={url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    <Box
      component="button"
      type="button"
      onClick={() => onRemove?.(url)}
      sx={{
        position: 'absolute', top: 2, right: 2, width: 20, height: 20, lineHeight: 1,
        border: 'none', borderRadius: '50%', cursor: 'pointer',
        bgcolor: STATUS_ERROR, color: '#fff', fontSize: 12, fontWeight: 700,
      }}
    >
      ×
    </Box>
  </Box>
);

const defaultTypeForm = { name: '', maxOccupancy: '', totalRooms: '', perks: '' };
const defaultRoomForm = { roomNumber: '', roomTypeId: '', status: 'active' };

const toDateInput = date => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date, days) => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
};

// The desktop sidebar is fixed at 20vw and stacks above dialogs, so a form centred on
// the whole window slides underneath it on narrower screens. Centring it in the content
// area instead, as ManageBookings does for its New Booking form, keeps it clear.
const dialogSx = isMobile => ({ '& .MuiDialog-container': { pl: isMobile ? 0 : '20vw' } });

const TODAY = toDateInput(new Date());
const IN_A_WEEK = toDateInput(addDays(new Date(), 7));

const ActionButtons = ({ onEdit, onDelete }) => (
  <Box sx={{ display: 'flex', gap: 1, mt: { xs: 1, md: 0 } }}>
    <Box component="button" onClick={e => { e.stopPropagation(); onEdit(); }}
      sx={{ border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: NAVY, px: 1.5, py: 0.5, borderRadius: 1, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
      Edit
    </Box>
    <Box component="button" onClick={e => { e.stopPropagation(); onDelete(); }}
      sx={{ border: `1px solid ${STATUS_ERROR_BG}`, bgcolor: 'transparent', color: STATUS_ERROR, px: 1.5, py: 0.5, borderRadius: 1, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
      Delete
    </Box>
  </Box>
);

const RoomTypeRow = ({ data: roomType, onEdit, onDelete, canManage }) => {
  const actions = canManage && <ActionButtons onEdit={() => onEdit?.(roomType)} onDelete={() => onDelete?.(roomType)} />;
  return (
    <>
      <Box sx={{ ...ROW_SX, display: { xs: 'none', md: 'grid' }, gridTemplateColumns: TYPE_GRID, px: 2.5, py: 1.5, alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{roomType.name}</Typography>
        <Typography sx={{ fontSize: 12, color: MUTED }}>{roomType.maxOccupancy} guests</Typography>
        <Typography sx={{ fontSize: 12, color: NAVY, fontWeight: 600 }}>{roomType.totalRooms}</Typography>
        {actions}
      </Box>
      <Box sx={{ display: { xs: 'block', md: 'none' }, px: 2, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{roomType.name}</Typography>
        <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>
          Sleeps {roomType.maxOccupancy} · {roomType.totalRooms} rooms
        </Typography>
        {actions}
      </Box>
    </>
  );
};

const RoomRow = ({ data: room, onEdit, onDelete, canManage }) => {
  const colours = STATUS_COLOURS[room.status] || { fg: MUTED, bg: BG };
  const label = ROOM_STATUSES.find(s => s.value === room.status)?.label || room.status;
  const actions = canManage && <ActionButtons onEdit={() => onEdit?.(room)} onDelete={() => onDelete?.(room)} />;
  const chip = (
    <Typography sx={{ fontSize: 11, fontWeight: 700, color: colours.fg, bgcolor: colours.bg, px: 1, py: 0.25, borderRadius: 1, display: 'inline-block' }}>
      {label}
    </Typography>
  );
  return (
    <>
      <Box sx={{ ...ROW_SX, display: { xs: 'none', md: 'grid' }, gridTemplateColumns: ROOM_GRID, px: 2.5, py: 1.5, alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{room.roomNumber}</Typography>
        <Typography sx={{ fontSize: 12, color: MUTED }}>{room.roomType?.name || '—'}</Typography>
        <Box>{chip}</Box>
        {actions}
      </Box>
      <Box sx={{ display: { xs: 'block', md: 'none' }, px: 2, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{room.roomNumber}</Typography>
          {chip}
        </Box>
        <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>{room.roomType?.name || '—'}</Typography>
        {actions}
      </Box>
    </>
  );
};

// available = total - reserved - blocked, exactly as the backend derives it. Zero
// is called out in red because it is what makes the whole stay unbookable, even
// when every other night in the range has rooms left.
const InventoryRow = ({ data: night }) => {
  const soldOut = night.available <= 0;
  return (
    <>
      <Box sx={{ ...ROW_SX, display: { xs: 'none', md: 'grid' }, gridTemplateColumns: INVENTORY_GRID, px: 2.5, py: 1.25, alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{night.date}</Typography>
        <Typography sx={{ fontSize: 12, color: MUTED }}>{night.total}</Typography>
        <Typography sx={{ fontSize: 12, color: MUTED }}>{night.reserved}</Typography>
        <Typography sx={{ fontSize: 12, color: MUTED }}>{night.blocked}</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: soldOut ? STATUS_ERROR : STATUS_SUCCESS }}>{night.available}</Typography>
      </Box>
      <Box sx={{ display: { xs: 'block', md: 'none' }, px: 2, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{night.date}</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: soldOut ? STATUS_ERROR : STATUS_SUCCESS }}>
            {night.available} available
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>
          {night.total} total · {night.reserved} reserved · {night.blocked} blocked
        </Typography>
      </Box>
    </>
  );
};

const AvailabilityRow = ({ data: roomType }) => (
  <>
    <Box sx={{ ...ROW_SX, display: { xs: 'none', md: 'grid' }, gridTemplateColumns: AVAILABILITY_GRID, px: 2.5, py: 1.25, alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{roomType.name}</Typography>
      <Typography sx={{ fontSize: 12, color: MUTED }}>{roomType.maxOccupancy} guests</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: STATUS_SUCCESS }}>{roomType.available}</Typography>
    </Box>
    <Box sx={{ display: { xs: 'block', md: 'none' }, px: 2, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{roomType.name}</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: STATUS_SUCCESS }}>{roomType.available} free</Typography>
      </Box>
      <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>Sleeps {roomType.maxOccupancy}</Typography>
    </Box>
  </>
);

const SectionHeader = ({ title, subtitle, action }) => (
  <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
    <Box>
      <Typography sx={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{title}</Typography>
      <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>{subtitle}</Typography>
    </Box>
    {action}
  </Box>
);

const PrimaryButton = ({ children, onClick, type }) => (
  <Box component="button" type={type || 'button'} onClick={onClick}
    sx={{ border: 'none', background: BRAND_GRADIENT, color: 'var(--app-primary-contrast)', px: 2, py: 0.9, borderRadius: 1.5, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
    {children}
  </Box>
);

function ManageRooms({ hotelId, tab, isMobile, account, loading, setLoading, alertSuccess, alertError }) {
  const canManage = !!constants.PERMISSIONS.CAN_MANAGE_ROOMS[account?.role];

  const [roomTypes, setRoomTypes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [availability, setAvailability] = useState([]);

  const [showTypeForm, setShowTypeForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [typeForm, setTypeForm] = useState(defaultTypeForm);
  const [editingTypeImages, setEditingTypeImages] = useState([]);
  const [roomForm, setRoomForm] = useState(defaultRoomForm);

  const [inventoryFilter, setInventoryFilter] = useState({ roomTypeId: '', startDate: TODAY, endDate: IN_A_WEEK });
  const [stockForm, setStockForm] = useState({ total: '', blocked: '' });
  const [searchForm, setSearchForm] = useState({ startDate: TODAY, endDate: IN_A_WEEK, guests: 2, rooms: 1 });

  const fetchRoomTypes = () => request({
    endpoint: `/rooms/types?hotelId=${hotelId}`,
    method: 'GET', setLoading, setData: setRoomTypes, defaultData: [], alertError,
  });

  const fetchRooms = () => request({
    endpoint: `/rooms?hotelId=${hotelId}`,
    method: 'GET', setLoading, setData: setRooms, defaultData: [], alertError,
  });

  useEffect(() => { fetchRoomTypes(); fetchRooms(); }, []);

  const handleTypeChange = field => e => setTypeForm(prev => ({ ...prev, [field]: e.target.value }));
  const handleRoomChange = field => e => setRoomForm(prev => ({ ...prev, [field]: e.target.value }));
  const handleFilterChange = field => e => setInventoryFilter(prev => ({ ...prev, [field]: e.target.value }));
  const handleStockChange = field => e => setStockForm(prev => ({ ...prev, [field]: e.target.value }));
  const handleSearchChange = field => e => setSearchForm(prev => ({ ...prev, [field]: e.target.value }));

  const openAddType = () => { setEditingType(null); setTypeForm(defaultTypeForm); setEditingTypeImages([]); setShowTypeForm(true); };
  const openEditType = roomType => {
    setEditingType(roomType);
    setTypeForm({ name: roomType.name || '', maxOccupancy: roomType.maxOccupancy ?? '', totalRooms: roomType.totalRooms ?? '', perks: (roomType.perks || []).join(', ') });
    setEditingTypeImages(roomType.images || []);
    setShowTypeForm(true);
  };

  const openAddRoom = () => { setEditingRoom(null); setRoomForm(defaultRoomForm); setShowRoomForm(true); };
  const openEditRoom = room => {
    setEditingRoom(room);
    setRoomForm({ roomNumber: room.roomNumber || '', roomTypeId: room.roomTypeId ?? '', status: room.status || 'active' });
    setShowRoomForm(true);
  };

  /**
   * Presigned URL, then a raw PUT straight to S3, then tell the backend the URL.
   *
   * The PUT is the one place raw fetch is correct — it goes to S3, not to us, so
   * api.js has nothing to add. The loader is held across all three steps since the
   * middle one carries none of its own.
   */
  const uploadTypeImage = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editingType) return;

    setLoading(true);
    try {
      const presigned = await request({
        endpoint: `/rooms/types/${editingType.id}/images/presigned-url`,
        method: 'POST',
        data: { fileName: file.name, fileSize: file.size, contentType: file.type },
        alertError,
      });
      const { presignedUrl, s3Url } = presigned?.data || {};
      if (!presignedUrl) return;

      const put = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) { alertError?.(`Upload failed (${put.status})`); return; }

      const res = await request({
        endpoint: `/rooms/types/${editingType.id}/images`,
        method: 'POST',
        data: { s3Url },
        alertSuccess, alertError,
      });
      if (res?.success) { setEditingTypeImages(res.data?.images || []); fetchRoomTypes(); }
    } finally {
      setLoading(false);
    }
  };

  const removeTypeImage = async url => {
    const res = await request({
      endpoint: `/rooms/types/${editingType.id}/images`,
      method: 'DELETE',
      data: { s3Url: url },
      setLoading, alertSuccess, alertError,
    });
    if (res?.success) { setEditingTypeImages(res.data?.images || []); fetchRoomTypes(); }
  };

  const submitType = async e => {
    e.preventDefault();
    const maxOccupancy = parseInt(typeForm.maxOccupancy, 10);
    const totalRooms = parseInt(typeForm.totalRooms, 10);
    if (!typeForm.name || isNaN(maxOccupancy) || isNaN(totalRooms)) { alertError?.('Name, max occupancy and total rooms are required'); return; }

    const payload = {
      name: typeForm.name,
      maxOccupancy,
      totalRooms,
      // Typed as a comma-separated line, stored as an array.
      perks: typeForm.perks.split(',').map(p => p.trim()).filter(Boolean),
    };
    const res = await request({
      endpoint: editingType ? `/rooms/types/${editingType.id}` : '/rooms/types',
      method: editingType ? 'PATCH' : 'POST',
      data: editingType ? payload : { hotelId: Number(hotelId), ...payload },
      setLoading, alertSuccess, alertError,
    });
    if (res?.success) { setShowTypeForm(false); fetchRoomTypes(); }
  };

  const submitRoom = async e => {
    e.preventDefault();
    if (!roomForm.roomNumber || !roomForm.roomTypeId) { alertError?.('Room number and room type are required'); return; }

    const payload = { roomNumber: roomForm.roomNumber, status: roomForm.status };
    const res = await request({
      endpoint: editingRoom ? `/rooms/${editingRoom.id}` : '/rooms',
      method: editingRoom ? 'PATCH' : 'POST',
      data: editingRoom ? payload : { hotelId: Number(hotelId), roomTypeId: Number(roomForm.roomTypeId), ...payload },
      setLoading, alertSuccess, alertError,
    });
    if (res?.success) { setShowRoomForm(false); fetchRooms(); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const isType = deleteTarget.kind === 'type';
    const res = await request({
      endpoint: isType ? `/rooms/types/${deleteTarget.item.id}` : `/rooms/${deleteTarget.item.id}`,
      method: 'DELETE', setLoading, alertSuccess, alertError,
    });
    if (res?.success) {
      setShowDelete(false);
      if (isType) {
        fetchRoomTypes();
        // The Inventory tab would otherwise keep asking for the type just deleted.
        if (String(inventoryFilter.roomTypeId) === String(deleteTarget.item.id)) {
          setInventoryFilter(prev => ({ ...prev, roomTypeId: '' }));
          setInventory([]);
        }
      }
      fetchRooms();
    }
  };

  const loadInventory = async () => {
    if (!inventoryFilter.roomTypeId) { alertError?.('Pick a room type first'); return; }
    await request({
      endpoint: `/rooms/inventory?roomTypeId=${inventoryFilter.roomTypeId}&startDate=${inventoryFilter.startDate}&endDate=${inventoryFilter.endDate}`,
      method: 'GET', setLoading, setData: setInventory, defaultData: [], alertError,
    });
  };

  const saveStock = async () => {
    if (!inventoryFilter.roomTypeId) { alertError?.('Pick a room type first'); return; }
    const total = stockForm.total === '' ? undefined : parseInt(stockForm.total, 10);
    const blocked = stockForm.blocked === '' ? undefined : parseInt(stockForm.blocked, 10);
    if (total === undefined && blocked === undefined) { alertError?.('Enter a total, a blocked count, or both'); return; }

    const res = await request({
      endpoint: '/rooms/inventory', method: 'PATCH',
      data: {
        roomTypeId: Number(inventoryFilter.roomTypeId),
        startDate: inventoryFilter.startDate,
        endDate: inventoryFilter.endDate,
        total, blocked,
      },
      // No setData: api.js empties the list on a failed request, and a refused
      // update leaves the nights exactly as they were, so they should stay shown.
      setLoading, alertSuccess, alertError,
    });
    if (res?.success) { setInventory(res.data || []); setStockForm({ total: '', blocked: '' }); }
  };

  const search = async () => {
    await request({
      endpoint: `/rooms/availability?hotelId=${hotelId}&startDate=${searchForm.startDate}&endDate=${searchForm.endDate}&guests=${searchForm.guests}&rooms=${searchForm.rooms}`,
      method: 'GET', setLoading, setData: setAvailability, defaultData: [], alertError,
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      {/* Room types */}
      {tab === 'types' && (
        <Box sx={{ ...CARD_SX, mb: 2 }}>
          <SectionHeader
            title="Room types"
            subtitle="Deluxe King, Twin, and so on. Total rooms is what each night is stocked with."
            action={canManage && <PrimaryButton onClick={openAddType}>+ Add room type</PrimaryButton>}
          />
          <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: TYPE_GRID, px: 2.5, py: 1.25, bgcolor: BG, borderBottom: `1px solid ${BORDER}` }}>
            <MapComponent Component={ColumnLabel} data={TYPE_COLS} showNoDataAvailable={false} />
          </Box>
          <MapComponent Component={RoomTypeRow} data={roomTypes} isLoading={loading} canManage={canManage}
            onEdit={openEditType} onDelete={item => { setDeleteTarget({ kind: 'type', item }); setShowDelete(true); }} />
        </Box>
      )}

      {/* Physical rooms */}
      {tab === 'rooms' && (
        <Box sx={{ ...CARD_SX, mb: 2 }}>
          <SectionHeader
            title="Rooms"
            subtitle="The physical rooms guests are assigned to when a booking is made."
            action={canManage && <PrimaryButton onClick={openAddRoom}>+ Add room</PrimaryButton>}
          />
          <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: ROOM_GRID, px: 2.5, py: 1.25, bgcolor: BG, borderBottom: `1px solid ${BORDER}` }}>
            <MapComponent Component={ColumnLabel} data={ROOM_COLS} showNoDataAvailable={false} />
          </Box>
          <MapComponent Component={RoomRow} data={rooms} isLoading={loading} canManage={canManage}
            onEdit={openEditRoom} onDelete={item => { setDeleteTarget({ kind: 'room', item }); setShowDelete(true); }} />
        </Box>
      )}

      {/* Dated inventory */}
      {tab === 'inventory' && (
        <Box sx={{ ...CARD_SX, mb: 2 }}>
          <SectionHeader
            title="Inventory calendar"
            subtitle="Rooms sellable per night. Available is total minus reserved minus blocked."
          />
          <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${BORDER}`, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr auto' }, gap: 1.5, alignItems: 'center' }}>
            <TextField size="small" select label="Room type" value={inventoryFilter.roomTypeId} onChange={handleFilterChange('roomTypeId')} sx={inputSx}>
              {roomTypes.map(rt => <MuiMenuItem key={rt.id} value={rt.id}>{rt.name}</MuiMenuItem>)}
            </TextField>
            <TextField size="small" type="date" label="From" value={inventoryFilter.startDate} onChange={handleFilterChange('startDate')} InputLabelProps={{ shrink: true }} sx={inputSx} />
            <TextField size="small" type="date" label="To" value={inventoryFilter.endDate} onChange={handleFilterChange('endDate')} InputLabelProps={{ shrink: true }} sx={inputSx} />
            <PrimaryButton onClick={loadInventory}>Show nights</PrimaryButton>
          </Box>

          {canManage && (
            <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${BORDER}`, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto' }, gap: 1.5, alignItems: 'center' }}>
              <TextField size="small" type="number" label="Set total" placeholder="Leave blank to keep" inputProps={{ min: 0 }} value={stockForm.total} onChange={handleStockChange('total')} InputLabelProps={{ shrink: true }} sx={noSpinnerSx} />
              <TextField size="small" type="number" label="Set blocked" placeholder="Leave blank to keep" inputProps={{ min: 0 }} value={stockForm.blocked} onChange={handleStockChange('blocked')} InputLabelProps={{ shrink: true }} sx={noSpinnerSx} />
              <PrimaryButton onClick={saveStock}>Apply to range</PrimaryButton>
            </Box>
          )}

          <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: INVENTORY_GRID, px: 2.5, py: 1.25, bgcolor: BG, borderBottom: `1px solid ${BORDER}` }}>
            <MapComponent Component={ColumnLabel} data={INVENTORY_COLS} showNoDataAvailable={false} />
          </Box>
          <MapComponent Component={InventoryRow} data={inventory} isLoading={loading} />
        </Box>
      )}

      {/* Availability search */}
      {tab === 'availability' && (
        <Box sx={{ ...CARD_SX, mb: 2 }}>
          <SectionHeader
            title="Check availability"
            subtitle="A room type only shows here if every night of the stay has enough rooms free."
          />
          <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${BORDER}`, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr 1fr auto' }, gap: 1.5, alignItems: 'center' }}>
            <TextField size="small" type="date" label="Check-in" value={searchForm.startDate} onChange={handleSearchChange('startDate')} InputLabelProps={{ shrink: true }} sx={inputSx} />
            <TextField size="small" type="date" label="Check-out" value={searchForm.endDate} onChange={handleSearchChange('endDate')} InputLabelProps={{ shrink: true }} sx={inputSx} />
            <TextField size="small" type="number" label="Guests" inputProps={{ min: 1 }} value={searchForm.guests} onChange={handleSearchChange('guests')} sx={noSpinnerSx} />
            <TextField size="small" type="number" label="Rooms" inputProps={{ min: 1 }} value={searchForm.rooms} onChange={handleSearchChange('rooms')} sx={noSpinnerSx} />
            <PrimaryButton onClick={search}>Search</PrimaryButton>
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: AVAILABILITY_GRID, px: 2.5, py: 1.25, bgcolor: BG, borderBottom: `1px solid ${BORDER}` }}>
            <MapComponent Component={ColumnLabel} data={AVAILABILITY_COLS} showNoDataAvailable={false} />
          </Box>
          <MapComponent Component={AvailabilityRow} data={availability} isLoading={loading} />
        </Box>
      )}

      {/* Room type add / edit */}
      <Dialog open={showTypeForm} onClose={() => setShowTypeForm(false)} fullWidth maxWidth="sm" sx={dialogSx(isMobile)}>
        <DialogTitle sx={{ fontWeight: 800 }}>{editingType ? 'Edit room type' : 'Add room type'}</DialogTitle>
        <Box component="form" onSubmit={submitType}>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField fullWidth size="small" label="Name" placeholder="Deluxe King" value={typeForm.name} onChange={handleTypeChange('name')} required sx={inputSx} />
              <TextField fullWidth size="small" type="number" label="Max occupancy" inputProps={{ min: 1 }} value={typeForm.maxOccupancy} onChange={handleTypeChange('maxOccupancy')} required sx={noSpinnerSx} />
              <TextField fullWidth size="small" type="number" label="Total rooms" inputProps={{ min: 0 }} value={typeForm.totalRooms} onChange={handleTypeChange('totalRooms')} required sx={noSpinnerSx} />
              <TextField
                fullWidth
                size="small"
                label="Perks"
                placeholder="Breakfast included, Free Wi-Fi, Airport pickup"
                helperText="Separate each one with a comma"
                value={typeForm.perks}
                onChange={handleTypeChange('perks')}
                sx={inputSx}
              />
              {editingType && (
                <Typography sx={{ fontSize: 12, color: MUTED }}>
                  Changing total rooms stocks nights that have not opened yet. Use the inventory calendar to restock nights already in use.
                </Typography>
              )}
              {/* Images need a room type id to attach to, so they are only offered
                  once it exists — on create, the form is saved first. */}
              {editingType && (
                <Box>
                  <Typography sx={{ fontSize: 12, color: MUTED, mb: 0.75 }}>
                    Images ({editingTypeImages.length}/{ROOM_TYPE_IMAGES_MAX})
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    <MapComponent Component={RoomTypeImage} data={editingTypeImages} showNoDataAvailable={false} onRemove={removeTypeImage} />
                  </Box>
                  <Button variant="outlined" component="label" disabled={loading || editingTypeImages.length >= ROOM_TYPE_IMAGES_MAX} fullWidth sx={{ py: 1 }}>
                    {loading ? 'Uploading…' : 'Add image'}
                    <input type="file" hidden accept="image/*" onChange={uploadTypeImage} />
                  </Button>
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowTypeForm(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editingType ? 'Save changes' : 'Add room type'}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Room add / edit */}
      <Dialog open={showRoomForm} onClose={() => setShowRoomForm(false)} fullWidth maxWidth="sm" sx={dialogSx(isMobile)}>
        <DialogTitle sx={{ fontWeight: 800 }}>{editingRoom ? 'Edit room' : 'Add room'}</DialogTitle>
        <Box component="form" onSubmit={submitRoom}>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField fullWidth size="small" label="Room number" value={roomForm.roomNumber} onChange={handleRoomChange('roomNumber')} required sx={inputSx} />
              <TextField fullWidth size="small" select label="Room type" value={roomForm.roomTypeId} onChange={handleRoomChange('roomTypeId')} required disabled={!!editingRoom} sx={inputSx}>
                {roomTypes.map(rt => <MuiMenuItem key={rt.id} value={rt.id}>{rt.name}</MuiMenuItem>)}
              </TextField>
              <TextField fullWidth size="small" select label="Status" value={roomForm.status} onChange={handleRoomChange('status')} sx={inputSx}>
                {ROOM_STATUSES.map(s => <MuiMenuItem key={s.value} value={s.value}>{s.label}</MuiMenuItem>)}
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowRoomForm(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editingRoom ? 'Save changes' : 'Add room'}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={showDelete} onClose={() => setShowDelete(false)} sx={dialogSx(isMobile)}>
        <DialogTitle>{deleteTarget?.kind === 'type' ? 'Delete room type' : 'Delete room'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete &quot;{deleteTarget?.kind === 'type' ? deleteTarget?.item?.name : deleteTarget?.item?.roomNumber}&quot;? Cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
}

export default ManageRooms;
