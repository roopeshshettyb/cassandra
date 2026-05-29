import { useEffect, useRef, useState } from 'react';
import { Box, Typography, TextField, Checkbox, FormControlLabel, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, MenuItem as MuiMenuItem, IconButton, useMediaQuery } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { motion } from 'framer-motion';
import request from '../helper/api';
import MapComponent from './MapComponent';
import { CARD_SX, ROW_SX, ColumnLabel } from './cards/AppCards';
import { NAVY, MUTED, BORDER, BG, BRAND_GRADIENT, STATUS_ERROR_BG, STATUS_ERROR } from '../theme';
import constants from '../constants.json';

const CATEGORIES = constants.MENU_CATEGORIES;
const DEFAULT_CATEGORY = CATEGORIES[0]?.value;

const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } };
// Hide native number-input spinner arrows
const noSpinnerSx = {
  ...inputSx,
  '& input[type=number]': { MozAppearance: 'textfield' },
  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
};

const REVIEW_GRID = '1.4fr 90px 1fr 1.6fr 40px';

// Editable row in the OCR review dialog — grid row on desktop, stacked card on mobile.
// Labels only on mobile (desktop has column headers); omitting the label on desktop
// avoids MUI's outline notch showing as a "cut" in the top border.
const ReviewRow = ({ data: item, index, onChange, onRemove, isMobile }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr 1fr', md: REVIEW_GRID },
      gap: 1,
      alignItems: { md: 'center' },
      p: { xs: 1.5, md: '8px 12px' },
      mb: { xs: 1.25, md: 0 },
      border: { xs: `1px solid ${BORDER}`, md: 'none' },
      borderBottom: `1px solid ${BORDER}`,
      borderRadius: { xs: 2, md: 0 },
      position: 'relative',
    }}
  >
    <TextField size="small" label={isMobile ? 'Name' : undefined} placeholder="Name" value={item.name} onChange={e => onChange(index, 'name', e.target.value)} error={!item.name} sx={{ ...inputSx, gridColumn: { xs: '1 / -1', md: 'auto' }, pr: { xs: 4, md: 0 } }} />
    <TextField size="small" label={isMobile ? 'Price' : undefined} type="number" placeholder="Price" inputProps={{ min: 0, step: 0.01 }} value={item.price ?? ''} onChange={e => onChange(index, 'price', e.target.value)} error={item.price === '' || item.price == null} sx={noSpinnerSx} />
    <TextField size="small" select label={isMobile ? 'Category' : undefined} value={item.category || ''} onChange={e => onChange(index, 'category', e.target.value)} error={!item.category} sx={inputSx}>
      {CATEGORIES.map(c => <MuiMenuItem key={c.value} value={c.value}>{c.label}</MuiMenuItem>)}
    </TextField>
    <TextField size="small" label={isMobile ? 'Description' : undefined} placeholder="Description" value={item.description || ''} onChange={e => onChange(index, 'description', e.target.value)} sx={{ ...inputSx, gridColumn: { xs: '1 / -1', md: 'auto' } }} />
    <IconButton size="small" onClick={() => onRemove(index)} sx={{ color: STATUS_ERROR, position: { xs: 'absolute', md: 'static' }, top: { xs: 8, md: 'auto' }, right: { xs: 8, md: 'auto' }, justifySelf: { md: 'center' } }}><DeleteOutlineIcon fontSize="small" /></IconButton>
  </Box>
);

const defaultForm = {
  name: '', description: '', price: '', category: '',
  availableStartTime: '', availableEndTime: '',
  isAvailable: true, dietaryTags: '', imageUrl: '', sortOrder: 0,
};

const TABLE_COLS = ['Name', 'Category', 'Price', 'Description', 'Available Time', ''];
const TABLE_GRID = '1.5fr 1fr 90px 1.5fr 1fr 120px';

const MenuItemRow = ({ data: item, onEdit, onDelete, canManage }) => {
  const cat = CATEGORIES.find(c => c.value === item.category)?.label || item.category;
  const time = [item.availableStartTime, item.availableEndTime].filter(Boolean).join(' – ');
  const actions = canManage && (
    <Box sx={{ display: 'flex', gap: 1, mt: { xs: 1, md: 0 } }}>
      <Box component="button" onClick={e => { e.stopPropagation(); onEdit?.(item); }}
        sx={{ border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: NAVY, px: 1.5, py: 0.5, borderRadius: 1, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
        Edit
      </Box>
      <Box component="button" onClick={e => { e.stopPropagation(); onDelete?.(item); }}
        sx={{ border: `1px solid ${STATUS_ERROR_BG}`, bgcolor: 'transparent', color: STATUS_ERROR, px: 1.5, py: 0.5, borderRadius: 1, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
        Delete
      </Box>
    </Box>
  );

  return (
    <>
      {/* Desktop: grid row */}
      <Box sx={{ ...ROW_SX, display: { xs: 'none', md: 'grid' }, gridTemplateColumns: TABLE_GRID, px: 2.5, py: 1.5, alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || '—'}</Typography>
        <Typography sx={{ fontSize: 12, color: MUTED }}>{cat || '—'}</Typography>
        <Typography sx={{ fontSize: 12, color: NAVY, fontWeight: 600 }}>{item.price != null ? `₹${Number(item.price).toFixed(2)}` : '—'}</Typography>
        <Typography sx={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || '—'}</Typography>
        <Typography sx={{ fontSize: 12, color: MUTED }}>{time || '—'}</Typography>
        {actions}
      </Box>

      {/* Mobile: stacked card */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, px: 2, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{item.name || '—'}</Typography>
          <Typography sx={{ fontSize: 13, color: NAVY, fontWeight: 700, flexShrink: 0 }}>{item.price != null ? `₹${Number(item.price).toFixed(2)}` : '—'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, color: 'var(--app-primary)', fontWeight: 700, bgcolor: 'rgba(0,0,0,0.04)', px: 1, py: 0.25, borderRadius: 1 }}>{cat || '—'}</Typography>
          {time && <Typography sx={{ fontSize: 11, color: MUTED, px: 0.5, py: 0.25 }}>{time}</Typography>}
        </Box>
        {item.description && <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.75 }}>{item.description}</Typography>}
        {actions}
      </Box>
    </>
  );
};


function ManageRestaurant({ hotelId, account, loading, setLoading, alertSuccess, alertError }) {
  const canManage = !!constants.PERMISSIONS.CAN_MANAGE_RESTAURANT_MENU[account?.role];
  const isMobile = useMediaQuery('(max-width:899.95px)');
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [showReview, setShowReview] = useState(false);
  const [reviewItems, setReviewItems] = useState([]);
  const bulkInputRef = useRef(null);

  const fetchItems = () => request({
    endpoint: `/restaurant/menu-items?hotelId=${hotelId}`,
    method: 'GET', setLoading, setData: setItems, defaultData: [], alertError,
  });

  useEffect(() => { if (hotelId) fetchItems(); }, [hotelId]);

  const handleChange = field => e => setForm(prev => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const openAdd = () => { setEditingItem(null); setForm(defaultForm); setShowForm(true); };
  const openEdit = item => {
    setEditingItem(item);
    setForm({
      name: item.name || '', description: item.description || '', price: item.price ?? '',
      category: item.category || '', availableStartTime: item.availableStartTime || '',
      availableEndTime: item.availableEndTime || '', isAvailable: item.isAvailable !== false,
      dietaryTags: Array.isArray(item.dietaryTags) ? item.dietaryTags.join(', ') : '',
      imageUrl: item.imageUrl || '', sortOrder: item.sortOrder ?? 0,
    });
    setShowForm(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category) { alertError?.('Name, price and category required'); return; }
    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum < 0) { alertError?.('Invalid price'); return; }

    const payload = {
      name: form.name, description: form.description || undefined, price: priceNum,
      category: form.category, availableStartTime: form.availableStartTime || undefined,
      availableEndTime: form.availableEndTime || undefined, isAvailable: form.isAvailable,
      dietaryTags: form.dietaryTags ? form.dietaryTags.split(',').map(t => t.trim()).filter(Boolean) : [],
      imageUrl: form.imageUrl || undefined, sortOrder: parseInt(form.sortOrder, 10) || 0,
    };

    const res = await request({
      endpoint: editingItem ? `/restaurant/menu-items/${editingItem.id}` : '/restaurant/menu-items',
      method: editingItem ? 'PATCH' : 'POST',
      data: editingItem ? payload : { hotelId: Number(hotelId), ...payload },
      setLoading, alertSuccess, alertError,
    });
    if (res?.success) { setShowForm(false); fetchItems(); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await request({ endpoint: `/restaurant/menu-items/${deleteTarget.id}`, method: 'DELETE', setLoading, alertSuccess, alertError });
    // Keep deleteTarget set so the dialog text doesn't flash empty during fade-out.
    if (res?.success) { setShowDelete(false); fetchItems(); }
  };

  // Bulk OCR: upload images → S3 → extract → review
  const handleBulkFiles = async e => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    // Own the loader across the full sequence (presigned + raw S3 PUT + extract),
    // since the S3 PUT is a raw fetch with no loader of its own.
    setLoading(true);
    try {
      const imageUrls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const presigned = await request({
          endpoint: '/restaurant/menu-ocr/presigned-url', method: 'POST',
          data: { hotelId: Number(hotelId), fileName: file.name, fileSize: file.size, contentType: file.type },
          alertError, throw: true,
        });
        const { presignedUrl, s3Url } = presigned?.data || {};
        if (!presignedUrl) return;
        const s3Resp = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!s3Resp.ok) { alertError?.(`Upload failed (${s3Resp.status})`); return; }
        imageUrls.push(s3Url);
      }

      const res = await request({
        endpoint: '/restaurant/menu-ocr/extract', method: 'POST',
        data: { hotelId: Number(hotelId), imageUrls }, alertError,
      });
      if (res?.success) {
        const items = (res.data?.items || []).map(it => ({
          name: it.name || '', price: it.price ?? '', category: it.category || DEFAULT_CATEGORY, description: it.description || '',
        }));
        setReviewItems(items);
        setShowReview(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReviewChange = (idx, field, val) => setReviewItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  const handleReviewRemove = idx => setReviewItems(prev => prev.filter((_, i) => i !== idx));
  const handleReviewAdd = () => setReviewItems(prev => [...prev, { name: '', price: '', category: DEFAULT_CATEGORY, description: '' }]);

  const reviewValid = reviewItems.length > 0 && reviewItems.every(it => it.name && it.category && it.price !== '' && it.price != null && !isNaN(parseFloat(it.price)));

  const handleBulkConfirm = async () => {
    const items = reviewItems.map(it => ({
      hotelId: Number(hotelId), name: it.name, price: parseFloat(it.price),
      category: it.category, description: it.description || undefined,
    }));
    const res = await request({
      endpoint: '/restaurant/menu-items/bulk', method: 'POST',
      data: { hotelId: Number(hotelId), items }, setLoading, alertSuccess, alertError,
    });
    if (res?.success) { setShowReview(false); setReviewItems([]); fetchItems(); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Box sx={{ ...CARD_SX, mb: 2 }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: NAVY }}>Restaurant menu</Typography>
            <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>Add, edit or remove menu items for this hotel.</Typography>
          </Box>
          {canManage && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box component="button" onClick={() => bulkInputRef.current?.click()}
                sx={{ border: `1px solid ${BORDER}`, background: 'transparent', color: NAVY, px: 2, py: 0.9, borderRadius: 1.5, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                Upload menu
              </Box>
              <Box component="button" onClick={openAdd}
                sx={{ border: 'none', background: BRAND_GRADIENT, color: 'var(--app-primary-contrast)', px: 2, py: 0.9, borderRadius: 1.5, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                + Add item
              </Box>
              <input ref={bulkInputRef} type="file" accept="image/*" multiple hidden onChange={handleBulkFiles} />
            </Box>
          )}
        </Box>

        <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: TABLE_GRID, px: 2.5, py: 1.25, bgcolor: BG, borderBottom: `1px solid ${BORDER}` }}>
          <MapComponent Component={ColumnLabel} data={TABLE_COLS} showNoDataAvailable={false} />
        </Box>
        <MapComponent Component={MenuItemRow} data={items} isLoading={loading} onEdit={openEdit} onDelete={item => { setDeleteTarget(item); setShowDelete(true); }} canManage={canManage} />
      </Box>

      {/* Add / Edit dialog */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800 }}>{editingItem ? 'Edit item' : 'Add item'}</DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField fullWidth size="small" label="Name" value={form.name} onChange={handleChange('name')} required sx={inputSx} />
              <TextField fullWidth size="small" label="Description" multiline rows={2} value={form.description} onChange={handleChange('description')} sx={inputSx} />
              <TextField fullWidth size="small" label="Price" type="number" inputProps={{ min: 0, step: 0.01 }} value={form.price} onChange={handleChange('price')} required sx={noSpinnerSx} />
              <TextField fullWidth size="small" select label="Category" value={form.category} onChange={handleChange('category')} required sx={inputSx}>
                {CATEGORIES.map(c => <MuiMenuItem key={c.value} value={c.value}>{c.label}</MuiMenuItem>)}
              </TextField>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField fullWidth size="small" label="Available from" type="time" value={form.availableStartTime} onChange={handleChange('availableStartTime')} InputLabelProps={{ shrink: true }} sx={inputSx} />
                <TextField fullWidth size="small" label="Available until" type="time" value={form.availableEndTime} onChange={handleChange('availableEndTime')} InputLabelProps={{ shrink: true }} sx={inputSx} />
              </Box>
              <FormControlLabel control={<Checkbox checked={form.isAvailable} onChange={handleChange('isAvailable')} />} label="Available" />
              <TextField fullWidth size="small" label="Dietary tags (comma-separated)" value={form.dietaryTags} onChange={handleChange('dietaryTags')} sx={inputSx} />
              <TextField fullWidth size="small" label="Image URL" value={form.imageUrl} onChange={handleChange('imageUrl')} sx={inputSx} />
              <TextField fullWidth size="small" label="Sort order" type="number" inputProps={{ min: 0 }} value={form.sortOrder} onChange={handleChange('sortOrder')} sx={noSpinnerSx} />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editingItem ? 'Save changes' : 'Add item'}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* OCR review dialog */}
      <Dialog open={showReview} onClose={() => setShowReview(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 800 }}>
          Review extracted items
          <Typography sx={{ fontSize: 12, color: MUTED, fontWeight: 400, mt: 0.25 }}>
            Edit, remove or add items. Name, price and category required for each.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 2 }}>
          <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: REVIEW_GRID, gap: 1, px: 1.5, py: 1, bgcolor: BG, borderBottom: `1px solid ${BORDER}`, borderRadius: 1 }}>
            <MapComponent Component={ColumnLabel} data={['Name', 'Price', 'Category', 'Description', '']} showNoDataAvailable={false} />
          </Box>
          <Box sx={{ mt: { xs: 1, md: 0 } }}>
            <MapComponent Component={ReviewRow} data={reviewItems} showNoDataAvailable={false} onChange={handleReviewChange} onRemove={handleReviewRemove} isMobile={isMobile} />
          </Box>
          <Box component="button" onClick={handleReviewAdd}
            sx={{ mt: 1.5, border: `1px dashed ${BORDER}`, background: 'transparent', color: NAVY, px: 2, py: 0.75, borderRadius: 1.5, fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
            + Add row
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setShowReview(false); setReviewItems([]); }}>Cancel</Button>
          <Button onClick={handleBulkConfirm} variant="contained" disabled={!reviewValid}>
            Confirm &amp; create ({reviewItems.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={showDelete} onClose={() => setShowDelete(false)}>
        <DialogTitle>Delete menu item</DialogTitle>
        <DialogContent>
          <DialogContentText>Delete &quot;{deleteTarget?.name}&quot;? Cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
}

export default ManageRestaurant;
