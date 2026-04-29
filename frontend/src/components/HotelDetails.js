import React, { useEffect, useState, useRef } from 'react';
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
  Grid,
  TableCell,
  TableRow,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
} from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import MapComponent from './MapComponent';
import DataTable from './DataTable';
import HotelInfoCard from './HotelInfoCard';
import ManageRestaurant from './ManageRestaurant';
import { useHotelTheme } from '../context/HotelThemeContext';
import constants from '../constants.json';
import { generateAndPlayTone } from '../utils/audioToneGenerator';
import { getNotificationTone, createAudioFromBlob } from '../utils/notificationToneCache';

const MotionBox = motion(Box);

const hoursFieldConfigs = [
  { key: 'checkInTime', label: 'Check-in Time', type: 'time' },
  { key: 'checkOutTime', label: 'Check-out Time', type: 'time' },
  { key: 'poolHours', label: 'Pool Hours' },
  { key: 'gymHours', label: 'Gym Hours' },
  { key: 'restaurantHours', label: 'Restaurant Hours' },
  { key: 'wifiPassword', label: 'Wi-Fi Password' },
  { key: 'breakfastHours', label: 'Breakfast Hours' },
  { key: 'lunchHours', label: 'Lunch Hours' },
  { key: 'dinnerHours', label: 'Dinner Hours' },
  { key: 'snacksHours', label: 'Snacks Hours' },
  { key: 'houseKeepingHours', label: 'House Keeping Hours' },
  { key: 'roomServiceHours', label: 'Room Service Hours' },
];

const HoursEditField = ({ data, editValues, handleInputChange }) => {
  return (
    <Grid item xs={12} sm={6}>
      <TextField
        fullWidth
        label={data.label}
        type={data.type || 'text'}
        value={editValues[data.key] || ''}
        onChange={handleInputChange(data.key)}
        inputProps={data.type === 'time' ? { step: 60 } : undefined}
      />
    </Grid>
  );
};

const StaffRow = ({ data, CAN_MANAGE_STAFF, onRevoke }) => {
  const staff = data;
  const handleRevoke = (e) => {
    e.stopPropagation();
    if (onRevoke && staff.id) onRevoke(staff.id);
  };
  return (
    <TableRow>
      <TableCell>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {staff.name || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {staff.email || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        {CAN_MANAGE_STAFF && (
          <Button size="small" color="secondary" variant="outlined" onClick={handleRevoke}>
            Revoke
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
};

function HotelDetails({ loading, setLoading, account, navigate, alertSuccess, alertError, isLoading, isMobile }) {
  const { id } = useParams();
  const { setThemeConfig } = useHotelTheme();
  const [hotel, setHotel] = useState(null);
  const [staff, setStaff] = useState([]);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteHotelConfirm, setShowDeleteHotelConfirm] = useState(false);
  const [brandEditOpen, setBrandEditOpen] = useState(false);
  const [brandEditValues, setBrandEditValues] = useState({});
  const logoInputRef = useRef(null);
  const toneInputRef = useRef(null);
  const [logoUploadFile, setLogoUploadFile] = useState(null);
  const [logoUploadLoading, setLogoUploadLoading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState(null);
  const [toneUploadFile, setToneUploadFile] = useState(null);
  const [toneUploadLoading, setToneUploadLoading] = useState(false);
  const [toneUploadError, setToneUploadError] = useState(null);
  const [tonePlaying, setTonePlaying] = useState(false);
  const [editValues, setEditValues] = useState({
    name: '',
    address: '',
    checkInTime: '',
    checkOutTime: '',
    poolHours: '',
    gymHours: '',
    restaurantHours: '',
    wifiPassword: '',
    breakfastHours: '',
    lunchHours: '',
    dinnerHours: '',
    snacksHours: '',
    houseKeepingHours: '',
    roomServiceHours: '',
    llmInstructions: '',
    primaryColor: '',
    secondaryColor: '',
    primaryHoverColor: '',
    navyColor: '',
    navyLightColor: '',
    fontFamily: '',
    backgroundDefault: '',
    backgroundPaper: '',
    notificationTone: 'gentle_chime',
  });

  const fetchHotel = async () => {
    const data = await request({
      endpoint: `/hotels/${id}`,
      method: 'GET',
      setLoading,
      defaultData: null,
      alertError,
    });

    if (data) {
      setHotel(data);
      setThemeConfig(data.themeConfig || null);
      setEditValues({
        name: data.name || '',
        address: data.address || '',
        checkInTime: data.checkInTime || '',
        checkOutTime: data.checkOutTime || '',
        poolHours: data.poolHours || '',
        gymHours: data.gymHours || '',
        restaurantHours: data.restaurantHours || '',
        wifiPassword: data.wifiPassword || '',
        breakfastHours: data.breakfastHours || '',
        lunchHours: data.lunchHours || '',
        dinnerHours: data.dinnerHours || '',
        snacksHours: data.snacksHours || '',
        houseKeepingHours: data.houseKeepingHours || '',
        roomServiceHours: data.roomServiceHours || '',
        llmInstructions: data.llmInstructions || '',
        notificationTone: data.notificationTone || 'gentle_chime',
        primaryColor: data.themeConfig?.primaryColor || '',
        secondaryColor: data.themeConfig?.secondaryColor || '',
        primaryHoverColor: data.themeConfig?.primaryHoverColor || '',
        navyColor: data.themeConfig?.navyColor || '',
        navyLightColor: data.themeConfig?.navyLightColor || '',
        fontFamily: data.themeConfig?.fontFamily || '',
        backgroundDefault: data.themeConfig?.backgroundDefault || '',
        backgroundPaper: data.themeConfig?.backgroundPaper || '',
      });
    }
  };

  const CAN_MANAGE_STAFF = account && !!constants.PERMISSIONS.CAN_MANAGE_STAFF[account.role];

  const fetchStaff = async () => {
    if (!id || !CAN_MANAGE_STAFF) return;
    await request({
      endpoint: `/hotels/${id}/staff`,
      method: 'GET',
      setLoading: setLoading,
      setData: setStaff,
      defaultData: [],
      alertError,
    });
  };

  useEffect(() => {
    if (id) fetchHotel();
    if (CAN_MANAGE_STAFF) fetchStaff();
  }, [id]);

  useEffect(() => {
    return () => setThemeConfig(null);
  }, [setThemeConfig]);

  const canEdit = account && !!constants.PERMISSIONS.CAN_EDIT_HOTEL[account.role];
  const CAN_DELETE_HOTEL = account && !!constants.PERMISSIONS.CAN_DELETE_HOTEL[account.role];

  const handleAddStaff = async (e) => {
    e.preventDefault();
    const email = (newStaffEmail || '').trim();
    if (!email) {
      alertError && alertError('Email is required');
      return;
    }
    const result = await request({
      endpoint: `/hotels/${id}/staff`,
      method: 'POST',
      data: { email },
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result && result.success) {
      setNewStaffEmail('');
      fetchStaff();
    }
  };

  const handleRevokeStaff = async (accountId) => {
    const ok = await request({
      endpoint: `/hotels/${id}/staff/${accountId}`,
      method: 'DELETE',
      setLoading,
      alertSuccess,
      alertError,
    });
    if (ok && ok.success) {
      fetchStaff();
    }
  };

  const handleInputChange = (field) => (event) => {
    setEditValues((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const payload = { ...editValues };
    const themeObj = {};
    if (editValues.primaryColor?.trim()) themeObj.primaryColor = editValues.primaryColor.trim();
    if (editValues.secondaryColor?.trim()) themeObj.secondaryColor = editValues.secondaryColor.trim();
    if (editValues.primaryHoverColor?.trim()) themeObj.primaryHoverColor = editValues.primaryHoverColor.trim();
    if (editValues.navyColor?.trim()) themeObj.navyColor = editValues.navyColor.trim();
    if (editValues.navyLightColor?.trim()) themeObj.navyLightColor = editValues.navyLightColor.trim();
    if (editValues.fontFamily?.trim()) themeObj.fontFamily = editValues.fontFamily.trim();
    if (editValues.backgroundDefault?.trim()) themeObj.backgroundDefault = editValues.backgroundDefault.trim();
    if (editValues.backgroundPaper?.trim()) themeObj.backgroundPaper = editValues.backgroundPaper.trim();
    payload.themeConfig = Object.keys(themeObj).length ? themeObj : null;
    delete payload.primaryColor;
    delete payload.secondaryColor;
    delete payload.primaryHoverColor;
    delete payload.navyColor;
    delete payload.navyLightColor;
    delete payload.fontFamily;
    delete payload.backgroundDefault;
    delete payload.backgroundPaper;

    const updated = await request({
      endpoint: `/hotels/${id}`,
      method: 'PATCH',
      data: payload,
      setLoading,
      alertSuccess,
      alertError,
    });

    if (updated) {
      setHotel(updated);
      setThemeConfig(updated.themeConfig || null);
      setIsEditing(false);
    }
  };

  const handleBrandInputChange = (field) => (event) => {
    setBrandEditValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const openBrandEdit = () => {
    const brand = hotel?.brand || {};
    setBrandEditValues({
      checkInTime: brand.checkInTime || '',
      checkOutTime: brand.checkOutTime || '',
      poolHours: brand.poolHours || '',
      gymHours: brand.gymHours || '',
      restaurantHours: brand.restaurantHours || '',
      wifiPassword: brand.wifiPassword || '',
      breakfastHours: brand.breakfastHours || '',
      lunchHours: brand.lunchHours || '',
      dinnerHours: brand.dinnerHours || '',
      snacksHours: brand.snacksHours || '',
      houseKeepingHours: brand.houseKeepingHours || '',
      roomServiceHours: brand.roomServiceHours || '',
      llmInstructions: brand.llmInstructions || '',
      primaryColor: brand.themeConfig?.primaryColor || '',
      secondaryColor: brand.themeConfig?.secondaryColor || '',
    });
    setBrandEditOpen(true);
  };

  const handleBrandSave = async () => {
    const themeObj = {};
    if (brandEditValues.primaryColor?.trim()) themeObj.primaryColor = brandEditValues.primaryColor.trim();
    if (brandEditValues.secondaryColor?.trim()) themeObj.secondaryColor = brandEditValues.secondaryColor.trim();
    const payload = { ...brandEditValues, themeConfig: Object.keys(themeObj).length ? themeObj : null };
    delete payload.primaryColor;
    delete payload.secondaryColor;
    const result = await request({
      endpoint: `/hotels/brands/${hotel.brand.id}`,
      method: 'PATCH',
      data: payload,
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result?.success) {
      setBrandEditOpen(false);
      fetchHotel();
    }
  };

  const handleDeleteHotelClick = () => setShowDeleteHotelConfirm(true);
  const handleDeleteHotelCancel = () => setShowDeleteHotelConfirm(false);

  const handleDeleteHotelConfirm = async () => {
    setShowDeleteHotelConfirm(false);
    if (!id) return;
    const result = await request({
      endpoint: `/hotels/${id}`,
      method: 'DELETE',
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result && result.success) {
      navigate('/hotels');
    }
  };

  const handleLogoFileSelect = (event) => {
    const file = event.target.files?.[0];
    setLogoUploadError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoUploadError('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoUploadError('File size must not exceed 5MB');
      return;
    }
    setLogoUploadFile(file);
  };

  const handleLogoUpload = async () => {
    if (!logoUploadFile || !id) return;
    setLogoUploadLoading(true);
    setLogoUploadError(null);

    try {
      const presignedRes = await request({
        endpoint: `/hotels/${id}/logo/presigned-url`,
        method: 'POST',
        data: { fileName: logoUploadFile.name, fileSize: logoUploadFile.size, contentType: logoUploadFile.type },
        throw: true,
      });
      const { presignedUrl, s3Url } = presignedRes?.data || {};

      const s3Response = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': logoUploadFile.type },
        body: logoUploadFile,
      });
      if (!s3Response.ok) throw new Error(`S3 upload failed (${s3Response.status})`);

      const result = await request({
        endpoint: `/hotels/${id}/logo`,
        method: 'PATCH',
        data: { s3Url },
        throw: true,
      });
      if (result.success) {
        alertSuccess('Logo uploaded successfully!');
        setLogoUploadFile(null);
        setHotel((prev) => ({ ...prev, logoUrl: result.data?.logoUrl }));
      }
    } catch (error) {
      setLogoUploadError(error.message || 'Failed to upload logo');
      alertError(`Logo upload failed: ${error.message}`);
    } finally {
      setLogoUploadLoading(false);
    }
  };

  const handleToneFileSelect = (event) => {
    const file = event.target.files?.[0];
    setToneUploadError(null);
    if (!file) return;

    // Validate file type
    if (!file.type.includes('audio')) {
      setToneUploadError('Only audio files are allowed');
      return;
    }

    // Validate file size (5MB)
    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
      setToneUploadError(`File size must not exceed ${maxSizeMB}MB`);
      return;
    }

    setToneUploadFile(file);
  };

  const handleToneUpload = async () => {
    if (!toneUploadFile || !id) {
      setToneUploadError('No file selected');
      return;
    }

    setToneUploadLoading(true);
    setToneUploadError(null);

    try {
      const presignedRes = await request({
        endpoint: `/hotels/${id}/notification-tone/presigned-url`,
        method: 'POST',
        data: { fileName: toneUploadFile.name, fileSize: toneUploadFile.size, contentType: toneUploadFile.type || 'audio/mpeg' },
        throw: true,
      });
      const { presignedUrl, s3Url } = presignedRes?.data || {};

      const s3Response = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': toneUploadFile.type || 'audio/mpeg' },
        body: toneUploadFile,
      });
      if (!s3Response.ok) throw new Error(`S3 upload failed (${s3Response.status})`);

      const result = await request({
        endpoint: `/hotels/${id}/notification-tone`,
        method: 'PATCH',
        data: { s3Url },
        throw: true,
      });

      if (result.success) {
        alertSuccess('Notification tone uploaded successfully!');
        setToneUploadFile(null);
        setToneUploadError(null);

        setEditValues((prev) => ({
          ...prev,
          notificationTone: 'custom',
        }));

        setHotel((prev) => ({
          ...prev,
          customToneUrl: result.data?.customToneUrl,
          notificationTone: 'custom',
        }));

        setTimeout(() => {
          fetchHotel();
        }, 500);
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      setToneUploadError(error.message || 'Failed to upload tone');
      alertError(`Tone upload failed: ${error.message}`);
    } finally {
      setToneUploadLoading(false);
    }
  };

  const getToneUrlByName = (toneName) => {
    const toneUrls = {
      none: null,
      gentle_chime: '/assets/tones/gentle_chime.mp3',
      alert_sound: '/assets/tones/alert_sound.mp3',
    };
    return toneUrls[toneName] || null;
  };

  const hasToneSelected = () => {
    const toneName = editValues.notificationTone;
    if (toneName === 'none') return false;
    if (toneName === 'custom') return !!hotel?.customToneUrl;
    return true;
  };

  const getToneUrl = () => {
    const toneName = editValues.notificationTone;

    // For custom tones, use the URL from hotel data
    if (toneName === 'custom' && hotel?.customToneUrl) {
      const customUrl = hotel.customToneUrl;

      // If it's an S3 URL, use it as-is
      if (customUrl.startsWith('https://')) {
        return customUrl;
      }

      // If it's a local backend URL, add the backend URL prefix
      if (customUrl.startsWith('/uploads/')) {
        return `${process.env.REACT_APP_BACKEND_URL || ''}${customUrl}`;
      }

      // If it's a built-in tone name fallback, use that
      if (customUrl === 'gentle_chime' || customUrl === 'alert_sound') {
        return getToneUrlByName(customUrl);
      }

      // Default fallback
      return getToneUrlByName('gentle_chime');
    }

    // For built-in tones, return frontend relative path
    return getToneUrlByName(toneName);
  };

  const handlePlayTone = async () => {
    const toneName = editValues.notificationTone;

    if (toneName === 'none') {
      alertError('Silent tone selected');
      setTonePlaying(false);
      return;
    }

    setTonePlaying(true);

    // Built-in tones: use Web Audio API (always works offline)
    if (toneName === 'gentle_chime' || toneName === 'alert_sound') {
      try {
        const success = await generateAndPlayTone(toneName, toneName === 'gentle_chime' ? 900 : 500);
        if (success) {
          setTimeout(() => setTonePlaying(false), toneName === 'gentle_chime' ? 1000 : 600);
          return;
        }
      } catch (error) {
        // Fallback to MP3 if Web Audio API fails
      }
    }

    // Custom tone: use IndexedDB cache (download once, serve from blob)
    if (toneName === 'custom' && hotel?.customToneUrl?.startsWith('https://')) {
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
        const token = localStorage.getItem('token') || '';
        const blob = await getNotificationTone(Number(id), hotel.customToneUrl, backendUrl, token);
        if (blob) {
          const audio = createAudioFromBlob(blob);
          audio.volume = 0.7;

          const onEnded = () => {
            setTonePlaying(false);
            audio.removeEventListener('ended', onEnded);
            URL.revokeObjectURL(audio.src);
          };
          audio.addEventListener('ended', onEnded);

          audio.onerror = () => {
            setTonePlaying(false);
            alertError('Failed to load tone file');
            URL.revokeObjectURL(audio.src);
          };

          audio.play().catch((err) => {
            setTonePlaying(false);
            URL.revokeObjectURL(audio.src);
            if (err.name === 'NotAllowedError') alertError('Click on page first, then try again');
            else alertError(`Failed to play tone: ${err.message}`);
          });
          return;
        }
      } catch (error) {
        console.warn('Cache lookup failed, falling back to direct URL:', error);
      }
    }

    // Fallback: play via direct URL (built-in MP3 or non-cached custom URL)
    const toneUrl = getToneUrl();
    if (!toneUrl) {
      alertError('No tone selected');
      setTonePlaying(false);
      return;
    }

    try {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = toneUrl;
      audio.volume = 0.7;

      const onEnded = () => {
        setTonePlaying(false);
        audio.removeEventListener('ended', onEnded);
      };
      audio.addEventListener('ended', onEnded);

      audio.onerror = () => {
        setTonePlaying(false);
        alertError('Failed to load tone file');
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          setTonePlaying(false);
          if (error.name === 'NotAllowedError') alertError('Click on page first, then try again');
          else alertError(`Failed to play tone: ${error.message}`);
        });
      }
    } catch (error) {
      alertError('Failed to play tone');
      setTonePlaying(false);
    }
  };

  if (!hotel) {
    return;
  }

  return (
    <Container maxWidth="md" sx={{ py: 4, py: 4 }}>
      <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h4">Hotel</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {canEdit && (
                  <Button variant="contained" color="primary" onClick={() => setIsEditing((prev) => !prev)}>
                    {isEditing ? 'Cancel' : 'Edit'}
                  </Button>
                )}
                {CAN_DELETE_HOTEL && (
                  <Button variant="outlined" color="error" onClick={handleDeleteHotelClick}>
                    Delete Hotel
                  </Button>
                )}
              </Box>
            </Box>

            {isEditing ? (
              <Box component="form" onSubmit={handleSave} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Name" value={editValues.name} onChange={handleInputChange('name')} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Address" value={editValues.address} onChange={handleInputChange('address')} />
                  </Grid>
                  <MapComponent Component={HoursEditField} data={hoursFieldConfigs} editValues={editValues} handleInputChange={handleInputChange} showNoDataAvailable={false} isLoading={loading} />
                </Grid>

                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    LLM instructions
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Free text added to the AI system prompt for this hotel. Use for hotel-specific guidance (e.g. policies, tone, amenities to emphasize).
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    label="Hotel-specific LLM instructions"
                    value={editValues.llmInstructions || ''}
                    onChange={handleInputChange('llmInstructions')}
                    placeholder="e.g. Always mention our complimentary breakfast. We are a boutique eco-friendly hotel."
                  />
                </Box>

                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Theme
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Customize UI colors for guests viewing this hotel. Leave empty for defaults.
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Primary color"
                        value={editValues.primaryColor || ''}
                        onChange={handleInputChange('primaryColor')}
                        placeholder="#D4AF37"
                        InputProps={{
                          endAdornment: (
                            <input
                              type="color"
                              value={editValues.primaryColor || '#D4AF37'}
                              onChange={(e) => handleInputChange('primaryColor')({ target: { value: e.target.value } })}
                              style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                            />
                          ),
                        }}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Secondary color"
                        value={editValues.secondaryColor || ''}
                        onChange={handleInputChange('secondaryColor')}
                        placeholder="#C5A022"
                        InputProps={{
                          endAdornment: (
                            <input
                              type="color"
                              value={editValues.secondaryColor || '#C5A022'}
                              onChange={(e) => handleInputChange('secondaryColor')({ target: { value: e.target.value } })}
                              style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                            />
                          ),
                        }}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Primary hover color"
                        value={editValues.primaryHoverColor || ''}
                        onChange={handleInputChange('primaryHoverColor')}
                        placeholder="#B8860B"
                        InputProps={{
                          endAdornment: (
                            <input
                              type="color"
                              value={editValues.primaryHoverColor || '#B8860B'}
                              onChange={(e) => handleInputChange('primaryHoverColor')({ target: { value: e.target.value } })}
                              style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                            />
                          ),
                        }}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Navy color (headings, dark bg)"
                        value={editValues.navyColor || ''}
                        onChange={handleInputChange('navyColor')}
                        placeholder="#1B2340"
                        InputProps={{
                          endAdornment: (
                            <input
                              type="color"
                              value={editValues.navyColor || '#1B2340'}
                              onChange={(e) => handleInputChange('navyColor')({ target: { value: e.target.value } })}
                              style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                            />
                          ),
                        }}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Navy light color (gradient end)"
                        value={editValues.navyLightColor || ''}
                        onChange={handleInputChange('navyLightColor')}
                        placeholder="#263462"
                        InputProps={{
                          endAdornment: (
                            <input
                              type="color"
                              value={editValues.navyLightColor || '#263462'}
                              onChange={(e) => handleInputChange('navyLightColor')({ target: { value: e.target.value } })}
                              style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                            />
                          ),
                        }}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Font family"
                        value={editValues.fontFamily || ''}
                        onChange={handleInputChange('fontFamily')}
                        placeholder='"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Background default" value={editValues.backgroundDefault || ''} onChange={handleInputChange('backgroundDefault')} placeholder="#F5F5F5 or #000000" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Background paper" value={editValues.backgroundPaper || ''} onChange={handleInputChange('backgroundPaper')} placeholder="#FFFFFF or #121212" />
                    </Grid>
                  </Grid>
                </Box>

                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Hotel Logo
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Displayed in the guest portal header. Recommended: square or wide image, PNG/JPG, max 5MB.
                  </Typography>
                  {hotel?.logoUrl && (
                    <Box sx={{ mb: 2 }}>
                      <Box component="img" src={hotel.logoUrl} alt="Hotel logo" sx={{ maxHeight: 80, maxWidth: 240, objectFit: 'contain', borderRadius: 2, border: '1px solid', borderColor: 'divider' }} />
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoFileSelect} disabled={logoUploadLoading} style={{ display: 'none' }} />
                    <Button variant="outlined" onClick={() => logoInputRef.current?.click()} disabled={logoUploadLoading} sx={{ alignSelf: 'flex-start' }}>
                      {logoUploadFile ? logoUploadFile.name : 'Choose Image'}
                    </Button>
                    {logoUploadFile && (
                      <Typography variant="caption">
                        {(logoUploadFile.size / 1024 / 1024).toFixed(2)}MB
                      </Typography>
                    )}
                    {logoUploadError && <Alert severity="error">{logoUploadError}</Alert>}
                    {logoUploadFile && (
                      <Button variant="contained" color="success" onClick={handleLogoUpload} disabled={logoUploadLoading} sx={{ mt: 1, alignSelf: 'flex-start' }}>
                        {logoUploadLoading ? (
                          <>
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                            Uploading...
                          </>
                        ) : (
                          'Upload Logo'
                        )}
                      </Button>
                    )}
                  </Box>
                </Box>

                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Notification Tone
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Choose a notification sound for guests and staff. Select from built-in options or upload a custom MP3 file.
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Notification Tone</InputLabel>
                        <Select value={editValues.notificationTone || 'gentle_chime'} onChange={handleInputChange('notificationTone')} label="Notification Tone">
                          <MenuItem value="none">Silent (No Sound)</MenuItem>
                          <MenuItem value="gentle_chime">Gentle Chime</MenuItem>
                          <MenuItem value="alert_sound">Alert Sound</MenuItem>
                          {(hotel?.customToneUrl?.startsWith('https://') || hotel?.customToneUrl?.startsWith('/uploads/')) && <MenuItem value="custom">Custom Tone</MenuItem>}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Button variant="outlined" fullWidth onClick={handlePlayTone} disabled={tonePlaying || !hasToneSelected()}>
                        {tonePlaying ? <CircularProgress size={24} sx={{ mr: 1 }} /> : '🔊'}
                        {tonePlaying ? ' Playing...' : ' Test Tone'}
                      </Button>
                    </Grid>

                    <Grid item xs={12}>
                      <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Upload Custom Tone (Optional)
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                          MP3 file only, max 5MB. Once uploaded, you can select it as your notification tone.
                        </Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <input ref={toneInputRef} type="file" accept="audio/*" onChange={handleToneFileSelect} disabled={toneUploadLoading} style={{ display: 'none' }} />
                          <Button variant="outlined" onClick={() => toneInputRef.current?.click()} disabled={toneUploadLoading} sx={{ alignSelf: 'flex-start' }}>
                            {toneUploadFile ? toneUploadFile.name : 'Choose MP3'}
                          </Button>
                          {toneUploadFile && (
                            <Typography variant="caption">
                              {(toneUploadFile.size / 1024 / 1024).toFixed(2)}MB
                            </Typography>
                          )}

                          {toneUploadError && (
                            <Alert severity="error" sx={{ mb: 1 }}>
                              {toneUploadError}
                            </Alert>
                          )}

                          {toneUploadFile && (
                            <Button variant="contained" color="success" onClick={handleToneUpload} disabled={toneUploadLoading} sx={{ mt: 1 }}>
                              {toneUploadLoading ? (
                                <>
                                  <CircularProgress size={20} sx={{ mr: 1 }} />
                                  Uploading...
                                </>
                              ) : (
                                '⬆️ Upload Custom Tone'
                              )}
                            </Button>
                          )}

                          {hotel?.customToneUrl && (
                            <Typography variant="caption" sx={{ color: 'success.main', mt: 1 }}>
                              ✅ Custom tone uploaded
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="submit" variant="contained" color="primary">
                    Save Changes
                  </Button>
                </Box>
              </Box>
            ) : (
              <HotelInfoCard hotel={hotel} loading={loading} />
            )}

            {hotel?.brand && (
              <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">Brand: {hotel.brand.name}</Typography>
                  {canEdit && (
                    <Button variant="outlined" size="small" onClick={openBrandEdit}>Edit Brand</Button>
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Brand-level defaults inherited by all {hotel.brand.name} properties.
                </Typography>
              </Box>
            )}

            {CAN_MANAGE_STAFF && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Hotel Staff
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Add staff by email. They will receive an email to log in.
                </Typography>
                <Box component="form" onSubmit={handleAddStaff} sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
                  <TextField size="small" label="Staff email" type="email" value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} sx={{ minWidth: 240 }} />
                  <Button type="submit" variant="contained" color="primary" size="medium">
                    Add Staff
                  </Button>
                </Box>
                <DataTable
                  columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'actions', label: 'Actions' },
                  ]}
                  RowComponent={StaffRow}
                  data={staff}
                  isLoading={isLoading}
                  CAN_MANAGE_STAFF={CAN_MANAGE_STAFF}
                  onRevoke={handleRevokeStaff}
                />
              </Box>
            )}

            {canEdit && <ManageRestaurant hotelId={id} loading={loading} setLoading={setLoading} account={account} alertSuccess={alertSuccess} alertError={alertError} isMobile={isMobile} />}

            <Dialog open={brandEditOpen} onClose={() => setBrandEditOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Edit Brand — {hotel?.brand?.name}</DialogTitle>
              <DialogContent>
                <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Grid container spacing={2}>
                    <MapComponent Component={HoursEditField} data={hoursFieldConfigs} editValues={brandEditValues} handleInputChange={handleBrandInputChange} showNoDataAvailable={false} isLoading={loading} />
                  </Grid>
                  <TextField fullWidth multiline minRows={3} label="Brand LLM instructions" value={brandEditValues.llmInstructions || ''} onChange={handleBrandInputChange('llmInstructions')} placeholder="Brand-level AI guidance applied to all properties" />
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField fullWidth label="Primary color" value={brandEditValues.primaryColor || ''} onChange={handleBrandInputChange('primaryColor')} placeholder="#D4AF37"
                        InputProps={{ endAdornment: <input type="color" value={brandEditValues.primaryColor || '#D4AF37'} onChange={(e) => handleBrandInputChange('primaryColor')({ target: { value: e.target.value } })} style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} /> }}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField fullWidth label="Secondary color" value={brandEditValues.secondaryColor || ''} onChange={handleBrandInputChange('secondaryColor')} placeholder="#C5A022"
                        InputProps={{ endAdornment: <input type="color" value={brandEditValues.secondaryColor || '#C5A022'} onChange={(e) => handleBrandInputChange('secondaryColor')({ target: { value: e.target.value } })} style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} /> }}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setBrandEditOpen(false)}>Cancel</Button>
                <Button onClick={handleBrandSave} variant="contained" disabled={loading}>Save</Button>
              </DialogActions>
            </Dialog>

            <Dialog open={showDeleteHotelConfirm} onClose={handleDeleteHotelCancel} aria-labelledby="delete-hotel-title" aria-describedby="delete-hotel-description">
              <DialogTitle id="delete-hotel-title">Delete hotel</DialogTitle>
              <DialogContent>
                <DialogContentText id="delete-hotel-description">Are you sure you want to delete this hotel? All bookings and staff links will be removed. This cannot be undone.</DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleDeleteHotelCancel} color="primary" autoFocus>
                  Cancel
                </Button>
                <Button onClick={handleDeleteHotelConfirm} color="error" variant="contained">
                  Delete
                </Button>
              </DialogActions>
            </Dialog>
          </CardContent>
        </Card>
      </MotionBox>
    </Container>
  );
}

export default HotelDetails;
