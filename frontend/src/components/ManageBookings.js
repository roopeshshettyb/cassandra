import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import BookingCard from './cards/BookingCard';
import MapComponent from './MapComponent';
import { FormFieldRow, PageHeader, inputSx } from './cards/AppCards';
import { ChevronLeft, ChevronRight, Close } from '@mui/icons-material';
import { BRAND_GRADIENT, NAVY, MUTED, BORDER, PRIMARY_CONTRAST, SHADOW, PERK_BG, PHOTO_BACKDROP, PHOTO_CONTROL_BG, PHOTO_CONTROL_BG_HOVER, PHOTO_ON_DARK } from '../theme';
import constants from '../constants.json';

// Split by column: the stay's dates sit with the hotel and room on the left, the
// guest's details on the right. Kept together, every field landed on the right and
// the left column ran out after the hotel picker.
const createStayFieldConfigs = [
  { field: 'startDate', label: 'Check-in', type: 'date' },
  { field: 'endDate', label: 'Check-out', type: 'date' },
];

const createGuestFieldConfigs = [
  { field: 'guestEmail', label: 'Guest Email', type: 'email', required: true },
  { field: 'guestName', label: 'Guest Name', type: 'text' },
  { field: 'guestPhone', label: 'Guest Phone', type: 'tel' },
];

// Only asked for when no room type is chosen. Booking against a room type takes
// its rooms from inventory, so typing a number as well would just contradict it.
const ROOM_NUMBER_FIELD = { field: 'roomNumber', label: 'Room Number', type: 'text', required: true };

const CANCELLED_STATUS = constants.BOOKING_STATUS_CANCELLED;

// `failed` keeps a request that never answered distinct from a genuine sold-out:
// reading one as the other would have staff turning away a booking that is fine.
const emptyRoomPreview = { loading: false, failed: false, roomNumbers: [], enough: true, available: 0 };

// Changing any of these re-asks the backend which room the booking would get.
const PREVIEW_FIELDS = ['roomTypeId', 'startDate', 'endDate', 'rooms'];

// Read-only here. Removing an image belongs on the room type itself, under
// Manage Rooms & Inventory, not in the middle of taking a booking.
const RoomTypePhoto = ({ data: url, index, onOpen }) => (
  <Box
    component="img"
    src={url}
    alt="Room photo"
    onClick={() => onOpen(index)}
    sx={{
      width: 96, height: 72, flex: '0 0 auto', objectFit: 'cover', display: 'block',
      borderRadius: 1.5, border: `1px solid ${BORDER}`, cursor: 'pointer',
      '&:hover': { opacity: 0.85 },
    }}
  />
);

// What the room includes, so whoever takes the booking can tell the guest without
// leaving the form to go and look the room type up.
const RoomTypePerk = ({ data: perk }) => (
  <Chip
    label={perk}
    size="small"
    sx={{ fontSize: 11, fontWeight: 700, bgcolor: PERK_BG, color: NAVY, border: `1px solid ${BORDER}` }}
  />
);

// The strip inside the viewer. Same picture, but it marks which one you are on
// and sits on a dark backdrop rather than the form.
const RoomTypeThumb = ({ data: url, index, onOpen, activeIndex }) => (
  <Box
    component="img"
    src={url}
    alt="Room photo"
    onClick={() => onOpen(index)}
    sx={{
      width: 72, height: 54, flex: '0 0 auto', objectFit: 'cover', display: 'block',
      borderRadius: 1, cursor: 'pointer',
      outline: index === activeIndex ? `2px solid ${PHOTO_ON_DARK}` : 'none',
      outlineOffset: 2,
      opacity: index === activeIndex ? 1 : 0.55,
      '&:hover': { opacity: 1 },
    }}
  />
);

// Round control that sits on top of the photo itself, so it stays legible over
// whatever is underneath.
const PhotoOverlayButton = ({ label, onClick, sx, children }) => (
  <Box
    component="button"
    type="button"
    aria-label={label}
    onClick={onClick}
    sx={{
      position: 'absolute', display: 'grid', placeItems: 'center',
      width: 36, height: 36, border: 'none', borderRadius: '50%', cursor: 'pointer',
      bgcolor: PHOTO_CONTROL_BG, color: PHOTO_ON_DARK,
      '&:hover': { bgcolor: PHOTO_CONTROL_BG_HOVER },
      ...sx,
    }}
  >
    {children}
  </Box>
);

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
  const [bookings, setBookings] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [roomPreview, setRoomPreview] = useState(emptyRoomPreview);
  // Index rather than the url, so the arrow keys have something to step through.
  const [photoIndex, setPhotoIndex] = useState(null);
  // Stamps each preview request so a slow earlier reply cannot overwrite a newer one.
  const previewRequestId = useRef(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createValues, setCreateValues] = useState(makeInitialCreateValues());
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [uploadedReservationDocumentKey, setUploadedReservationDocumentKey] = useState(null);
  const [editBooking, setEditBooking] = useState(null);
  const [editValues, setEditValues] = useState({ startDate: '', endDate: '', roomNumber: '' });
  const [deleteBooking, setDeleteBooking] = useState(null);

  const fetchBookings = async () => {
    await request({ endpoint: '/bookings', method: 'GET', setLoading, setData: setBookings, defaultData: [], alertError, delay: false });
  };

  const fetchHotels = async () => {
    await request({ endpoint: '/hotels', method: 'GET', defaultData: [], alertError, setData: setHotels });
  };

  // Derived, not stored: the types are already loaded, so keeping a copy in state
  // would just be another thing to keep in step with the selection.
  const selectedRoomType = roomTypes.find((rt) => String(rt.id) === String(createValues.roomTypeId));
  const selectedRoomTypeImages = selectedRoomType?.images || [];
  const selectedRoomTypePerks = selectedRoomType?.perks || [];

  // Wraps at both ends, so browsing never dead-ends on the first or last photo.
  const stepPhoto = (step) => setPhotoIndex((i) => (i + step + selectedRoomTypeImages.length) % selectedRoomTypeImages.length);

  // Fetched when the hotel is picked rather than from an effect on hotelId, so the
  // page keeps its single mount-time useEffect.
  const handleHotelChange = async (e) => {
    const hotelId = e.target.value;
    setCreateValues((prev) => ({ ...prev, hotelId, roomTypeId: '' }));
    setRoomTypes([]);
    // Discards any preview still in flight for the hotel being left behind.
    previewRequestId.current += 1;
    setRoomPreview(emptyRoomPreview);
    if (!hotelId) return;
    await request({ endpoint: `/rooms/types?hotelId=${hotelId}`, method: 'GET', defaultData: [], alertError, setData: setRoomTypes });
  };

  /**
   * Ask which room this booking would be given, and show it.
   *
   * Shown read-only: the room is picked for real inside the booking transaction, so
   * this can go stale between showing and submitting, and nothing is reserved by
   * asking.
   *
   * No loader is passed: this fires on every room-type, date and room-count change,
   * and flashing the page-level spinner each time would be worse than the answer is
   * worth. Typing quickly leaves several requests in flight and they can land out of
   * order, so each one is stamped and a reply is only used if it is still the latest.
   */
  const previewRoom = async (values) => {
    const { hotelId, roomTypeId, startDate, endDate, rooms } = values;
    if (!hotelId || !roomTypeId || !startDate || !endDate) {
      previewRequestId.current += 1;
      setRoomPreview(emptyRoomPreview);
      return;
    }
    previewRequestId.current += 1;
    const requestId = previewRequestId.current;
    setRoomPreview((prev) => ({ ...prev, loading: true }));
    const res = await request({
      endpoint: `/rooms/next-room?hotelId=${hotelId}&roomTypeId=${roomTypeId}&startDate=${startDate}&endDate=${endDate}&rooms=${Number(rooms) || 1}`,
      method: 'GET',
    });
    if (requestId !== previewRequestId.current) return;
    // api.js returns null rather than throwing when a request fails.
    if (!res?.data) {
      setRoomPreview({ ...emptyRoomPreview, failed: true });
      return;
    }
    setRoomPreview({
      loading: false,
      failed: false,
      roomNumbers: res.data.roomNumbers || [],
      enough: !!res.data.enough,
      available: res.data.available ?? 0,
    });
  };

  useEffect(() => {
    fetchBookings();
    fetchHotels();
  }, []);

  const CAN_CREATE_BOOKING = account && !!constants.PERMISSIONS.CAN_CREATE_BOOKING[account.role];
  const CAN_EDIT_BOOKING = account && !!constants.PERMISSIONS.CAN_EDIT_BOOKING[account.role];
  const CAN_DELETE_BOOKING = account && !!constants.PERMISSIONS.CAN_DELETE_BOOKING[account.role];
  const handleCreateInput = (field) => (e) => {
    const value = e.target.value;
    setCreateValues((prev) => ({ ...prev, [field]: value }));
    // Asked outside the updater: running it inside would make it a side effect that
    // React is free to replay. The preview is allowed to be a moment behind — stale
    // replies are discarded by request id.
    if (PREVIEW_FIELDS.includes(field)) {
      previewRoom({ ...createValues, [field]: value });
    }
  };
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
        // Two columns need the room. The form ran past the bottom of the screen at
        // the old width, which is what made people scroll to reach the fields.
        maxWidth="md"
        // The container is pushed down by the header plus 1svh, and the paper keeps
        // MUI's 32px margin above and below — all of it has to come off 100svh, or
        // a full form runs past the bottom of the screen. 2svh is left clear below.
        PaperProps={{ sx: { borderRadius: 3, maxHeight: 'calc(100svh - var(--app-header-height) - 1svh - 64px - 2svh)' } }}
        // The desktop sidebar is fixed at 20vw and stacks above dialogs, so a form
        // this wide, centred on the whole window, slid underneath it on narrower
        // screens. Centring it in the content area instead, as App.js offsets the
        // page itself, keeps it clear.
        sx={{ '& .MuiDialog-container': { alignItems: 'flex-start', pt: 'calc(var(--app-header-height) + 1svh)', pl: isMobile ? 0 : '20vw' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: NAVY }}>New Booking</DialogTitle>
        <Box component="form" onSubmit={handleCreateBooking} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <DialogContent>
            {/* Side by side on a desktop, stacked on a phone. What is being booked
                sits on the left, who it is for on the right, which halves the
                height and keeps the whole form on one screen. */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 1, alignItems: 'start' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Hotel and room type lead, because they decide what the rest of the
                    form even means — and previously they sat below the fold, so you
                    had to scroll before you could pick one. */}
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
                      ? 'This hotel has no room types yet — add them under Manage Rooms & Inventory. Enter a room number below instead.'
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
                {/* What the guest is actually being put in. Only rendered when the
                    chosen type has photos, so types without any do not leave a gap. */}
                {selectedRoomTypeImages.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
                    <MapComponent Component={RoomTypePhoto} data={selectedRoomTypeImages} showNoDataAvailable={false} onOpen={setPhotoIndex} />
                  </Box>
                )}
                {selectedRoomTypePerks.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    <MapComponent Component={RoomTypePerk} data={selectedRoomTypePerks} showNoDataAvailable={false} />
                  </Box>
                )}
                <MapComponent
                  Component={FormFieldRow}
                  data={createValues.roomTypeId ? createStayFieldConfigs : [...createStayFieldConfigs, ROOM_NUMBER_FIELD]}
                  values={createValues}
                  onChange={handleCreateInput}
                  showNoDataAvailable={false}
                  isLoading={false}
                />
                {createValues.roomTypeId && (
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
                )}
                {/* Which room this booking would get. Read-only: the real assignment
                    happens inside the booking transaction, so showing it as editable
                    would promise a room we cannot guarantee is still free at submit. */}
                {createValues.roomTypeId && (
                  <TextField
                    fullWidth
                    label="Room number"
                    value={roomPreview.loading
                      ? 'Checking…'
                      : roomPreview.failed
                        ? 'Could not check'
                        : (roomPreview.roomNumbers.join(', ') || 'None free for these dates')}
                    InputProps={{ readOnly: true }}
                    InputLabelProps={{ shrink: true }}
                    error={!roomPreview.loading && !roomPreview.failed && !roomPreview.enough}
                    helperText={roomPreview.loading
                      ? ''
                      : roomPreview.failed
                        ? 'Availability could not be checked — a room is still assigned when you create the booking'
                        : roomPreview.enough
                          ? 'Assigned automatically when you create the booking'
                          : `Only ${roomPreview.available} available for these dates`}
                    sx={inputSx}
                  />
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
          {/* Pinned, so Create Booking is reachable without scrolling to the end
              however long the form gets. */}
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

      {/* Full-size room photo, on its own dark backdrop. Stacked above the booking
          dialog, which sits at the MUI default, so it opens over the form rather
          than behind it. Arrow keys and the on-screen chevrons both step through
          the set and wrap around. */}
      <Dialog
        open={photoIndex !== null}
        onClose={() => setPhotoIndex(null)}
        onKeyDown={(e) => {
          const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          stepPhoto(step);
        }}
        maxWidth={false}
        sx={{ zIndex: 1500 }}
        slotProps={{ backdrop: { sx: { bgcolor: PHOTO_BACKDROP } } }}
        PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none', m: 2, maxWidth: '94vw' } }}
      >
        <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Box
              component="img"
              src={selectedRoomTypeImages[photoIndex] || ''}
              alt="Room photo"
              sx={{ display: 'block', maxWidth: '100%', maxHeight: '72svh', borderRadius: 3 }}
            />
            <PhotoOverlayButton label="Close photo" onClick={() => setPhotoIndex(null)} sx={{ top: 12, right: 12 }}>
              <Close sx={{ fontSize: 20 }} />
            </PhotoOverlayButton>
            {selectedRoomTypeImages.length > 1 && (
              <>
                <Typography sx={{ position: 'absolute', top: 12, left: 12, px: 1.25, py: 0.4, borderRadius: 5, fontSize: 12, fontWeight: 700, color: PHOTO_ON_DARK, bgcolor: PHOTO_CONTROL_BG }}>
                  {photoIndex + 1} / {selectedRoomTypeImages.length}
                </Typography>
                <PhotoOverlayButton label="Previous photo" onClick={() => stepPhoto(-1)} sx={{ left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <ChevronLeft />
                </PhotoOverlayButton>
                <PhotoOverlayButton label="Next photo" onClick={() => stepPhoto(1)} sx={{ right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <ChevronRight />
                </PhotoOverlayButton>
              </>
            )}
          </Box>
          {selectedRoomTypeImages.length > 1 && (
            <Box sx={{ display: 'flex', gap: 1, maxWidth: '100%', overflowX: 'auto', pb: 0.5 }}>
              <MapComponent Component={RoomTypeThumb} data={selectedRoomTypeImages} showNoDataAvailable={false} onOpen={setPhotoIndex} activeIndex={photoIndex} />
            </Box>
          )}
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

      <DataGrid CardComponent={BookingCard} data={(() => {
        const hotelMap = {};
        for (let i = 0; i < hotels.length; i++) hotelMap[hotels[i].id] = hotels[i];
        const enriched = [];
        for (let i = 0; i < bookings.length; i++) {
          const b = bookings[i];
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
