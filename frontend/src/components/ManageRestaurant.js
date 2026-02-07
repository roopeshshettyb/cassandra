import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  MenuItem as MuiMenuItem,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import DataTable from './DataTable';
import request from '../helper/api';

const MotionBox = motion(Box);

const CATEGORIES = [
  { value: 'appetizer', label: 'Appetizer' },
  { value: 'main_course', label: 'Main Course' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'beverage', label: 'Beverage' },
  { value: 'side', label: 'Side' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snacks' },
];

const MenuItemRow = ({ data, onEdit, onDelete }) => {
  const item = data;
  const descTruncated = item.description ? (item.description.length > 40 ? `${item.description.slice(0, 40)}...` : item.description) : '-';
  const availableTime = [item.availableStartTime, item.availableEndTime].filter(Boolean).join(' - ') || '-';
  const categoryLabel = CATEGORIES.find((c) => c.value === item.category)?.label || item.category;

  const handleEdit = (e) => {
    e.stopPropagation();
    if (onEdit && item.id) onEdit(item);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete && item.id) onDelete(item);
  };

  return (
    <TableRow>
      <TableCell>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {item.name || '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {categoryLabel}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {item.price != null ? `₹${Number(item.price).toFixed(2)}` : '-'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 180 }} noWrap>
          {descTruncated}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {availableTime}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {item.isAvailable ? 'Yes' : 'No'}
        </Typography>
      </TableCell>
      <TableCell>
        <Button size="small" color="primary" variant="outlined" onClick={handleEdit} sx={{ mr: 1 }}>
          Edit
        </Button>
        <Button size="small" color="error" variant="outlined" onClick={handleDelete}>
          Delete
        </Button>
      </TableCell>
    </TableRow>
  );
};

const defaultFormValues = {
  name: '',
  description: '',
  price: '',
  category: '',
  availableStartTime: '',
  availableEndTime: '',
  isAvailable: true,
  dietaryTags: '',
  imageUrl: '',
  sortOrder: 0,
};

function ManageRestaurant({ hotelId, loading, setLoading, account, alertSuccess, alertError, isMobile }) {
  const [items, setItems] = useState([]);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formValues, setFormValues] = useState(defaultFormValues);

  const fetchItems = async () => {
    if (!hotelId) return;
    await request({
      endpoint: `/restaurant/menu-items?hotelId=${hotelId}`,
      method: 'GET',
      setLoading,
      setData: setItems,
      defaultData: [],
      alertError,
    });
  };

  useEffect(() => {
    if (hotelId) {
      fetchItems();
    }
  }, [hotelId]);

  const handleInputChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setFormValues(defaultFormValues);
    setShowFormDialog(true);
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setFormValues({
      name: item.name || '',
      description: item.description || '',
      price: item.price ?? '',
      category: item.category || '',
      availableStartTime: item.availableStartTime || '',
      availableEndTime: item.availableEndTime || '',
      isAvailable: item.isAvailable !== false,
      dietaryTags: Array.isArray(item.dietaryTags) ? item.dietaryTags.join(', ') : '',
      imageUrl: item.imageUrl || '',
      sortOrder: item.sortOrder ?? 0,
    });
    setShowFormDialog(true);
  };

  const closeFormDialog = () => {
    setShowFormDialog(false);
    setEditingItem(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, description, price, category, availableStartTime, availableEndTime, isAvailable, dietaryTags, imageUrl, sortOrder } = formValues;
    if (!name || !price || !category) {
      alertError && alertError('Name, price and category are required');
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      alertError && alertError('Price must be a valid non-negative number');
      return;
    }
    const tags = dietaryTags
      ? dietaryTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    setSaving(true);
    try {
      if (editingItem) {
        const result = await request({
          endpoint: `/restaurant/menu-items/${editingItem.id}`,
          method: 'PATCH',
          data: {
            name,
            description: description || undefined,
            price: priceNum,
            category,
            availableStartTime: availableStartTime || undefined,
            availableEndTime: availableEndTime || undefined,
            isAvailable,
            dietaryTags: tags,
            imageUrl: imageUrl || undefined,
            sortOrder: parseInt(sortOrder, 10) || 0,
          },
          setLoading,
          alertSuccess,
          alertError,
        });
        if (result && result.success) {
          closeFormDialog();
          fetchItems();
        }
      } else {
        const result = await request({
          endpoint: '/restaurant/menu-items',
          method: 'POST',
          data: {
            hotelId: Number(hotelId),
            name,
            description: description || undefined,
            price: priceNum,
            category,
            availableStartTime: availableStartTime || undefined,
            availableEndTime: availableEndTime || undefined,
            isAvailable,
            dietaryTags: tags,
            imageUrl: imageUrl || undefined,
            sortOrder: parseInt(sortOrder, 10) || 0,
          },
          setLoading,
          alertSuccess,
          alertError,
        });
        if (result && result.success) {
          closeFormDialog();
          fetchItems();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (item) => {
    setDeleteTarget(item);
    setShowDeleteDialog(true);
  };

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const result = await request({
      endpoint: `/restaurant/menu-items/${deleteTarget.id}`,
      method: 'DELETE',
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result && result.success) {
      closeDeleteDialog();
      fetchItems();
    }
  };

  const menuColumns = [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'price', label: 'Price' },
    { key: 'description', label: 'Description' },
    { key: 'availableTime', label: 'Available Time' },
    { key: 'isAvailable', label: 'Available' },
    { key: 'actions', label: 'Actions' },
  ];

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Restaurant Menu
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Manage menu items for this hotel. Add, edit or remove items.
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" color="primary" onClick={openAddDialog}>
          Add Item
        </Button>
      </Box>

      <DataTable columns={menuColumns} RowComponent={MenuItemRow} data={items} isLoading={loading} onEdit={openEditDialog} onDelete={openDeleteDialog} />

      <Dialog open={showFormDialog} onClose={closeFormDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField fullWidth label="Name" value={formValues.name} onChange={handleInputChange('name')} required />
              <TextField fullWidth label="Description" multiline rows={2} value={formValues.description} onChange={handleInputChange('description')} />
              <TextField fullWidth label="Price" type="number" inputProps={{ min: 0, step: 0.01 }} value={formValues.price} onChange={handleInputChange('price')} required />
              <TextField
                fullWidth
                select
                label="Category"
                value={formValues.category}
                onChange={handleInputChange('category')}
                required
                SelectProps={{ displayEmpty: true, renderValue: (v) => CATEGORIES.find((c) => c.value === v)?.label || 'Select category', MenuProps: { sx: { zIndex: 1400 } } }}
                InputLabelProps={{ shrink: true }}
              >
                {CATEGORIES.map((c) => (
                  <MuiMenuItem key={c.value} value={c.value}>
                    {c.label}
                  </MuiMenuItem>
                ))}
              </TextField>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Available Start Time"
                  type="time"
                  value={formValues.availableStartTime}
                  onChange={handleInputChange('availableStartTime')}
                  inputProps={{ step: 60 }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  label="Available End Time"
                  type="time"
                  value={formValues.availableEndTime}
                  onChange={handleInputChange('availableEndTime')}
                  inputProps={{ step: 60 }}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              <FormControlLabel control={<Checkbox checked={formValues.isAvailable} onChange={handleInputChange('isAvailable')} />} label="Available" />
              <TextField
                fullWidth
                label="Dietary Tags (comma-separated)"
                value={formValues.dietaryTags}
                onChange={handleInputChange('dietaryTags')}
                placeholder="e.g. vegetarian, vegan, gluten-free"
              />
              <TextField fullWidth label="Image URL" value={formValues.imageUrl} onChange={handleInputChange('imageUrl')} />
              <TextField fullWidth label="Sort Order" type="number" inputProps={{ min: 0 }} value={formValues.sortOrder} onChange={handleInputChange('sortOrder')} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeFormDialog}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary" disabled={saving}>
              {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={showDeleteDialog} onClose={closeDeleteDialog}>
        <DialogTitle>Delete menu item</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ManageRestaurant;
