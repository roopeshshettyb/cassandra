import { useEffect, useState } from 'react';
import { Box, Typography, TextField, Checkbox, FormControlLabel, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, MenuItem as MuiMenuItem } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import MapComponent from './MapComponent';
import { CARD_SX, ROW_SX, LABEL_SX } from './cards/AppCards';
import { NAVY, MUTED, BORDER, BG, BRAND_GRADIENT, STATUS_ERROR_BG, STATUS_ERROR } from '../theme';
import constants from '../constants.json';

const CATEGORIES = constants.MENU_CATEGORIES;

const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } };

const defaultForm = {
  name: '', description: '', price: '', category: '',
  availableStartTime: '', availableEndTime: '',
  isAvailable: true, dietaryTags: '', imageUrl: '', sortOrder: 0,
};

const MenuItemRow = ({ data: item, onEdit, onDelete, canManage }) => {
  const cat = CATEGORIES.find(c => c.value === item.category)?.label || item.category;
  return (
    <Box sx={{ ...ROW_SX, display: 'grid', gridTemplateColumns: TABLE_GRID, px: 2.5, py: 1.5, alignItems: 'center', gap: 1 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || '—'}</Typography>
      <Typography sx={{ fontSize: 12, color: MUTED }}>{cat || '—'}</Typography>
      <Typography sx={{ fontSize: 12, color: NAVY, fontWeight: 600 }}>{item.price != null ? `₹${Number(item.price).toFixed(2)}` : '—'}</Typography>
      <Typography sx={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || '—'}</Typography>
      <Typography sx={{ fontSize: 12, color: MUTED }}>
        {[item.availableStartTime, item.availableEndTime].filter(Boolean).join(' – ') || '—'}
      </Typography>
      {canManage && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Box component="button" onClick={e => { e.stopPropagation(); onEdit?.(item); }}
            sx={{ border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: NAVY, px: 1.5, py: 0.5, borderRadius: 1, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Edit
          </Box>
          <Box component="button" onClick={e => { e.stopPropagation(); onDelete?.(item); }}
            sx={{ border: `1px solid ${STATUS_ERROR_BG}`, bgcolor: 'transparent', color: STATUS_ERROR, px: 1.5, py: 0.5, borderRadius: 1, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Delete
          </Box>
        </Box>
      )}
    </Box>
  );
};

const TABLE_COLS = ['Name', 'Category', 'Price', 'Description', 'Available Time', ''];
const TABLE_GRID = '1.5fr 1fr 90px 1.5fr 1fr 120px';

const ColHeader = ({ data: h }) => (
  <Typography sx={{ ...LABEL_SX, fontSize: 10 }}>{h}</Typography>
);

function ManageRestaurant({ hotelId, account, loading, setLoading, alertSuccess, alertError }) {
  const canManage = !!constants.PERMISSIONS.CAN_MANAGE_RESTAURANT_MENU[account?.role];
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(defaultForm);

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
    if (res?.success) { setShowDelete(false); setDeleteTarget(null); fetchItems(); }
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
            <Box component="button" onClick={openAdd}
              sx={{ border: 'none', background: BRAND_GRADIENT, color: 'var(--app-primary-contrast)', px: 2, py: 0.9, borderRadius: 1.5, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              + Add item
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: TABLE_GRID, px: 2.5, py: 1.25, bgcolor: BG, borderBottom: `1px solid ${BORDER}` }}>
          <MapComponent Component={ColHeader} data={TABLE_COLS} showNoDataAvailable={false} />
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
              <TextField fullWidth size="small" label="Price" type="number" inputProps={{ min: 0, step: 0.01 }} value={form.price} onChange={handleChange('price')} required sx={inputSx} />
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
              <TextField fullWidth size="small" label="Sort order" type="number" inputProps={{ min: 0 }} value={form.sortOrder} onChange={handleChange('sortOrder')} sx={inputSx} />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editingItem ? 'Save changes' : 'Add item'}</Button>
          </DialogActions>
        </Box>
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
