import React, { useEffect, useState } from 'react';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import useListControls from '../helper/useListControls';
import DataGrid from './DataGrid';
import ListControls from './ListControls';
import BookingCard from './cards/BookingCard';
import MapComponent from './MapComponent';
import { FormFieldRow, PageHeader } from './cards/AppCards';
import { BRAND_GRADIENT, NAVY, MUTED, BORDER, PRIMARY_CONTRAST, SHADOW } from '../theme';
import constants from '../constants.json';

const createBookingFieldConfigs = [
  { field: 'startDate', label: 'Check-in', type: 'date' },
  { field: 'endDate', label: 'Check-out', type: 'date' },
  { field: 'guestEmail', label: 'Guest Email', type: 'email', required: true },
  { field: 'guestName', label: 'Guest Name', type: 'text' },
  { field: 'guestPhone', label: 'Guest Phone', type: 'tel' },
];

// Only asked for when no room type is chosen. Booking against a room type takes
// its rooms from inventory, so typing a number as well would just contradict it.
const ROOM_NUMBER_FIELD = { field: 'roomNumber', label: 'Room Number', type: 'text', required: true };

const CANCELLED_STATUS = constants.BOOKING_STATUS_CANCELLED;

const editBookingFieldConfigs = [
  { field: 'startDate', label: 'Check-in', type: 'date', required: true },
  { field: 'endDate', label: 'Check-out', type: 'date', required: true, getInputProps: (values) => ({ min: values.startDate }) },
  { field: 'roomNumber', label: 'Room Number', type: 'text', required: true },
];

const toDateInput = (date) => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const daysFromToday = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInput(date);
};

// Built fresh each time the dialog opens rather than once at import, so a tab left
// open overnight does not offer yesterday as the check-in date. Prefilling also
// means the browser's own dd-mm-yyyy placeholder is never what the user sees.
const makeInitialCreateValues = () => ({
  startDate: daysFromToday(0),
  endDate: daysFromToday(1),
  guestEmail: '',
  guestName: '',
  guestPhone: '',
  roomNumber: '',
  roomTypeId: '',
  rooms: 1,
  hotelId: '',
  sendInviteImmediately: false,
});

function ManageBookings({ loading, setLoading, account, navigate, alertSuccess, alertError, isMobile }) {
  const [hotels, setHotels] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createValues, setCreateValues] = useState(makeInitialCreateValues());
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [uploadedReservationDocumentKey, setUploadedReservationDocumentKey] = useState(null);
  const [editBooking, setEditBooking] = useState(null);
  const [editValues, setEditValues] = useState({ startDate: '', endDate: '', roomNumber: '' });
  const [deleteBooking, setDeleteBooking] = useState(null);

  // Rows and controls both come from the backend — see /bookings/filters.
  const list = useListControls({ endpoint: '/bookings', setLoading, alertError });
  const fetchBookings = () => list.refetch();

  const fetchHotels = async () => {
    await request({ endpoint: '/hotels', method: 'GET', defaultData: [], alertError, setData: setHotels });
  };

  // Fetched when the hotel is picked rather than from an effect on hotelId, so the
  // page keeps its single mount-time useEffect.
  const handleHotelChange = async (e) => {
    const hotelId = e.target.value;
    setCreateValues((prev) => ({ ...prev, hotelId, roomTypeId: '' }));
    setRoomTypes([]);
    if (!hotelId) return;
    await request({ endpoint: `/rooms/types?hotelId=${hotelId}`, method: 'GET', defaultData: [], alertError, setData: setRoomTypes });
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  const CAN_CREATE_BOOKING = account && !!constants.PERMISSIONS.CAN_CREATE_BOOKING[account.role];
  const CAN_EDIT_BOOKING = account && !!constants.PERMISSIONS.CAN_EDIT_BOOKING[account.role];
  const CAN_DELETE_BOOKING = account && !!constants.PERMISSIONS.CAN_DELETE_BOOKING[account.role];
  const handleCreateInput = (field) => (e) => setCreateValues((prev) => ({ ...prev, [field]: e.target.value }));
  const handleEditInput = (field) => (e) => setEditValues((prev) => ({ ...prev, [field]: e.target.value }));

  const handleOpenEdit = (booking) => {
    const toDateStr = (dt) => dt ? new Date(dt).toISOString().slice(0, 10) : '';
    setEditValues({ startDate: toDateStr(booking.startTime), endDate: toDateStr(booking.endTime), roomNumber: booking.roomNumber || '', status: booking.status || '' });
    setEditBooking(booking);
  };

  const handleEditBooking = async (e) => {
    e.preventDefault();
    const { startDate, endDate, roomNumber, status } = editValues;
    if (new Date(endDate) < new Date(startDate)) { alertError?.('Check-out must be after check-in'); return; }
    if (!roomNumber?.trim()) { alertError?.('Room number is required'); return; }
    const data = { startDate, endDate, roomNumber: roomNumber.trim() };
    // Only sent when it actually changed: the backend rejects a cancelled booking
    // being moved to anything else, so resending the same value would fail an edit
    // that was only meant to change the dates.
    if (status && status !== editBooking.status) data.status = status;
    const result = await request({ endpoint: `/bookings/${editBooking.id}`, method: 'PATCH', data, setLoading, alertSuccess, alertError });
    if (result?.success) { setEditBooking(null); fetchBookings(); }
  };

  const handleDeleteBooking = async () => {
    const result = await request({ endpoint: `/bookings/${deleteBooking.id}`, method: 'DELETE', setLoading, alertSuccess, alertError });
    if (result?.success) { setDeleteBooking(null); fetchBookings(); }
  };

  const handleReservationDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setLoading(true);
    try {
      const urlRes = await request({
        endpoint: '/bookings/reservation-document-upload-url',
        method: 'POST',
        data: { contentType: file.type || 'application/octet-stream', filename: file.name },
        alertError,
        throw: true,
      });
      const { uploadUrl, key } = urlRes?.data || {};
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: file.type ? { 'Content-Type': file.type } : {},
      });
      if (!putRes.ok) {
        alertError?.('Upload failed');
        return;
      }
      const result = await request({
        endpoint: '/bookings/extract-from-reservation-document',
        method: 'POST',
        data: { key },
        alertError,
        throw: true,
      });
      const data = result.data;
      let matchedHotelId = createValues.hotelId;
      if (data.hotelName && hotels.length) {
        for (let i = 0; i < hotels.length; i++) {
          const h = hotels[i];
          if (h.name && data.hotelName && h.name.toLowerCase().includes(data.hotelName.toLowerCase())) {
            matchedHotelId = String(h.id);
            break;
          }
        }
      }
      setCreateValues((prev) => ({
        ...prev,
        startDate: data.startDate ?? prev.startDate,
        endDate: data.endDate ?? prev.endDate,
        guestEmail: data.guestEmail ?? prev.guestEmail,
        guestName: data.guestName ?? prev.guestName,
        guestPhone: data.guestPhone ?? prev.guestPhone,
        roomNumber: data.roomNumber ?? prev.roomNumber,
        hotelId: data.hotelId ?? matchedHotelId ?? prev.hotelId,
      }));
      setUploadedFileName(file.name);
      setUploadedReservationDocumentKey(key);
      if (result?.message) alertSuccess?.(result.message);
      else alertSuccess?.('Form filled from reservation document');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    const { startDate, endDate, guestEmail, guestName, guestPhone, roomNumber, roomTypeId, rooms, hotelId, sendInviteImmediately } = createValues;
    if (!startDate || !endDate || !guestEmail || !hotelId) {
      alertError?.('All fields are required');
      return;
    }
    // A room type reserves from dated inventory and is given a room automatically;
    // without one the booking still needs a room number typed in.
    if (!roomTypeId && !roomNumber?.trim()) {
      alertError?.('Pick a room type, or enter a room number');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      alertError?.('Check-out must be after check-in');
      return;
    }
    const payload = {
      startDate,
      endDate,
      guestEmail,
      hotelId: Number(hotelId),
      sendInviteImmediately: !!sendInviteImmediately,
      guestName: guestName?.trim(),
      guestPhone: guestPhone?.trim(),
    };
    if (roomTypeId) {
      payload.roomTypeId = Number(roomTypeId);
      payload.rooms = Number(rooms) || 1;
    } else {
      payload.roomNumber = roomNumber?.trim();
    }
    if (uploadedReservationDocumentKey) payload.reservationDocumentKey = uploadedReservationDocumentKey;
    const result = await request({ endpoint: '/bookings', method: 'POST', data: payload, setLoading, alertSuccess, alertError });
    if (result?.success) {
      setCreateValues(makeInitialCreateValues());
      setUploadedFileName(null);
      setUploadedReservationDocumentKey(null);
      setShowCreateDialog(false);
      fetchBookings();
    }
  };

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader title="Bookings" right={CAN_CREATE_BOOKING && (
            <motion.button
              onClick={() => { setCreateValues(makeInitialCreateValues()); setShowCreateDialog(true); }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: BRAND_GRADIENT,
                border: 'none',
                borderRadius: 10,
                padding: '10px 22px',
                color: PRIMARY_CONTRAST,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: SHADOW,
              }}
            >
              + New Booking
            </motion.button>
          )} />
      </motion.div>

      <Dialog
        open={showCreateDialog && CAN_CREATE_BOOKING}
        onClose={() => {
          setShowCreateDialog(false);
          setUploadedFileName(null);
          setUploadedReservationDocumentKey(null);
        }}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3 } }}
        sx={{ '& .MuiDialog-container': { alignItems: 'flex-start', pt: 'calc(var(--app-header-height) + 1svh)' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: NAVY }}>New Booking</DialogTitle>
        <Box component="form" onSubmit={handleCreateBooking}>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box>
                <Typography sx={{ fontSize: 12, color: MUTED, mb: 0.5 }}>Upload reservation document (PDF or image)</Typography>
                <Button variant="outlined" component="label" disabled={loading} fullWidth sx={{ py: 1 }}>
                  {loading ? 'Extracting…' : 'Choose file'}
                  <input type="file" hidden accept=".pdf,image/*" onChange={handleReservationDocumentUpload} />
                </Button>
                {uploadedFileName && <Typography sx={{ fontSize: 12, color: 'primary.main', mt: 0.5 }}>Uploaded: {uploadedFileName}</Typography>}
              </Box>
              <MapComponent
                Component={FormFieldRow}
                data={createValues.roomTypeId ? createBookingFieldConfigs : [...createBookingFieldConfigs, ROOM_NUMBER_FIELD]}
                values={createValues}
                onChange={handleCreateInput}
                showNoDataAvailable={false}
                isLoading={false}
              />
              <TextField
                fullWidth
                select
                label="Hotel"
                value={createValues.hotelId ?? ''}
                onChange={handleHotelChange}
                required
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (v) => (v === '' ? 'Select hotel' : hotels.find((x) => String(x.id) === String(v))?.name || 'Select hotel'),
                  MenuProps: { sx: { zIndex: 1400 } },
                }}
                InputLabelProps={{ shrink: true }}
              >
                {hotels.map((h) => (
                  <MenuItem key={h.id} value={String(h.id)}>
                    {h.name}
                  </MenuItem>
                ))}
              </TextField>
              {createValues.hotelId && (
                <TextField
                  fullWidth
                  select
                  label="Room Type"
                  value={createValues.roomTypeId ?? ''}
                  onChange={handleCreateInput('roomTypeId')}
                  // Shown even when the hotel has none, and says so. Hiding the field
                  // outright reads as "this hotel books differently" rather than
                  // "nobody has set its room types up yet".
                  disabled={roomTypes.length === 0}
                  helperText={roomTypes.length === 0
                    ? 'This hotel has no room types yet — add them under Manage Hotels → Rooms & Inventory. Enter a room number below instead.'
                    : 'Reserves from dated inventory and assigns a room automatically. Leave blank to type a room number instead.'}
                  SelectProps={{
                    displayEmpty: true,
                    renderValue: (v) => (v === '' ? 'No room type — enter a room number' : roomTypes.find((rt) => String(rt.id) === String(v))?.name || ''),
                    MenuProps: { sx: { zIndex: 1400 } },
                  }}
                  InputLabelProps={{ shrink: true }}
                >
                  <MenuItem value="">No room type — enter a room number</MenuItem>
                  {roomTypes.map((rt) => (
                    <MenuItem key={rt.id} value={String(rt.id)}>
                      {rt.name} · sleeps {rt.maxOccupancy}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {createValues.roomTypeId && (
                <TextField
                  fullWidth
                  type="number"
                  label="Rooms"
                  value={createValues.rooms}
                  onChange={handleCreateInput('rooms')}
                  inputProps={{ min: 1 }}
                  InputLabelProps={{ shrink: true }}
                />
              )}
              <FormControlLabel
                control={
                  <Checkbox checked={!!createValues.sendInviteImmediately} onChange={(e) => setCreateValues((prev) => ({ ...prev, sendInviteImmediately: e.target.checked }))} color="primary" />
                }
                label="Send invite email immediately"
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setShowCreateDialog(false)} sx={{ color: MUTED }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Create Booking
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit Booking Dialog */}
      <Dialog open={!!editBooking && CAN_EDIT_BOOKING} onClose={() => setEditBooking(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}
        sx={{ '& .MuiDialog-container': { alignItems: 'flex-start', pt: 'calc(var(--app-header-height) + 1svh)' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: NAVY }}>Edit Booking</DialogTitle>
        <Box component="form" onSubmit={handleEditBooking}>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <MapComponent Component={FormFieldRow} data={editBookingFieldConfigs} values={editValues} onChange={handleEditInput} showNoDataAvailable={false} isLoading={false} />
              <TextField
                fullWidth
                select
                label="Status"
                value={editValues.status ?? ''}
                onChange={handleEditInput('status')}
                disabled={editBooking?.status === CANCELLED_STATUS}
                helperText={editBooking?.status === CANCELLED_STATUS
                  ? 'This booking is cancelled. Its nights have been released, so it cannot be reinstated — create a new booking instead.'
                  : 'Cancelling releases the nights this booking holds back into inventory.'}
                SelectProps={{ MenuProps: { sx: { zIndex: 1400 } } }}
                InputLabelProps={{ shrink: true }}
              >
                {/* constants.json is regenerated from whichever backend the dev
                    server points at, so these keys can be absent against an older
                    one. An empty list loses the dropdown; no guard crashes the
                    whole dialog. */}
                {(constants.BOOKING_STATUSES || []).map((s) => (
                  <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                ))}
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setEditBooking(null)} sx={{ color: MUTED }}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary">Save Changes</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete Booking Dialog */}
      <Dialog open={!!deleteBooking && CAN_DELETE_BOOKING} onClose={() => setDeleteBooking(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: NAVY }}>Delete Booking</DialogTitle>
        <DialogContent>
          <DialogContentText>Delete booking for <strong>{deleteBooking?.guest?.name || deleteBooking?.guest?.email || 'this guest'}</strong> at <strong>{deleteBooking?.hotel?.name}</strong>? This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteBooking(null)} sx={{ color: MUTED }}>Cancel</Button>
          <Button onClick={handleDeleteBooking} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      <ListControls list={list} />

      <DataGrid CardComponent={BookingCard} data={(() => {
        const hotelMap = {};
        for (let i = 0; i < hotels.length; i++) hotelMap[hotels[i].id] = hotels[i];
        const enriched = [];
        for (let i = 0; i < list.data.length; i++) {
          const b = list.data[i];
          const full = b.hotel?.id ? hotelMap[b.hotel.id] : null;
          const themeConfig = b.hotel?.themeConfig || full?.themeConfig || full?.brand?.themeConfig;
          enriched.push(themeConfig ? { ...b, hotel: { ...b.hotel, themeConfig } } : b);
        }
        return enriched;
      })()} isLoading={loading} navigate={navigate}
        onEdit={CAN_EDIT_BOOKING ? handleOpenEdit : null}
        onDelete={CAN_DELETE_BOOKING ? setDeleteBooking : null}
      />
    </Box>
  );
}

export default ManageBookings;
