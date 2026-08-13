import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, TextField, CircularProgress, Avatar, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, MenuItem, Chip, Tooltip } from '@mui/material';
import { motion } from 'framer-motion';
import {
  HotelOutlined, AccessTime, PaletteOutlined, AutoAwesome, PeopleOutline,
  DeleteOutline, LocationOn, PlayArrow, DeleteForever, MenuBook, UploadFile, Download, Close, Add, CableOutlined, ContentCopy, HistoryToggleOff,
} from '@mui/icons-material';
import request from '../helper/api';
import MapComponent from './MapComponent';
import ManageRestaurant from './ManageRestaurant';
import { useHotelTheme } from '../context/HotelThemeContext';
import constants from '../constants.json';
import { generateAndPlayTone } from '../utils/audioToneGenerator';
import { getNotificationTone, createAudioFromBlob } from '../utils/notificationToneCache';
import { CARD_SX, ROW_SX, LABEL_SX, FormCard, FormField, inputSx } from './cards/AppCards';
import { DetailBreadcrumb, DetailHero, DetailTabBar, UnsavedChangesBar, HoursTab, AiTab, BasicThemePicker, buildThemePayload } from './DetailShell';
import { NAVY, NAVY_GRADIENT, BRAND_GRADIENT, MUTED, BORDER, BG, TEXT_MUTED_LIGHT, STATUS_ERROR_BG, STATUS_ERROR } from '../theme';

// ── Constants ──────────────────────────────────────────────────────────────

const TABS = [
  { key: 'identity',  label: 'Identity',      Icon: HotelOutlined },
  { key: 'hours',     label: 'Hours & Wi-Fi', Icon: AccessTime },
  { key: 'theme',     label: 'Theme',         Icon: PaletteOutlined },
  { key: 'ai',        label: 'Concierge AI',  Icon: AutoAwesome },
  { key: 'restaurant', label: 'Restaurant',    Icon: MenuBook },
  { key: 'staff',     label: 'Members',       Icon: PeopleOutline },
  { key: 'integrations', label: constants.INTEGRATIONS.TAB_LABEL, Icon: CableOutlined },
  { key: 'agentJobs', label: constants.AGENT_JOBS.TAB_LABEL, Icon: HistoryToggleOff },
  { key: 'danger',    label: 'Danger zone',   Icon: DeleteOutline },
];

const HOTEL_THEME_KEYS = ['primaryColor', 'secondaryColor', 'primaryHoverColor', 'navyColor', 'navyLightColor', 'fontFamily', 'backgroundDefault', 'backgroundPaper'];

const COLOR_PRESETS = [
  { p: '#7C2D2D', s: '#3A1414', name: 'Crimson' },
  { p: '#1F4E5F', s: '#0F2A35', name: 'Coastal' },
  { p: '#6B5B95', s: '#2D2849', name: 'Vesper' },
  { p: '#A23E48', s: '#5B1F26', name: 'Rose' },
  { p: '#1B2340', s: '#263462', name: 'Navy' },
  { p: '#3A4A2E', s: '#1F2918', name: 'Forest' },
];

// ── Local sub-components ───────────────────────────────────────────────────



const StaffRow = ({ data: s, canManage, onToggleStatus }) => {
  const initials = s.name ? s.name.trim().slice(0, 2).toUpperCase() : '?';
  const statusMeta = constants.HOTEL_MEMBER_STATUSES[s.status];
  const isActive = s.status === constants.HOTEL_MEMBER_STATUSES.active.key;
  const isPending = s.status === constants.HOTEL_MEMBER_STATUSES.pending.key;
  const isDisabled = s.status === constants.HOTEL_MEMBER_STATUSES.disabled.key;
  const statusColor = isDisabled ? STATUS_ERROR : isPending ? '#B26A00' : '#2E7D32';
  const statusBackground = isDisabled ? STATUS_ERROR_BG : isPending ? 'rgba(178,106,0,0.14)' : 'rgba(46,125,50,0.12)';
  return (
    <Box sx={{ ...ROW_SX, display: 'grid', gridTemplateColumns: '40px 1fr 150px 90px 90px', alignItems: 'center', px: 2, py: 1.5, gap: 1.5 }}>
      <Avatar sx={{ width: 34, height: 34, fontSize: 12, fontWeight: 800, background: NAVY_GRADIENT }}>{initials}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || '—'}</Typography>
        <Typography sx={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email || '—'}</Typography>
      </Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: NAVY }}>
        {s.role === constants.HOTEL_MEMBER_ROLES.hotel_owner.key ? constants.HOTEL_MEMBER_ROLES.hotel_owner.label : constants.HOTEL_MEMBER_ROLES.hotel_staff.label}
      </Typography>
      <Box sx={{ borderRadius: 999, px: 1, py: 0.4, fontSize: 11, fontWeight: 700, textAlign: 'center', color: statusColor, bgcolor: statusBackground }}>
        {statusMeta.label}
      </Box>
      {canManage && !isPending && (
        <Box
          component="button"
          onClick={e => { e.stopPropagation(); onToggleStatus?.(s.id, isActive ? constants.HOTEL_MEMBER_STATUSES.disabled.key : constants.HOTEL_MEMBER_STATUSES.active.key); }}
          sx={{ border: `1px solid ${isActive ? STATUS_ERROR_BG : BORDER}`, bgcolor: 'transparent', color: isActive ? STATUS_ERROR : NAVY, borderRadius: 1, px: 1.25, py: 0.5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
        >
          {isActive ? 'Disable' : 'Activate'}
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
  const [newStaffRole, setNewStaffRole] = useState(constants.HOTEL_MEMBER_ROLES.hotel_staff.key);
  const [tab, setTab] = useState('identity');
  const [isDirty, setIsDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [integration, setIntegration] = useState(null);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [agentJobs, setAgentJobs] = useState([]);
  const logoInputRef = useRef(null);
  const imagesInputRef = useRef(null);
  const toneInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const [logoUploadFile, setLogoUploadFile] = useState(null);
  const [logoUploadLoading, setLogoUploadLoading] = useState(false);
  const dragFromRef = useRef(null);
  const dragToRef = useRef(null);
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

  // Integration token management is owner-level — same permission bucket the
  // backend uses (ensureCanManageHotelSettings covers both staff and integrations).
  const canManageIntegrations = canManageStaff;

  const fetchIntegration = () => {
    if (!id || !canManageIntegrations) return;
    request({ endpoint: `/hotels/${id}/integrations`, method: 'GET', setLoading, setData: setIntegration, defaultData: null, alertError });
  };

  const fetchAgentJobs = () => {
    if (!id || !canManageIntegrations) return;
    request({ endpoint: `/hotels/${id}/agent-jobs`, method: 'GET', setLoading, setData: setAgentJobs, defaultData: [], alertError });
  };

  useEffect(() => {
    if (id) fetchHotel();
    if (canManageStaff) fetchStaff();
    if (canManageIntegrations) fetchIntegration();
    if (canManageIntegrations) fetchAgentJobs();
  }, [id, canManageStaff]);

  useEffect(() => { return () => setThemeConfig(null); }, [setThemeConfig]);

  const handleInputChange = (field) => (event) => {
    setEditValues(prev => ({ ...prev, [field]: event.target.value }));
    setIsDirty(true);
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    const { themeConfig, payload } = buildThemePayload(editValues, HOTEL_THEME_KEYS);
    payload.themeConfig = themeConfig;
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
    const result = await request({
      endpoint: `/hotels/${id}/staff`,
      method: 'POST',
      data: { email, role: newStaffRole },
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result?.success) {
      setNewStaffEmail('');
      setNewStaffRole(constants.HOTEL_MEMBER_ROLES.hotel_staff.key);
      fetchStaff();
    }
  };

  const handleToggleStaffStatus = async (accountId, status) => {
    const ok = await request({
      endpoint: `/hotels/${id}/staff/${accountId}/status`,
      method: 'PATCH',
      data: { status },
      setLoading,
      alertSuccess,
      alertError,
    });
    if (ok?.success) fetchStaff();
  };

  const handleGenerateOrRotateToken = async () => {
    const result = await request({ endpoint: `/hotels/${id}/integrations/token`, method: 'POST', setLoading, alertSuccess, alertError });
    if (result?.success) {
      setGeneratedToken(result.data.token);
      setIntegration(result.data);
    }
  };

  const handleRevokeToken = async () => {
    setShowRevokeConfirm(false);
    const result = await request({ endpoint: `/hotels/${id}/integrations/token`, method: 'DELETE', setLoading, alertSuccess, alertError });
    if (result?.success) fetchIntegration();
  };

  const handleCopyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alertSuccess?.(constants.INTEGRATIONS.COPIED_MESSAGE);
    } catch {
      alertError?.('Copy failed');
    }
  };

  const handleCsvSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alertError?.('Please upload a csv file');
      return;
    }
    const csvContent = await file.text();
    const result = await request({
      endpoint: `/hotels/${id}/staff/import`,
      method: 'POST',
      data: { csvContent },
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result?.success) {
      fetchStaff();
    }
    event.target.value = '';
  };

  const handleDownloadSampleCsv = async () => {
    const result = await request({ endpoint: `/hotels/${id}/staff/sample-csv`, method: 'GET', setLoading, alertError, defaultData: null });
    const sample = result?.data;
    if (!sample || !sample.content) {
      return;
    }
    const blob = new Blob([sample.content], { type: sample.contentType || 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sample.fileName || 'members-sample.csv';
    link.click();
    URL.revokeObjectURL(url);
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

  const handleImagesFileSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || !id) return;
    const valid = files.filter(file => file.type.startsWith('image/') && file.size <= 100 * 1024 * 1024);
    if (valid.length !== files.length) alertError?.('Only image files up to 100MB are allowed');
    if (!valid.length) return;
    setLoading(true);
    try {
      let updatedHotel = null;
      for (const file of valid) {
        const upload = await compressImage(file);
        const presignedRes = await request({ endpoint: `/hotels/${id}/images/presigned-url`, method: 'POST', data: { fileName: upload.name, fileSize: upload.size, contentType: upload.type }, throw: true });
        const { presignedUrl, s3Url } = presignedRes?.data || {};
        const s3Resp = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': upload.type }, body: upload });
        if (!s3Resp.ok) throw new Error(`S3 upload failed (${s3Resp.status})`);
        const result = await request({ endpoint: `/hotels/${id}/images`, method: 'POST', data: { s3Url }, throw: true });
        if (result.success) updatedHotel = result.data;
      }
      if (updatedHotel) { alertSuccess?.('Photos uploaded'); setHotel(prev => ({ ...prev, images: updatedHotel.images })); }
    } catch (err) { alertError?.(`Photo upload failed: ${err.message}`); }
    finally { setLoading(false); }
  };

  const handleImagesReorder = async () => {
    const from = dragFromRef.current;
    const to = dragToRef.current;
    dragFromRef.current = null;
    dragToRef.current = null;
    if (from === null || to === null || from === to) return;
    const reordered = [...(hotel.images || [])];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setHotel(prev => ({ ...prev, images: reordered }));
    await request({ endpoint: `/hotels/${id}/images/reorder`, method: 'PATCH', data: { images: reordered }, setLoading });
  };

  const compressImage = (file, maxDimension = 1600, quality = 0.8) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(img.src);
        resolve(blob && blob.size < file.size ? new File([blob], file.name, { type: 'image/jpeg' }) : file);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });


  const handleImageDelete = async (s3Url) => {
    const result = await request({ endpoint: `/hotels/${id}/images`, method: 'DELETE', data: { s3Url }, alertError });
    if (result?.success) setHotel(prev => ({ ...prev, images: result.data?.images }));
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
        <DetailBreadcrumb items={[
          { label: 'Hotels', onClick: () => navigate('/hotels') },
          hotel.brand && { label: hotel.brand.name, onClick: () => navigate(`/brands/${hotel.brand.id}`) },
          { label: hotel.name },
          { label: 'Edit', color: 'primary.main' },
        ]} />

        <DetailHero
          name={hotel.name}
          gradient={headerGradient}
          eyebrow={hotel.brand?.name || 'Independent'}
          logoUrl={hotel.logoUrl}
          meta={hotel.address && (
            hotel.googleMapsUrl ? (
              <Box
                component="a"
                href={hotel.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, textDecoration: 'none', color: TEXT_MUTED_LIGHT, '&:hover': { color: 'primary.main' } }}
              >
                <LocationOn sx={{ fontSize: 12 }} />
                <Typography sx={{ fontSize: 12, color: 'inherit', textDecoration: 'underline' }}>{hotel.address}</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocationOn sx={{ fontSize: 12, color: TEXT_MUTED_LIGHT }} />
                <Typography sx={{ fontSize: 12, color: TEXT_MUTED_LIGHT }}>{hotel.address}</Typography>
              </Box>
            )
          )}
        />

        <DetailTabBar tabs={TABS} active={tab} onChange={setTab} />
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
                      <TextField fullWidth size="small" value={editValues.name} onChange={handleInputChange('name')} placeholder="Ex. Grand Oberoi Mumbai" sx={inputSx} />
                    </FormField>
                  </Box>
                  <Box sx={{ gridColumn: { sm: 'span 2' } }}>
                    <FormField label="Address">
                      <TextField fullWidth size="small" value={editValues.address} onChange={handleInputChange('address')} placeholder="Ex. 123 Marine Drive, Mumbai 400001" sx={inputSx} />
                    </FormField>
                  </Box>
                  {hotel.googleMapsUrl && (
                    <Box sx={{ gridColumn: { sm: 'span 2' } }}>
                      <Box
                        component="a"
                        href={hotel.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.03)', border: `1px solid ${BORDER}`, fontSize: 12, fontWeight: 600, color: 'primary.main', textDecoration: 'none', overflow: 'hidden', maxWidth: '100%' }}
                      >
                        <LocationOn sx={{ fontSize: 15, flexShrink: 0 }} />
                        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>View on Google Maps</Box>
                      </Box>
                    </Box>
                  )}
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

              <FormCard title="Photos" sub="Drag to reorder. PNG/JPG, max 100MB each, up to 12 photos. Compressed automatically before upload.">
                <input ref={imagesInputRef} type="file" accept="image/*" multiple onChange={handleImagesFileSelect} style={{ display: 'none' }} />
                <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
                  {(hotel.images || []).map((url, idx) => (
                    <Box
                      key={url}
                      draggable
                      onDragStart={() => { dragFromRef.current = idx; }}
                      onDragOver={(e) => { e.preventDefault(); dragToRef.current = idx; }}
                      onDrop={handleImagesReorder}
                      sx={{ position: 'relative', flexShrink: 0, cursor: 'grab' }}
                    >
                      <Box component="img" src={url} alt="" sx={{ width: 120, height: 90, borderRadius: 1.5, objectFit: 'cover', border: `1px solid ${BORDER}`, display: 'block', pointerEvents: 'none', userSelect: 'none' }} />
                      <Box
                        component="button"
                        onClick={() => handleImageDelete(url)}
                        sx={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <Close sx={{ fontSize: 13 }} />
                      </Box>
                    </Box>
                  ))}
                  {(!hotel.images || hotel.images.length < 12) && (
                    <Box
                      component="button"
                      onClick={() => !loading && imagesInputRef.current?.click()}
                      sx={{ width: 120, height: 90, borderRadius: 1.5, border: `2px dashed ${BORDER}`, bgcolor: 'background.paper', cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, flexShrink: 0, '&:hover': { borderColor: 'var(--app-primary)', color: 'var(--app-primary)' } }}
                    >
                      {loading ? <CircularProgress size={22} /> : <Add sx={{ fontSize: 30 }} />}
                    </Box>
                  )}
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
          {tab === 'hours' && <HoursTab editValues={editValues} handleInputChange={handleInputChange} accent={accent} />}

          {/* Theme */}
          {tab === 'theme' && (
            <FormCard title="Brand colors" sub="Used in guest-facing pages, emails, and the portal.">
              <BasicThemePicker editValues={editValues} handleInputChange={handleInputChange} />
              <Typography sx={{ ...LABEL_SX, fontSize: 10, mt: 2.5, mb: 1.25 }}>Or pick a preset</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1 }}>
                {COLOR_PRESETS.map(p => (
                  <Box key={p.name} component="button"
                    onClick={() => { handleInputChange('primaryColor')({ target: { value: p.p } }); handleInputChange('secondaryColor')({ target: { value: p.s } }); }}
                    sx={{ background: `linear-gradient(135deg, ${p.p}, ${p.s})`, border: editValues.primaryColor === p.p ? `2px solid ${NAVY}` : '2px solid transparent', borderRadius: 1.5, height: 56, cursor: 'pointer', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'flex-end', p: 1 }}>
                    {p.name}
                  </Box>
                ))}
              </Box>
            </FormCard>
          )}

          {/* Concierge AI */}
          {tab === 'ai' && (
            <AiTab editValues={editValues} handleInputChange={handleInputChange}
              sub="Property-specific instructions added to the AI system prompt."
              placeholder="Ex. Always recommend the rooftop bar on clear evenings. Never quote wait times over 15 minutes; escalate to duty manager instead." />
          )}

          {/* Restaurant */}
          {tab === 'restaurant' && (
            <ManageRestaurant hotelId={hotel.id} account={account} loading={loading} setLoading={setLoading} alertSuccess={alertSuccess} alertError={alertError} />
          )}

          {/* Staff */}
          {tab === 'staff' && (
            <FormCard
              title="Members & access"
              sub="Members listed here can sign in and operate the staff console."
            >
              <Box component="form" onSubmit={handleAddStaff} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 190px auto' }, gap: 1, mb: 2 }}>
                <TextField
                  size="small" type="email" placeholder="Add by email…"
                  value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)}
                  sx={{ ...inputSx }}
                />
                <TextField
                  select
                  size="small"
                  value={newStaffRole}
                  onChange={e => setNewStaffRole(e.target.value)}
                  sx={inputSx}
                >
                  <MenuItem value={constants.HOTEL_MEMBER_ROLES.hotel_staff.key}>{constants.HOTEL_MEMBER_ROLES.hotel_staff.label}</MenuItem>
                  <MenuItem value={constants.HOTEL_MEMBER_ROLES.hotel_owner.key}>{constants.HOTEL_MEMBER_ROLES.hotel_owner.label}</MenuItem>
                </TextField>
                <Box
                  component="button" type="submit"
                  sx={{ border: 'none', background: BRAND_GRADIENT, color: 'var(--app-primary-contrast)', px: 2, borderRadius: 1.5, fontSize: 12, fontWeight: 800, cursor: 'pointer', minHeight: 40 }}
                >
                  Send invite
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvSelect} style={{ display: 'none' }} />
                <Box
                  component="button"
                  onClick={() => csvInputRef.current?.click()}
                  sx={{ border: `1px solid ${BORDER}`, background: 'background.paper', color: NAVY, px: 1.5, py: 0.9, borderRadius: 1.5, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.75 }}
                >
                  <UploadFile sx={{ fontSize: 14 }} />
                  Upload csv
                </Box>
                <Box
                  component="button"
                  onClick={handleDownloadSampleCsv}
                  sx={{ border: `1px solid ${BORDER}`, background: 'background.paper', color: NAVY, px: 1.5, py: 0.9, borderRadius: 1.5, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.75 }}
                >
                  <Download sx={{ fontSize: 14 }} />
                  Download sample csv
                </Box>
              </Box>
              <Box sx={{ ...CARD_SX, overflow: 'hidden', boxShadow: 'none' }}>
                <MapComponent Component={StaffRow} data={staff} isLoading={loading} canManage={canManageStaff} onToggleStatus={handleToggleStaffStatus} />
              </Box>
            </FormCard>
          )}

          {/* Integrations */}
          {tab === 'integrations' && canManageIntegrations && (
            <FormCard title={constants.INTEGRATIONS.TAB_LABEL} sub="Connect a PMS to automatically sync bookings and requests. One token per hotel.">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75, bgcolor: BG, borderRadius: 1.5, mb: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>
                    {integration?.status === 'active' ? constants.INTEGRATIONS.STATUS_ACTIVE_LABEL
                      : integration?.status === 'revoked' ? constants.INTEGRATIONS.STATUS_REVOKED_LABEL
                      : constants.INTEGRATIONS.STATUS_NOT_CONFIGURED_LABEL}
                  </Typography>
                  {integration?.tokenPrefix && (
                    <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
                      {constants.INTEGRATIONS.TOKEN_PREFIX_LABEL}: {integration.tokenPrefix}…
                    </Typography>
                  )}
                </Box>
                <Box
                  component="button"
                  onClick={handleGenerateOrRotateToken}
                  sx={{ border: 'none', background: BRAND_GRADIENT, color: 'var(--app-primary-contrast)', px: 2, py: 1, borderRadius: 1.5, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  {integration?.status ? constants.INTEGRATIONS.ROTATE_BUTTON_LABEL : constants.INTEGRATIONS.GENERATE_BUTTON_LABEL}
                </Box>
                {integration?.status === 'active' && (
                  <Box
                    component="button"
                    onClick={() => setShowRevokeConfirm(true)}
                    sx={{ border: `1px solid ${STATUS_ERROR_BG}`, bgcolor: 'transparent', color: STATUS_ERROR, px: 1.5, py: 1, borderRadius: 1.5, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {constants.INTEGRATIONS.REVOKE_BUTTON_LABEL}
                  </Box>
                )}
              </Box>

              {integration?.webhookUrls && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box>
                    <Typography sx={{ ...LABEL_SX, fontSize: 10, mb: 0.5 }}>{constants.INTEGRATIONS.BOOKINGS_WEBHOOK_LABEL}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField fullWidth size="small" value={integration.webhookUrls.bookings} InputProps={{ readOnly: true }} sx={inputSx} />
                      <Box
                        component="button"
                        onClick={() => handleCopyToClipboard(integration.webhookUrls.bookings)}
                        sx={{ border: `1px solid ${BORDER}`, bgcolor: 'background.paper', color: NAVY, px: 1.5, py: 1, borderRadius: 1.5, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        <ContentCopy sx={{ fontSize: 13 }} />
                      </Box>
                    </Box>
                  </Box>
                  <Box>
                    <Typography sx={{ ...LABEL_SX, fontSize: 10, mb: 0.5 }}>{constants.INTEGRATIONS.REQUESTS_WEBHOOK_LABEL}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField fullWidth size="small" value={integration.webhookUrls.requests} InputProps={{ readOnly: true }} sx={inputSx} />
                      <Box
                        component="button"
                        onClick={() => handleCopyToClipboard(integration.webhookUrls.requests)}
                        sx={{ border: `1px solid ${BORDER}`, bgcolor: 'background.paper', color: NAVY, px: 1.5, py: 1, borderRadius: 1.5, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        <ContentCopy sx={{ fontSize: 13 }} />
                      </Box>
                    </Box>
                  </Box>
                </Box>
              )}
            </FormCard>
          )}

          {/* Agent activity — read-only audit of what the browser agent did */}
          {tab === 'agentJobs' && canManageIntegrations && (
            <FormCard
              title={constants.AGENT_JOBS.TAB_LABEL}
              sub={constants.AGENT_JOBS.DESCRIPTION}
              action={(
                <Button size="small" variant="outlined" onClick={fetchAgentJobs}>
                  {constants.AGENT_JOBS.REFRESH_BUTTON_LABEL}
                </Button>
              )}
            >
              {agentJobs.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {constants.AGENT_JOBS.EMPTY_MESSAGE}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {agentJobs.map((job) => {
                    const isDone = job.status === 'succeeded';
                    const confirmed = isDone && !!job.verifiedAt;
                    return (
                      <Box key={job.id} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle2">{job.action}</Typography>
                          <Chip
                            size="small"
                            label={constants.AGENT_JOBS[`STATUS_${String(job.status).toUpperCase()}_LABEL`] || job.status}
                            color={job.status === 'failed' ? 'error' : isDone ? 'success' : 'default'}
                          />
                          {/* Succeeded-but-unconfirmed is the case operators most need to
                              see: the agent believed it worked, a second read disagreed,
                              and nothing was relayed to the guest. */}
                          {isDone && (
                            <Tooltip title={confirmed ? '' : constants.AGENT_JOBS.UNVERIFIED_HELP}>
                              <Chip
                                size="small"
                                variant="outlined"
                                label={confirmed ? constants.AGENT_JOBS.VERIFIED_LABEL : constants.AGENT_JOBS.UNVERIFIED_LABEL}
                                color={confirmed ? 'success' : 'warning'}
                              />
                            </Tooltip>
                          )}
                        </Box>
                        {job.result?.answer && <Typography variant="body2" sx={{ mb: 0.5 }}>{job.result.answer}</Typography>}
                        {job.error && <Typography variant="body2" color="error" sx={{ mb: 0.5 }}>{job.error}</Typography>}
                        <Typography variant="caption" color="text.secondary">
                          {constants.AGENT_JOBS.REQUESTED_LABEL}: {new Date(job.createdAt).toLocaleString()}
                          {job.durationMs ? ` · ${constants.AGENT_JOBS.DURATION_LABEL} ${(job.durationMs / 1000).toFixed(1)}s` : ''}
                          {job.costUsd ? ` · ${constants.AGENT_JOBS.COST_LABEL} $${Number(job.costUsd).toFixed(4)}` : ''}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
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


      {isDirty && canEdit && <UnsavedChangesBar onDiscard={fetchHotel} onSave={handleSave} />}

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

      {/* Generated/rotated token — shown once */}
      <Dialog open={!!generatedToken} onClose={() => setGeneratedToken(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{constants.INTEGRATIONS.TAB_LABEL}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>{constants.INTEGRATIONS.TOKEN_ONE_TIME_WARNING}</DialogContentText>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField fullWidth size="small" value={generatedToken || ''} InputProps={{ readOnly: true }} sx={inputSx} />
            <Box
              component="button"
              onClick={() => handleCopyToClipboard(generatedToken)}
              sx={{ border: `1px solid ${BORDER}`, bgcolor: 'background.paper', color: NAVY, px: 1.5, py: 1, borderRadius: 1.5, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <ContentCopy sx={{ fontSize: 13 }} />
              {constants.INTEGRATIONS.COPY_TOKEN_BUTTON_LABEL}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGeneratedToken(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog open={showRevokeConfirm} onClose={() => setShowRevokeConfirm(false)}>
        <DialogTitle>{constants.INTEGRATIONS.REVOKE_BUTTON_LABEL}</DialogTitle>
        <DialogContent>
          <DialogContentText>{constants.INTEGRATIONS.REVOKE_CONFIRM_MESSAGE}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRevokeConfirm(false)}>Cancel</Button>
          <Button onClick={handleRevokeToken} color="error" variant="contained">{constants.INTEGRATIONS.REVOKE_BUTTON_LABEL}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default HotelDetails;
