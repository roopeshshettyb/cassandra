import React, { useEffect, useState } from 'react';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import BookingCard from './cards/BookingCard';
import MapComponent from './MapComponent';

import { BRAND_GRADIENT, NAVY, MUTED, BORDER, PRIMARY_CONTRAST, SHADOW } from '../theme';

const createBookingFieldConfigs = [
  { field: 'startDate', label: 'Start Date', type: 'date' },
  { field: 'endDate', label: 'End Date', type: 'date' },
  { field: 'guestEmail', label: 'Guest Email', type: 'email', required: true },
  { field: 'guestName', label: 'Guest Name', type: 'text' },
  { field: 'guestPhone', label: 'Guest Phone', type: 'tel' },
  { field: 'roomNumber', label: 'Room Number', type: 'text' },
];

function CreateFieldRow({ data, createValues, handleCreateInput }) {
  const { field, label, type, required } = data;
  return <TextField fullWidth label={label} type={type} value={createValues[field] ?? ''} onChange={handleCreateInput(field)} InputLabelProps={{ shrink: true }} required={!!required} />;
}

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
  const [dataLoading, setDataLoading] = useState(true);

  const fetchBookings = async () => {
    await request({ endpoint: '/bookings', method: 'GET', setLoading: setDataLoading, setData: setBookings, defaultData: [], alertError });
  };

  const fetchHotels = async () => {
    await request({ endpoint: '/hotels', method: 'GET', defaultData: [], alertError, setData: setHotels });
  };

  useEffect(() => {
    fetchBookings();
    if (account && (account.role === 'admin' || account.role === 'hotel_owner' || account.role === 'hotel_staff')) {
      fetchHotels();
    }
  }, []);

  const canCreateBooking = account && (account.role === 'admin' || account.role === 'hotel_owner' || account.role === 'hotel_staff');
  const handleCreateInput = (field) => (e) => setCreateValues((prev) => ({ ...prev, [field]: e.target.value }));

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
    if (!startDate || !endDate || !guestEmail || !hotelId) {
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
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: '4vh', sm: 1.5 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: { xs: 'flex-end', sm: 'space-between' }, mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main', mb: 0.5 }}>Management</Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY }}>Bookings</Typography>
          </Box>
          {canCreateBooking && (
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
          )}
        </Box>
      </motion.div>

      <Dialog
        open={showCreateDialog && canCreateBooking}
        onClose={() => {
          setShowCreateDialog(false);
          setUploadedFileName(null);
          setUploadedReservationDocumentKey(null);
        }}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3 } }}
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
                Component={CreateFieldRow}
                data={createBookingFieldConfigs}
                createValues={createValues}
                handleCreateInput={handleCreateInput}
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

      <DataGrid CardComponent={BookingCard} data={bookings} isLoading={dataLoading} navigate={navigate} />
    </Box>
  );
}

export default ManageBookings;
