import React, { useEffect, useState } from 'react';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import BookingCard from './cards/BookingCard';
import MapComponent from './MapComponent';
import { FormFieldRow, PageHeader } from './cards/AppCards';
import { BRAND_GRADIENT, NAVY, MUTED, BORDER, PRIMARY_CONTRAST, SHADOW } from '../theme';
import constants from '../constants.json';

const createBookingFieldConfigs = [
  { field: 'startDate', label: 'Start Date', type: 'date' },
  { field: 'endDate', label: 'End Date', type: 'date' },
  { field: 'guestEmail', label: 'Guest Email', type: 'email', required: true },
  { field: 'guestName', label: 'Guest Name', type: 'text' },
  { field: 'guestPhone', label: 'Guest Phone', type: 'tel' },
  { field: 'roomNumber', label: 'Room Number', type: 'text', required: true },
];

const editBookingFieldConfigs = [
  { field: 'startDate', label: 'Start Date', type: 'date', required: true },
  { field: 'endDate', label: 'End Date', type: 'date', required: true, getInputProps: (values) => ({ min: values.startDate }) },
  { field: 'roomNumber', label: 'Room Number', type: 'text', required: true },
];

const initialCreateValues = {
  startDate: '',
  endDate: '',
  guestEmail: '',
  guestName: '',
  guestPhone: '',
  roomNumber: '',
  hotelId: '',
  sendInviteImmediately: false,
};

function ManageBookings({ loading, setLoading, account, navigate, alertSuccess, alertError, isMobile }) {
  const [bookings, setBookings] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createValues, setCreateValues] = useState(initialCreateValues);
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

  useEffect(() => {
    fetchBookings();
    fetchHotels();
  }, []);

  const CAN_CREATE_BOOKING = account && !!constants.PERMISSIONS.CAN_CREATE_BOOKING[account.role];
  const CAN_EDIT_BOOKING = account && !!constants.PERMISSIONS.CAN_EDIT_BOOKING[account.role];
  const CAN_DELETE_BOOKING = account && !!constants.PERMISSIONS.CAN_DELETE_BOOKING[account.role];
  const handleCreateInput = (field) => (e) => setCreateValues((prev) => ({ ...prev, [field]: e.target.value }));
  const handleEditInput = (field) => (e) => setEditValues((prev) => ({ ...prev, [field]: e.target.value }));

  const handleOpenEdit = (booking) => {
    const toDateStr = (dt) => dt ? new Date(dt).toISOString().slice(0, 10) : '';
    setEditValues({ startDate: toDateStr(booking.startTime), endDate: toDateStr(booking.endTime), roomNumber: booking.roomNumber || '' });
    setEditBooking(booking);
  };

  const handleEditBooking = async (e) => {
    e.preventDefault();
    const { startDate, endDate, roomNumber } = editValues;
    if (new Date(endDate) < new Date(startDate)) { alertError?.('End date must be after start date'); return; }
    if (!roomNumber?.trim()) { alertError?.('Room number is required'); return; }
    const result = await request({ endpoint: `/bookings/${editBooking.id}`, method: 'PATCH', data: { startDate, endDate, roomNumber: roomNumber.trim() }, setLoading, alertSuccess, alertError });
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
    const { startDate, endDate, guestEmail, guestName, guestPhone, roomNumber, hotelId, sendInviteImmediately } = createValues;
    if (!startDate || !endDate || !guestEmail || !hotelId || !roomNumber?.trim()) {
      alertError?.('All fields are required');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      alertError?.('End date must be after start date');
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
      roomNumber: roomNumber?.trim(),
    };
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
                data={createBookingFieldConfigs}
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
                onChange={handleCreateInput('hotelId')}
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
