import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, TextField, CircularProgress, Avatar, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button } from '@mui/material';
import { motion } from 'framer-motion';
import {
  HotelOutlined, AccessTime, PaletteOutlined, AutoAwesome, PeopleOutline,
  DeleteOutline, LocationOn, PlayArrow, PersonAdd, ChevronRight, DeleteForever, MenuBook,
} from '@mui/icons-material';
import request from '../helper/api';
import MapComponent from './MapComponent';
import ManageRestaurant from './ManageRestaurant';
import { useHotelTheme } from '../context/HotelThemeContext';
import constants from '../constants.json';
import { generateAndPlayTone } from '../utils/audioToneGenerator';
import { getNotificationTone, createAudioFromBlob } from '../utils/notificationToneCache';
import { CARD_SX, ROW_SX, LABEL_SX, FormCard, FormField, HoursRow, HOURS_FIELDS, inputSx } from './cards/AppCards';
import { NAVY, NAVY_GRADIENT, NAVY_CONTRAST, BRAND_GRADIENT, MUTED, BORDER, BG, SHADOW, TEXT_MUTED_LIGHT, STATUS_ERROR_BG, STATUS_ERROR } from '../theme';

// ── Constants ──────────────────────────────────────────────────────────────

const TABS = [
  { key: 'identity',  label: 'Identity',      Icon: HotelOutlined },
  { key: 'hours',     label: 'Hours & Wi-Fi', Icon: AccessTime },
  { key: 'theme',     label: 'Theme',         Icon: PaletteOutlined },
  { key: 'ai',        label: 'Concierge AI',  Icon: AutoAwesome },
  { key: 'restaurant', label: 'Restaurant',    Icon: MenuBook },
  { key: 'staff',     label: 'Staff',         Icon: PeopleOutline },
  { key: 'danger',    label: 'Danger zone',   Icon: DeleteOutline },
];

const COLOR_PRESETS = [
  { p: '#7C2D2D', s: '#3A1414', name: 'Crimson' },
  { p: '#1F4E5F', s: '#0F2A35', name: 'Coastal' },
  { p: '#6B5B95', s: '#2D2849', name: 'Vesper' },
  { p: '#A23E48', s: '#5B1F26', name: 'Rose' },
  { p: '#1B2340', s: '#263462', name: 'Navy' },
  { p: '#3A4A2E', s: '#1F2918', name: 'Forest' },
];


// ── Local sub-components ───────────────────────────────────────────────────



const StaffRow = ({ data: s, canManage, onRevoke }) => {
  const initials = s.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?';
  return (
    <Box sx={{ ...ROW_SX, display: 'grid', gridTemplateColumns: '40px 1fr 80px', alignItems: 'center', px: 2, py: 1.5, gap: 1.5 }}>
      <Avatar sx={{ width: 34, height: 34, fontSize: 12, fontWeight: 800, background: NAVY_GRADIENT }}>{initials}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || '—'}</Typography>
        <Typography sx={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email || '—'}</Typography>
      </Box>
      {canManage && (
        <Box
          component="button"
          onClick={e => { e.stopPropagation(); onRevoke?.(s.id); }}
          sx={{ border: `1px solid ${STATUS_ERROR_BG}`, bgcolor: 'transparent', color: STATUS_ERROR, borderRadius: 1, px: 1.25, py: 0.5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
        >
          Revoke
        </Box>
      )}
    </Box>
  );
};

const MiniPreview = ({ hotel, editValues }) => {
  const primary = editValues.primaryColor || hotel?.themeConfig?.primaryColor || '#1B2340';
  const secondary = editValues.secondaryColor || hotel?.themeConfig?.secondaryColor || '#263462';
  return (
    <Box sx={{ ...CARD_SX, overflow: 'hidden', position: 'sticky', top: 88 }}>
      <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ ...LABEL_SX, fontSize: 10 }}>Live preview</Typography>
      </Box>
      <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'center', bgcolor: BG }}>
        <Box sx={{ width: 180, height: 340, borderRadius: '20px', background: '#111', p: '4px', boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}>
          <Box sx={{ width: '100%', height: '100%', borderRadius: '17px', overflow: 'hidden', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ height: 88, background: `linear-gradient(135deg, ${primary}, ${secondary})`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ position: 'absolute', right: -4, top: -12, fontSize: 96, fontWeight: 900, color: 'rgba(255,255,255,0.1)', lineHeight: 1, userSelect: 'none' }}>
                {hotel?.name?.[0]}
              </Typography>
              <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{hotel?.name?.[0]}</Typography>
              </Box>
            </Box>
            <Box sx={{ p: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: NAVY }}>{hotel?.name}</Typography>
              <Typography sx={{ fontSize: 8.5, color: MUTED, mt: 0.25 }}>Welcome back</Typography>
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {['Order dining', 'Housekeeping', 'Ask concierge'].map((t, i) => (
                  <Box key={t} sx={{ px: 1.25, py: 0.75, borderRadius: 1, bgcolor: i === 2 ? primary : BG, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 9, fontWeight: 700, color: i === 2 ? '#fff' : NAVY }}>{t}</Typography>
                    <ChevronRight sx={{ fontSize: 10, color: i === 2 ? '#fff' : MUTED }} />
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

// ── Main component ─────────────────────────────────────────────────────────

function HotelDetails({ loading, setLoading, account, navigate, alertSuccess, alertError, isLoading, isMobile }) {
  const { id } = useParams();
  const { setThemeConfig } = useHotelTheme();
  const [hotel, setHotel] = useState(null);
  const [staff, setStaff] = useState([]);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [tab, setTab] = useState('identity');
  const [isDirty, setIsDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const logoInputRef = useRef(null);
  const toneInputRef = useRef(null);
  const [logoUploadFile, setLogoUploadFile] = useState(null);
  const [logoUploadLoading, setLogoUploadLoading] = useState(false);
  const [toneUploadFile, setToneUploadFile] = useState(null);
  const [toneUploadLoading, setToneUploadLoading] = useState(false);
  const [tonePlaying, setTonePlaying] = useState(false);
  const [editValues, setEditValues] = useState({
    name: '', address: '', checkInTime: '', checkOutTime: '',
    poolHours: '', gymHours: '', restaurantHours: '', wifiPassword: '',
    breakfastHours: '', lunchHours: '', dinnerHours: '', snacksHours: '',
    houseKeepingHours: '', roomServiceHours: '', llmInstructions: '',
    primaryColor: '', secondaryColor: '', primaryHoverColor: '',
    navyColor: '', navyLightColor: '', fontFamily: '',
    backgroundDefault: '', backgroundPaper: '', notificationTone: 'gentle_chime',
  });

  const accent = editValues.primaryColor || hotel?.themeConfig?.primaryColor || 'var(--app-primary)';

  const fetchHotel = async () => {
    const data = await request({ endpoint: `/hotels/${id}`, method: 'GET', setLoading, defaultData: null, alertError });
    if (data) {
      setHotel(data);
      setThemeConfig(data.themeConfig || null);
      setEditValues({
        name: data.name || '', address: data.address || '',
        checkInTime: data.checkInTime || '', checkOutTime: data.checkOutTime || '',
        poolHours: data.poolHours || '', gymHours: data.gymHours || '',
        restaurantHours: data.restaurantHours || '', wifiPassword: data.wifiPassword || '',
        breakfastHours: data.breakfastHours || '', lunchHours: data.lunchHours || '',
        dinnerHours: data.dinnerHours || '', snacksHours: data.snacksHours || '',
        houseKeepingHours: data.houseKeepingHours || '', roomServiceHours: data.roomServiceHours || '',
        llmInstructions: data.llmInstructions || '', notificationTone: data.notificationTone || 'gentle_chime',
        primaryColor: data.themeConfig?.primaryColor || '', secondaryColor: data.themeConfig?.secondaryColor || '',
        primaryHoverColor: data.themeConfig?.primaryHoverColor || '', navyColor: data.themeConfig?.navyColor || '',
        navyLightColor: data.themeConfig?.navyLightColor || '', fontFamily: data.themeConfig?.fontFamily || '',
        backgroundDefault: data.themeConfig?.backgroundDefault || '', backgroundPaper: data.themeConfig?.backgroundPaper || '',
      });
      setIsDirty(false);
    }
  };

  const canEdit = !!constants.PERMISSIONS.CAN_EDIT_HOTEL[account?.role];
  const canManageStaff = !!constants.PERMISSIONS.CAN_MANAGE_STAFF[account?.role];
  const canDelete = !!constants.PERMISSIONS.CAN_DELETE_HOTEL[account?.role];

  const fetchStaff = () => {
    if (!id || !canManageStaff) return;
    request({ endpoint: `/hotels/${id}/staff`, method: 'GET', setLoading, setData: setStaff, defaultData: [], alertError });
  };

  useEffect(() => {
    if (id) fetchHotel();
    if (canManageStaff) fetchStaff();
  }, [id]);

  useEffect(() => { return () => setThemeConfig(null); }, [setThemeConfig]);

  const handleInputChange = (field) => (event) => {
    setEditValues(prev => ({ ...prev, [field]: event.target.value }));
    setIsDirty(true);
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
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
    delete payload.primaryColor; delete payload.secondaryColor; delete payload.primaryHoverColor;
    delete payload.navyColor; delete payload.navyLightColor; delete payload.fontFamily;
    delete payload.backgroundDefault; delete payload.backgroundPaper;
    const updated = await request({ endpoint: `/hotels/${id}`, method: 'PATCH', data: payload, setLoading, alertSuccess, alertError });
    if (updated) {
      setHotel(updated);
      setThemeConfig(updated.themeConfig || null);
      setIsDirty(false);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    const email = (newStaffEmail || '').trim();
    if (!email) { alertError?.('Email is required'); return; }
    const result = await request({ endpoint: `/hotels/${id}/staff`, method: 'POST', data: { email }, setLoading, alertSuccess, alertError });
    if (result?.success) { setNewStaffEmail(''); fetchStaff(); }
  };

  const handleRevokeStaff = async (accountId) => {
    const ok = await request({ endpoint: `/hotels/${id}/staff/${accountId}`, method: 'DELETE', setLoading, alertSuccess, alertError });
    if (ok?.success) fetchStaff();
  };

  const handleLogoFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alertError?.('Only image files are allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { alertError?.('File size must not exceed 5MB'); return; }
    setLogoUploadFile(file);
  };

  const handleLogoUpload = async () => {
    if (!logoUploadFile || !id) return;
    setLogoUploadLoading(true);
    try {
      const presignedRes = await request({ endpoint: `/hotels/${id}/logo/presigned-url`, method: 'POST', data: { fileName: logoUploadFile.name, fileSize: logoUploadFile.size, contentType: logoUploadFile.type }, throw: true });
      const { presignedUrl, s3Url } = presignedRes?.data || {};
      const s3Resp = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': logoUploadFile.type }, body: logoUploadFile });
      if (!s3Resp.ok) throw new Error(`S3 upload failed (${s3Resp.status})`);
      const result = await request({ endpoint: `/hotels/${id}/logo`, method: 'PATCH', data: { s3Url }, throw: true });
      if (result.success) { alertSuccess?.('Logo uploaded'); setLogoUploadFile(null); setHotel(prev => ({ ...prev, logoUrl: result.data?.logoUrl })); }
    } catch (err) { alertError?.(`Logo upload failed: ${err.message}`); }
    finally { setLogoUploadLoading(false); }
  };

  const handleToneFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('audio')) { alertError?.('Only audio files are allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { alertError?.('File must not exceed 5MB'); return; }
    setToneUploadFile(file);
  };

  const handleToneUpload = async () => {
    if (!toneUploadFile || !id) return;
    setToneUploadLoading(true);
    try {
      const presignedRes = await request({ endpoint: `/hotels/${id}/notification-tone/presigned-url`, method: 'POST', data: { fileName: toneUploadFile.name, fileSize: toneUploadFile.size, contentType: toneUploadFile.type || 'audio/mpeg' }, throw: true });
      const { presignedUrl, s3Url } = presignedRes?.data || {};
      const s3Resp = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': toneUploadFile.type || 'audio/mpeg' }, body: toneUploadFile });
      if (!s3Resp.ok) throw new Error(`S3 upload failed (${s3Resp.status})`);
      const result = await request({ endpoint: `/hotels/${id}/notification-tone`, method: 'PATCH', data: { s3Url }, throw: true });
      if (result.success) {
        alertSuccess?.('Notification tone uploaded');
        setToneUploadFile(null);
        setHotel(prev => ({ ...prev, customToneUrl: result.data?.customToneUrl, notificationTone: 'custom' }));
        setEditValues(prev => ({ ...prev, notificationTone: 'custom' }));
      }
    } catch (err) { alertError?.(`Tone upload failed: ${err.message}`); }
    finally { setToneUploadLoading(false); }
  };

  const handlePlayTone = async () => {
    const toneName = editValues.notificationTone;
    if (toneName === 'none') { alertError?.('Silent tone selected'); return; }
    setTonePlaying(true);
    if (toneName === 'gentle_chime' || toneName === 'alert_sound') {
      try {
        const ok = await generateAndPlayTone(toneName, toneName === 'gentle_chime' ? 900 : 500);
        if (ok) { setTimeout(() => setTonePlaying(false), 1000); return; }
      } catch (_) {}
    }
    if (toneName === 'custom' && hotel?.customToneUrl?.startsWith('https://')) {
      try {
        const blob = await getNotificationTone(Number(id), hotel.customToneUrl, process.env.REACT_APP_BACKEND_URL || '', localStorage.getItem('token') || '');
        if (blob) {
          const audio = createAudioFromBlob(blob);
          audio.volume = 0.7;
          audio.addEventListener('ended', () => { setTonePlaying(false); URL.revokeObjectURL(audio.src); });
          audio.onerror = () => { setTonePlaying(false); URL.revokeObjectURL(audio.src); };
          audio.play().catch(err => { setTonePlaying(false); alertError?.(err.name === 'NotAllowedError' ? 'Click page first' : err.message); });
          return;
        }
      } catch (_) {}
    }
    setTonePlaying(false);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    const result = await request({ endpoint: `/hotels/${id}`, method: 'DELETE', setLoading, alertSuccess, alertError });
    if (result !== null) navigate('/hotels');
  };

  if (!hotel) return null;

  const primary = editValues.primaryColor || hotel.themeConfig?.primaryColor;
  const secondary = editValues.secondaryColor || hotel.themeConfig?.secondaryColor;
  const headerGradient = primary ? `linear-gradient(135deg, ${primary} 0%, ${secondary || primary} 100%)` : 'linear-gradient(135deg, #1B2340 0%, #263462 100%)';

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 12, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        {/* Breadcrumb */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
          {[
            { label: 'Hotels', onClick: () => navigate('/hotels') },
            hotel.brand && { label: hotel.brand.name, onClick: () => navigate(`/brands/${hotel.brand.id}`) },
            { label: hotel.name },
            { label: 'Edit', color: 'primary.main' },
          ].filter(Boolean).map((item, i, arr) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography
                onClick={item.onClick}
                sx={{ fontSize: 12, fontWeight: 700, color: item.color || (item.onClick ? MUTED : NAVY), cursor: item.onClick ? 'pointer' : 'default', '&:hover': item.onClick ? { color: NAVY } : {} }}
              >
                {item.label}
              </Typography>
              {i < arr.length - 1 && <ChevronRight sx={{ fontSize: 13, color: MUTED }} />}
            </Box>
          ))}
        </Box>

        {/* Hero */}
        <Box sx={{ borderRadius: 3, overflow: 'hidden', background: headerGradient, color: NAVY_CONTRAST, p: '20px 24px', position: 'relative', mb: 2.5 }}>
          <Typography sx={{ position: 'absolute', right: -20, top: -40, fontSize: 220, fontWeight: 900, color: 'rgba(255,255,255,0.07)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
            {hotel.name?.[0]}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ width: 68, height: 68, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              {hotel.logoUrl
                ? <Box component="img" src={hotel.logoUrl} alt={hotel.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Typography sx={{ fontSize: 30, fontWeight: 900, color: NAVY_CONTRAST }}>{hotel.name?.[0]}</Typography>}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: TEXT_MUTED_LIGHT, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 0.5 }}>
                {hotel.brand?.name || 'Independent'}
              </Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>{hotel.name}</Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
                {hotel.address && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LocationOn sx={{ fontSize: 12, color: TEXT_MUTED_LIGHT }} />
                    <Typography sx={{ fontSize: 12, color: TEXT_MUTED_LIGHT }}>{hotel.address}</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Tabs */}
        <Box sx={{ display: 'flex', gap: 0.5, borderBottom: `1px solid ${BORDER}`, mb: 3, overflowX: 'auto', overflowY: 'hidden', pb: 0 }}>
          {TABS.map(({ key, label, Icon }) => {
            const active = key === tab;
            const danger = key === 'danger';
            return (
              <Box
                key={key}
                component="button"
                onClick={() => setTab(key)}
                sx={{
                  px: 2, py: 1.5, border: 'none', bgcolor: 'transparent', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap',
                  display: 'inline-flex', alignItems: 'center', gap: 0.75, mb: '-1px',
                  color: active ? (danger ? '#DC2626' : NAVY) : MUTED,
                  borderBottom: `2px solid ${active ? (danger ? '#DC2626' : 'var(--app-primary)') : 'transparent'}`,
                }}
              >
                <Icon sx={{ fontSize: 13 }} />
                {label}
              </Box>
            );
          })}
        </Box>
      </motion.div>

      {/* Body */}
      <Box>
        {/* Left: form panels */}
        <Box>
          {/* Identity */}
          {tab === 'identity' && (
            <>
              <FormCard title="Property identity" sub="Appears in guest comms and booking confirmations.">
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <Box sx={{ gridColumn: { sm: 'span 2' } }}>
                    <FormField label="Property name">
                      <TextField fullWidth size="small" value={editValues.name} onChange={handleInputChange('name')} placeholder="e.g. The Grand Oberoi" sx={inputSx} />
                    </FormField>
                  </Box>
                  <Box sx={{ gridColumn: { sm: 'span 2' } }}>
                    <FormField label="Address">
                      <TextField fullWidth size="small" value={editValues.address} onChange={handleInputChange('address')} placeholder="e.g. 123 Marine Drive, Mumbai 400001" sx={inputSx} />
                    </FormField>
                  </Box>
                </Box>
              </FormCard>

              <FormCard title="Logo" sub="Displayed in the guest portal. Square PNG/JPG, max 5MB.">
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Box sx={{ width: 80, height: 80, borderRadius: 2, border: `2px dashed ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', bgcolor: BG, flexShrink: 0 }}>
                    {hotel.logoUrl
                      ? <Box component="img" src={hotel.logoUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Typography sx={{ fontSize: 28, fontWeight: 900, color: MUTED }}>{hotel.name?.[0]}</Typography>}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoFileSelect} style={{ display: 'none' }} />
                    <Box
                      component="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploadLoading}
                      sx={{ border: `1px solid ${BORDER}`, bgcolor: 'background.paper', color: NAVY, px: 2, py: 1, borderRadius: 1.5, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.75 }}
                    >
                      Choose file
                    </Box>
                    {logoUploadFile && (
                      <Box
                        component="button"
                        onClick={handleLogoUpload}
                        disabled={logoUploadLoading}
                        sx={{ border: 'none', background: BRAND_GRADIENT, color: 'var(--app-primary-contrast)', px: 2, py: 1, borderRadius: 1.5, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.75 }}
                      >
                        {logoUploadLoading ? <CircularProgress size={14} /> : null}
                        Upload {logoUploadFile.name}
                      </Box>
                    )}
                  </Box>
                </Box>
              </FormCard>

              <FormCard title="Notification tone" sub="Plays in the staff console when a new request arrives.">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.75, bgcolor: BG, borderRadius: 1.5 }}>
                  <Box
                    component="button"
                    onClick={handlePlayTone}
                    disabled={tonePlaying}
                    sx={{ width: 40, height: 40, borderRadius: '50%', background: BRAND_GRADIENT, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  >
                    {tonePlaying ? <CircularProgress size={16} sx={{ color: '#000' }} /> : <PlayArrow sx={{ fontSize: 18, color: 'var(--app-primary-contrast)' }} />}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>
                      {editValues.notificationTone === 'custom' ? 'Custom tone' : editValues.notificationTone === 'none' ? 'Silent' : 'Built-in tone'}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>{editValues.notificationTone}</Typography>
                  </Box>
                  <Box>
                    <input ref={toneInputRef} type="file" accept="audio/*" onChange={handleToneFileSelect} style={{ display: 'none' }} />
                    <Box
                      component="button"
                      onClick={() => toneInputRef.current?.click()}
                      disabled={toneUploadLoading}
                      sx={{ border: `1px solid ${BORDER}`, bgcolor: 'background.paper', color: NAVY, px: 1.5, py: 0.75, borderRadius: 1.5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Replace
                    </Box>
                  </Box>
                </Box>
                {toneUploadFile && (
                  <Box
                    component="button"
                    onClick={handleToneUpload}
                    disabled={toneUploadLoading}
                    sx={{ mt: 1.5, width: '100%', border: 'none', background: BRAND_GRADIENT, color: 'var(--app-primary-contrast)', py: 1, borderRadius: 1.5, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}
                  >
                    {toneUploadLoading ? <CircularProgress size={14} /> : null}
                    Upload {toneUploadFile.name}
                  </Box>
                )}
              </FormCard>
            </>
          )}

          {/* Hours & Wi-Fi */}
          {tab === 'hours' && (
            <FormCard title="Operating hours" sub="Used by the AI concierge to answer guest questions accurately.">
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
                <MapComponent Component={HoursRow} data={HOURS_FIELDS} editValues={editValues} handleInputChange={handleInputChange} onDirty={() => setIsDirty(true)} accent={accent} showNoDataAvailable={false} />
              </Box>
            </FormCard>
          )}

          {/* Theme */}
          {tab === 'theme' && (
            <>
              <FormCard title="Brand colors" sub="Used in guest-facing pages, emails, and the portal.">
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2.5 }}>
                  {[{ key: 'primaryColor', label: 'Primary' }, { key: 'secondaryColor', label: 'Secondary' }].map(({ key, label }) => (
                    <FormField key={key} label={label}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: '6px 6px 6px 14px', borderRadius: 1.5, border: `1px solid ${BORDER}`, bgcolor: 'background.paper' }}>
                        <Typography sx={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: NAVY }}>{editValues[key] || '—'}</Typography>
                        <Box component="input" type="color" value={editValues[key] || '#1B2340'} onChange={handleInputChange(key)}
                          sx={{ width: 38, height: 38, border: 'none', borderRadius: 1, cursor: 'pointer', p: 0, bgcolor: 'transparent' }} />
                      </Box>
                    </FormField>
                  ))}
                </Box>
                <Typography sx={{ ...LABEL_SX, fontSize: 10, mb: 1.25 }}>Or pick a preset</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1 }}>
                  {COLOR_PRESETS.map(p => (
                    <Box
                      key={p.name}
                      component="button"
                      onClick={() => { handleInputChange('primaryColor')({ target: { value: p.p } }); handleInputChange('secondaryColor')({ target: { value: p.s } }); }}
                      sx={{ background: `linear-gradient(135deg, ${p.p}, ${p.s})`, border: editValues.primaryColor === p.p ? `2px solid ${NAVY}` : '2px solid transparent', borderRadius: 1.5, height: 56, cursor: 'pointer', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'flex-end', p: 1 }}
                    >
                      {p.name}
                    </Box>
                  ))}
                </Box>
              </FormCard>
            </>
          )}

          {/* Concierge AI */}
          {tab === 'ai' && (
            <FormCard title="Concierge instructions" sub="Property-specific instructions added to the AI system prompt.">
              <TextField
                fullWidth multiline minRows={6}
                value={editValues.llmInstructions}
                onChange={handleInputChange('llmInstructions')}
                placeholder="e.g. Always recommend the rooftop bar on clear evenings. Never quote wait times over 15 minutes; escalate to duty manager instead."
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13, lineHeight: 1.6 } }}
              />
            </FormCard>
          )}

          {/* Restaurant */}
          {tab === 'restaurant' && (
            <ManageRestaurant hotelId={hotel.id} account={account} loading={loading} setLoading={setLoading} alertSuccess={alertSuccess} alertError={alertError} />
          )}

          {/* Staff */}
          {tab === 'staff' && (
            <FormCard
              title="Staff & access"
              sub="Members listed here can sign in and operate the staff console."
              action={
                <Box
                  component="button"
                  onClick={() => {}}
                  sx={{ border: 'none', background: NAVY_GRADIENT, color: NAVY_CONTRAST, px: 1.5, py: 0.75, borderRadius: 1.5, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.75 }}
                >
                  <PersonAdd sx={{ fontSize: 13 }} /> Invite
                </Box>
              }
            >
              <Box component="form" onSubmit={handleAddStaff} sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  size="small" type="email" placeholder="Add by email…"
                  value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)}
                  sx={{ flex: 1, ...inputSx }}
                />
                <Box
                  component="button" type="submit"
                  sx={{ border: 'none', background: BRAND_GRADIENT, color: 'var(--app-primary-contrast)', px: 2, borderRadius: 1.5, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  Send invite
                </Box>
              </Box>
              <Box sx={{ ...CARD_SX, overflow: 'hidden', boxShadow: 'none' }}>
                <MapComponent Component={StaffRow} data={staff} isLoading={loading} canManage={canManageStaff} onRevoke={handleRevokeStaff} />
              </Box>
            </FormCard>
          )}

          {/* Danger zone */}
          {tab === 'danger' && (
            <FormCard title="Danger zone" sub="Destructive actions. Confirmation is always required.">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {canDelete && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 1.5, border: '1px solid rgba(220,38,38,0.25)', bgcolor: 'rgba(220,38,38,0.04)' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Permanently delete</Typography>
                      <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.5 }}>Remove this property and all bookings. Cannot be undone.</Typography>
                    </Box>
                    <Box
                      component="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      sx={{ border: 'none', bgcolor: '#DC2626', color: '#fff', px: 2, py: 1, borderRadius: 1.5, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}
                    >
                      <DeleteForever sx={{ fontSize: 14 }} /> Delete forever
                    </Box>
                  </Box>
                )}
              </Box>
            </FormCard>
          )}
        </Box>

      </Box>


      {/* Sticky save bar */}
      {isDirty && canEdit && (
        <Box sx={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: NAVY_GRADIENT, borderRadius: 99, px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, boxShadow: '0 8px 32px rgba(0,0,0,0.35)', zIndex: 100, whiteSpace: 'nowrap' }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'var(--app-primary)', flexShrink: 0 }} />
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: NAVY_CONTRAST, mr: 0.5 }}>Unsaved changes</Typography>
          <Box
            component="button"
            onClick={fetchHotel}
            sx={{ border: '1px solid rgba(255,255,255,0.25)', bgcolor: 'transparent', color: NAVY_CONTRAST, px: 1.5, py: 0.6, borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
          >
            Discard
          </Box>
          <Box
            component="button"
            onClick={handleSave}
            sx={{ border: 'none', background: BRAND_GRADIENT, color: 'var(--app-primary-contrast)', px: 1.75, py: 0.6, borderRadius: 99, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
          >
            Save
          </Box>
        </Box>
      )}

      {/* Delete dialog */}
      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <DialogTitle>Delete hotel</DialogTitle>
        <DialogContent>
          <DialogContentText>Delete {hotel.name}? All bookings, requests, and staff links will be removed. This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete forever</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default HotelDetails;
