import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
  Grid,
  Chip,
  Divider,
  Stack,
  TextField,
  MenuItem,
  IconButton,
} from '@mui/material';
import { motion } from 'framer-motion';
import Schedule from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';
import RoomServiceIcon from '@mui/icons-material/RoomService';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import AirportShuttleIcon from '@mui/icons-material/AirportShuttle';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PendingIcon from '@mui/icons-material/Pending';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import request from '../helper/api';
import HotelInfoCard from './HotelInfoCard';
import ChatBox from './ChatBox';
import { useHotelTheme } from '../context/HotelThemeContext';

const MotionBox = motion(Box);

function BookingDetails({ setLoading, account, navigate, alertSuccess, alertError, isMobile }) {
  const { id } = useParams();
  const { setThemeConfig } = useHotelTheme();
  const [booking, setBooking] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingNotes, setPendingNotes] = useState({});

  const canDeleteBooking = account && (account.role === 'admin' || account.role === 'hotel_owner' || account.role === 'hotel_staff');
  const isGuest = account?.role === 'guest';
  const isStaffOrOwner = account && (account.role === 'admin' || account.role === 'hotel_owner' || account.role === 'hotel_staff');

  dayjs.extend(relativeTime);

  const getRequestTypeIcon = (requestType) => {
    switch (requestType) {
      case 'room_service':
        return <RoomServiceIcon fontSize="small" />;
      case 'house_keeping':
        return <CleaningServicesIcon fontSize="small" />;
      case 'laundry':
        return <LocalLaundryServiceIcon fontSize="small" />;
      case 'airport_transfer':
        return <AirportShuttleIcon fontSize="small" />;
      default:
        return <RoomServiceIcon fontSize="small" />;
    }
  };

  const formatRelativeTime = (isoString) => {
    if (!isoString) return '';
    return dayjs(isoString).fromNow();
  };

  const refreshBooking = async () => {
    if (!id) return;
    await request({
      endpoint: `/bookings/${id}`,
      method: 'GET',
      setLoading,
      setData: setBooking,
      defaultData: null,
      alertError,
    });
  };

  const handleAppendNote = async (reqId) => {
    const message = pendingNotes[reqId]?.trim();
    if (!message) return;

    const result = await request({
      endpoint: `/requests/${reqId}/append-message`,
      method: 'POST',
      data: { message },
      setLoading,
      alertSuccess,
      alertError,
    });

    if (result && result.success) {
      setPendingNotes((prev) => ({ ...prev, [reqId]: '' }));
      await refreshBooking();
    }
  };

  const handleUpdateStatus = async (reqId, status) => {
    if (!status) return;
    const result = await request({
      endpoint: `/requests/${reqId}`,
      method: 'PATCH',
      data: { status },
      setLoading,
      alertSuccess,
      alertError,
    });

    if (result && result.success) {
      await refreshBooking();
    }
  };

  useEffect(() => {
    if (id) {
      request({
        endpoint: `/bookings/${id}`,
        method: 'GET',
        setLoading,
        setData: (data) => {
          setBooking(data);
          setThemeConfig(data?.hotel?.themeConfig || null);
        },
        defaultData: null,
        alertError,
      });
    }
  }, [id, setThemeConfig]);

  useEffect(() => {
    return () => setThemeConfig(null);
  }, [setThemeConfig]);

  const handleDeleteClick = () => setShowDeleteConfirm(true);
  const handleDeleteCancel = () => setShowDeleteConfirm(false);

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    if (!id) return;
    const result = await request({
      endpoint: `/bookings/${id}`,
      method: 'DELETE',
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result && result.success) {
      navigate('/bookings');
    }
  };

  if (!booking) {
    return null;
  }

  const startStr = booking.startTime ? new Date(booking.startTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const endStr = booking.endTime ? new Date(booking.endTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const bookingId = parseInt(id, 10);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <ChatBox bookingId={bookingId} alertError={alertError} isWithinStay={booking.isWithinStay} avatarConfig={booking.hotel?.avatarConfig} isMobile={isMobile} setLoading={setLoading} />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h4">Booking Details</Typography>
              {canDeleteBooking && (
                <Button variant="outlined" color="error" onClick={handleDeleteClick}>
                  Delete Booking
                </Button>
              )}
            </Box>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Schedule sx={{ color: 'text.secondary', fontSize: 20, mt: 0.25 }} />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Check-in
                    </Typography>
                    <Typography variant="body2">{startStr}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Schedule sx={{ color: 'text.secondary', fontSize: 20, mt: 0.25 }} />
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Check-out
                    </Typography>
                    <Typography variant="body2">{endStr}</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            {booking.guest && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h5" sx={{ mb: 2 }}>
                  Guest
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <PersonIcon sx={{ color: 'text.secondary', fontSize: 20, mt: 0.25 }} />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Name
                        </Typography>
                        <Typography variant="body2">{booking.guest.name || '-'}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <PersonIcon sx={{ color: 'text.secondary', fontSize: 20, mt: 0.25 }} />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Email
                        </Typography>
                        <Typography variant="body2">{booking.guest.email || '-'}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}

            {booking.hotel && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h5" sx={{ mb: 2 }}>
                  Hotel
                </Typography>
                <HotelInfoCard hotel={booking.hotel} />
              </Box>
            )}

            {Array.isArray(booking.requests) && booking.requests.length > 0 && (
              <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="h5" sx={{ mb: 2 }}>
                  Requests
                </Typography>
                <Stack spacing={2}>
                  {booking.requests.map((req) => (
                    <Box
                      key={req.id}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getRequestTypeIcon(req.requestType)}
                          <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>
                            {req.requestType.replace(/_/g, ' ')}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {/* Urgency: pill with icon-like visual and different shape */}
                          <Chip
                            size="small"
                            label={req.urgency}
                            variant="outlined"
                            sx={{
                              textTransform: 'uppercase',
                              fontSize: 10,
                              borderRadius: '999px',
                              borderColor: req.urgency === 'high' ? 'error.main' : req.urgency === 'medium' ? 'warning.main' : 'success.main',
                              color: req.urgency === 'high' ? 'error.main' : req.urgency === 'medium' ? 'warning.main' : 'success.main',
                              fontWeight: 600,
                              letterSpacing: 0.5,
                            }}
                          />
                          {/* Status: MUI dropdown for staff/owner/admin (no box), pill for guests */}
                          {isStaffOrOwner ? (
                            <TextField
                              select
                              size="small"
                              value={req.status}
                              onChange={(e) => handleUpdateStatus(req.id, e.target.value)}
                              variant="standard"
                              sx={{
                                minWidth: 110,
                                '& .MuiInputBase-root': { fontSize: 12, color: req.status === 'completed' ? 'success.main' : 'text.primary' },
                                '& .MuiSelect-select': { py: 0.25, display: 'flex', alignItems: 'center', gap: 0.5 },
                              }}
                              SelectProps={{
                                renderValue: (value) => (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {value === 'completed' ? <CheckCircleOutlineIcon sx={{ fontSize: 16 }} color="success" /> : <PendingIcon sx={{ fontSize: 16, color: 'action.active' }} />}
                                    <Typography variant="body2" sx={{ fontSize: 12, textTransform: 'capitalize' }}>
                                      {value}
                                    </Typography>
                                  </Box>
                                ),
                              }}
                            >
                              <MenuItem value="pending">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <PendingIcon sx={{ fontSize: 16, color: 'action.active' }} />
                                  <Typography variant="body2" sx={{ fontSize: 12 }}>
                                    Pending
                                  </Typography>
                                </Box>
                              </MenuItem>
                              <MenuItem value="completed">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <CheckCircleOutlineIcon sx={{ fontSize: 16 }} color="success" />
                                  <Typography variant="body2" sx={{ fontSize: 12 }}>
                                    Completed
                                  </Typography>
                                </Box>
                              </MenuItem>
                            </TextField>
                          ) : (
                            <Chip
                              size="small"
                              icon={req.status === 'completed' ? <CheckCircleOutlineIcon sx={{ fontSize: 14 }} /> : <PendingIcon sx={{ fontSize: 14 }} />}
                              label={req.status === 'completed' ? 'Completed' : 'Pending'}
                              variant={req.status === 'completed' ? 'filled' : 'outlined'}
                              color={req.status === 'completed' ? 'success' : 'default'}
                              sx={{
                                textTransform: 'none',
                                fontSize: 12,
                                pl: 0.5,
                                pr: 1,
                                '& .MuiChip-icon': { ml: 0.25 },
                              }}
                            />
                          )}
                        </Stack>
                      </Box>

                      {Array.isArray(req.userNotes) && req.userNotes.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            User notes
                          </Typography>
                          <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                            {req.userNotes.map((note, idx) => (
                              <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                                <Typography variant="body2">{note.text}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatRelativeTime(note.addedAt)}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      )}

                      {Array.isArray(req.staffNotes) && req.staffNotes.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Staff notes
                          </Typography>
                          <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                            {req.staffNotes.map((note, idx) => (
                              <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                                <Typography variant="body2">{note.text}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatRelativeTime(note.addedAt)}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      )}

                      {(isGuest || isStaffOrOwner) && (
                        <Box sx={{ mt: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              minRows={1}
                              maxRows={3}
                              label="Add note"
                              value={pendingNotes[req.id] ?? ''}
                              onChange={(e) =>
                                setPendingNotes((prev) => ({
                                  ...prev,
                                  [req.id]: e.target.value,
                                }))
                              }
                            />
                            <IconButton size="small" color="primary" onClick={() => handleAppendNote(req.id)} disabled={!pendingNotes[req.id]?.trim()} aria-label="Add note">
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>

        <Dialog open={showDeleteConfirm} onClose={handleDeleteCancel} aria-labelledby="delete-booking-title" aria-describedby="delete-booking-description">
          <DialogTitle id="delete-booking-title">Delete booking</DialogTitle>
          <DialogContent>
            <DialogContentText id="delete-booking-description">Are you sure you want to delete this booking? This cannot be undone.</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel} color="primary" autoFocus>
              Cancel
            </Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </MotionBox>
    </Container>
  );
}

export default BookingDetails;
