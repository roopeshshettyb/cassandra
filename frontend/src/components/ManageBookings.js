import React, { useEffect, useState } from 'react';
import { Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import useListControls from '../helper/useListControls';
import DataGrid from './DataGrid';
import ListControls from './ListControls';
import BookingCard from './cards/BookingCard';
import HotelPicker from './HotelPicker';
import MapComponent from './MapComponent';
import { FormFieldRow, PageHeader, inputSx } from './cards/AppCards';
import { BRAND_GRADIENT, NAVY, MUTED, BORDER, PRIMARY_CONTRAST, SHADOW, HOVER_BG } from '../theme';
import constants from '../constants.json';

const createStayFieldConfigs = [
  { field: 'startDate', label: 'Check-in', type: 'date' },
  { field: 'endDate', label: 'Check-out', type: 'date' },
];

const createGuestFieldConfigs = [
  { field: 'guestEmail', label: 'Guest Email', type: 'email', required: true },
  { field: 'guestName', label: 'Guest Name', type: 'text' },
  { field: 'guestPhone', label: 'Guest Phone', type: 'tel' },
];

const ROOM_NUMBER_FIELD = { field: 'roomNumber', label: 'Room Number', type: 'text', required: true };

const CANCELLED_STATUS = constants.BOOKING_STATUS_CANCELLED;

const PREVIEW_FIELDS = ['roomTypeId', 'startDate', 'endDate', 'rooms'];

const RoomTypePhoto = ({ data: url }) => (
  <Box
    component="img"
    src={url}
    alt="Room photo"
    sx={{ width: 96, height: 72, flex: '0 0 auto', objectFit: 'cover', borderRadius: 1.5, border: `1px solid ${BORDER}` }}
  />
);

const RoomTypePerk = ({ data: perk }) => (
  <Chip
    label={perk}
    size="small"
    sx={{ fontSize: 11, fontWeight: 700, bgcolor: HOVER_BG, color: NAVY, border: `1px solid ${BORDER}` }}
  />
);

const editBookingFieldConfigs = [
  { field: 'startDate', label: 'Check-in', type: 'date', required: true },
  { field: 'endDate', label: 'Check-out', type: 'date', required: true, getInputProps: (values) => ({ min: values.startDate }) },
  { field: 'roomNumber', label: 'Room Number', type: 'text', required: true },
];

const initialCreateValues = {
  startDate: '',
  endDate: '',
  guestEmail: '',
  guestName: '',
  guestPhone: '',
  roomNumber: '',
  roomTypeId: '',
  rooms: 1,
  hotelId: '',
  sendInviteImmediately: false,
};

function ManageBookings({ loading, setLoading, account, navigate, alertSuccess, alertError, isMobile }) {
  const [hotels, setHotels] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [roomPreview, setRoomPreview] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createValues, setCreateValues] = useState(initialCreateValues);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [uploadedReservationDocumentKey, setUploadedReservationDocumentKey] = useState(null);
  const [editBooking, setEditBooking] = useState(null);
  const [editValues, setEditValues] = useState({ startDate: '', endDate: '', roomNumber: '', status: '' });
  const [deleteBooking, setDeleteBooking] = useState(null);

  // Rows and controls both come from the backend — see /bookings/filters.
  const list = useListControls({ endpoint: '/bookings', setLoading, alertError });
  const fetchBookings = () => list.refetch();

  const fetchHotels = async () => {
    await request({ endpoint: '/hotels', method: 'GET', defaultData: [], alertError, setData: setHotels });
  };

  const selectedRoomType = roomTypes.find((rt) => String(rt.id) === String(createValues.roomTypeId));
  const selectedRoomTypeImages = selectedRoomType?.images || [];
  const selectedRoomTypePerks = selectedRoomType?.perks || [];

  const loadRoomTypes = async (hotelId) => {
    setRoomTypes([]);
    setRoomPreview(null);
    if (!hotelId) return;
    await request({ endpoint: `/rooms/types?hotelId=${hotelId}`, method: 'GET', defaultData: [], alertError, setData: setRoomTypes });
  };

  const handleHotelChange = async (hotelId) => {
    setCreateValues((prev) => ({ ...prev, hotelId, roomTypeId: '' }));
    await loadRoomTypes(hotelId);
  };

  const previewRoom = async ({ roomTypeId, startDate, endDate, rooms }) => {
    if (!roomTypeId || !startDate || !endDate) { setRoomPreview(null); return; }
    const res = await request({
      endpoint: `/rooms/next-room?roomTypeId=${roomTypeId}&startDate=${startDate}&endDate=${endDate}&rooms=${Number(rooms) || 1}`,
      method: 'GET',
    });
    setRoomPreview(res?.data || null);
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  const CAN_CREATE_BOOKING = account && !!constants.PERMISSIONS.CAN_CREATE_BOOKING[account.role];
  const CAN_EDIT_BOOKING = account && !!constants.PERMISSIONS.CAN_EDIT_BOOKING[account.role];
  const CAN_DELETE_BOOKING = account && !!constants.PERMISSIONS.CAN_DELETE_BOOKING[account.role];
  const handleCreateInput = (field) => (e) => {
    const value = e.target.value;
    setCreateValues((prev) => ({ ...prev, [field]: value }));
    if (PREVIEW_FIELDS.includes(field)) {
      previewRoom({ ...createValues, [field]: value });
    }
  };
  const handleEditInput = (field) => (e) => setEditValues((prev) => ({ ...prev, [field]: e.target.value }));

  const handleOpenEdit = (booking) => {
    const toDateStr = (dt) => dt ? new Date(dt).toISOString().slice(0, 10) : '';
    setEditValues({ startDate: toDateStr(booking.startTime), endDate: toDateStr(booking.endTime), roomNumber: booking.roomNumber || '', status: booking.status });
    setEditBooking(booking);
  };

  const handleEditBooking = async (e) => {
    e.preventDefault();
    const { startDate, endDate, roomNumber, status } = editValues;
    if (new Date(endDate) < new Date(startDate)) { alertError?.('Check-out must be after check-in'); return; }
    if (!roomNumber?.trim()) { alertError?.('Room number is required'); return; }
    const data = { startDate, endDate, roomNumber: roomNumber.trim(), status };
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
      const hotelId = data.hotelId ?? matchedHotelId ?? createValues.hotelId;
      setCreateValues((prev) => ({
        ...prev,
        startDate: data.startDate ?? prev.startDate,
        endDate: data.endDate ?? prev.endDate,
        guestEmail: data.guestEmail ?? prev.guestEmail,
        guestName: data.guestName ?? prev.guestName,
        guestPhone: data.guestPhone ?? prev.guestPhone,
        roomNumber: data.roomNumber ?? prev.roomNumber,
        hotelId,
        roomTypeId: '',
      }));
      await loadRoomTypes(hotelId);
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
      setCreateValues(initialCreateValues);
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
              onClick={() => setShowCreateDialog(true)}
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
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: 3, maxHeight: 'calc(100svh - var(--app-header-height) - 1svh - 64px - 2svh)' } }}
        sx={{ '& .MuiDialog-container': { alignItems: 'flex-start', pt: 'calc(var(--app-header-height) + 1svh)', pl: isMobile ? 0 : '20vw' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: NAVY }}>New Booking</DialogTitle>
        <Box component="form" onSubmit={handleCreateBooking} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <DialogContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 1, alignItems: 'start' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <HotelPicker hotels={hotels} value={createValues.hotelId} onChange={handleHotelChange} required />
                {createValues.hotelId && (
                  <TextField
                    fullWidth
                    select
                    label="Room Type"
                    value={createValues.roomTypeId}
                    onChange={handleCreateInput('roomTypeId')}
                    disabled={roomTypes.length === 0}
                    helperText={roomTypes.length === 0
                      ? 'This hotel has no room types yet — add them under Manage Rooms. Enter a room number below instead.'
                      : 'Reserves from dated inventory and assigns a room automatically. Leave blank to type a room number instead.'}
                    SelectProps={{
                      displayEmpty: true,
                      renderValue: (v) => (v === '' ? 'No room type — enter a room number' : roomTypes.find((rt) => String(rt.id) === String(v)).name),
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
                {selectedRoomTypeImages.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
                    <MapComponent Component={RoomTypePhoto} data={selectedRoomTypeImages} showNoDataAvailable={false} />
                  </Box>
                )}
                {selectedRoomTypePerks.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    <MapComponent Component={RoomTypePerk} data={selectedRoomTypePerks} showNoDataAvailable={false} />
                  </Box>
                )}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <MapComponent
                    Component={FormFieldRow}
                    data={createStayFieldConfigs}
                    values={createValues}
                    onChange={handleCreateInput}
                    showNoDataAvailable={false}
                    isLoading={false}
                  />
                </Box>
                {!createValues.roomTypeId && (
                  <FormFieldRow data={ROOM_NUMBER_FIELD} values={createValues} onChange={handleCreateInput} />
                )}
                {createValues.roomTypeId && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Rooms"
                      value={createValues.rooms}
                      onChange={handleCreateInput('rooms')}
                      inputProps={{ min: 1 }}
                      InputLabelProps={{ shrink: true }}
                      sx={inputSx}
                    />
                    <TextField
                      fullWidth
                      label="Room number"
                      value={roomPreview ? (roomPreview.roomNumbers.join(', ') || 'None free for these dates') : ''}
                      InputProps={{ readOnly: true }}
                      InputLabelProps={{ shrink: true }}
                      error={!!roomPreview && !roomPreview.enough}
                      helperText={roomPreview && !roomPreview.enough
                        ? `Only ${roomPreview.available} available for these dates`
                        : 'Assigned automatically when you create the booking'}
                      sx={inputSx}
                    />
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <MapComponent
                  Component={FormFieldRow}
                  data={createGuestFieldConfigs}
                  values={createValues}
                  onChange={handleCreateInput}
                  showNoDataAvailable={false}
                  isLoading={false}
                />
                <Box>
                  <Typography sx={{ fontSize: 12, color: MUTED, mb: 0.5 }}>Upload reservation document (PDF or image)</Typography>
                  <Button variant="outlined" component="label" disabled={loading} fullWidth sx={{ py: 1 }}>
                    {loading ? 'Extracting…' : 'Choose file'}
                    <input type="file" hidden accept=".pdf,image/*" onChange={handleReservationDocumentUpload} />
                  </Button>
                  {uploadedFileName && <Typography sx={{ fontSize: 12, color: 'primary.main', mt: 0.5 }}>Uploaded: {uploadedFileName}</Typography>}
                </Box>
                <FormControlLabel
                  control={
                    <Checkbox checked={!!createValues.sendInviteImmediately} onChange={(e) => setCreateValues((prev) => ({ ...prev, sendInviteImmediately: e.target.checked }))} color="primary" />
                  }
                  label="Send invite email immediately"
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
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
                value={editValues.status}
                onChange={handleEditInput('status')}
                disabled={editBooking?.status === CANCELLED_STATUS}
                helperText={editBooking?.status === CANCELLED_STATUS
                  ? 'Cancelled bookings cannot be reinstated. Create a new booking instead.'
                  : 'Cancelling releases the booked nights back into inventory.'}
                SelectProps={{ MenuProps: { sx: { zIndex: 1400 } } }}
                InputLabelProps={{ shrink: true }}
              >
                {constants.BOOKING_STATUSES.map((s) => (
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
