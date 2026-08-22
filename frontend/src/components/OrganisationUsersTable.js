import React, { useState } from 'react';
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import request from '../helper/api';
import MapComponent from './MapComponent';
import { SearchBar, inputSx } from './cards/AppCards';
import { BRAND_GRADIENT, NAVY, MUTED, BORDER, SHADOW, TEXT_MUTED_LIGHT, HOVER_BG, PRIMARY_CONTRAST } from '../theme';
import constants from '../constants.json';

const labels = constants.ORGANISATIONS.USERS;
const ROLES = constants.ACCOUNT_ROLES;

// Email column hides on mobile; Actions stays last so the row never reflows away
// from its controls.
const COLS = { xs: '1fr 100px auto', sm: '1fr 1.2fr 110px 1fr auto' };

const emptyUser = { email: '', name: '', role: ROLES.HOTEL_STAFF, organisationId: '' };

function HeaderCell({ data: header }) {
  return (
    <Typography
      sx={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: TEXT_MUTED_LIGHT,
        display: header.hideOnMobile ? { xs: 'none', sm: 'block' } : 'block',
      }}
    >
      {header.label}
    </Typography>
  );
}

/**
 * The Users tab: staff-side accounts as a table, in the shape Manage Costs uses.
 *
 * An owner sees only their own organisation's people — the backend narrows the
 * list, and this hides the organisation picker so the UI does not offer a choice
 * the API would refuse.
 */
function OrganisationUsersTable({ users, organisations, account, loading, setLoading, alertSuccess, alertError, onChanged }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(emptyUser);

  const isAdmin = account?.role === ROLES.ADMIN;
  const CAN_MANAGE_USERS = account && !!constants.PERMISSIONS.CAN_MANAGE_USERS[account.role];

  // Only an admin may mint another admin, so owners never see the option.
  const roleOptions = isAdmin ? labels.ROLE_OPTIONS : labels.ROLE_OPTIONS.filter((r) => r.value !== ROLES.ADMIN);

  const headers = [
    { key: 'name', label: labels.NAME_LABEL },
    { key: 'email', label: labels.EMAIL_LABEL, hideOnMobile: true },
    { key: 'role', label: labels.ROLE_LABEL },
    { key: 'organisation', label: labels.ORGANISATION_LABEL, hideOnMobile: true },
    { key: 'actions', label: labels.ACTIONS_LABEL },
  ];

  const handleInput = (field) => (e) => setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const openCreate = () => {
    setValues({ ...emptyUser, organisationId: isAdmin ? '' : account?.organisationId ?? '' });
    setEditing({});
  };

  const openEdit = (user) => {
    setValues({
      email: user.email ?? '',
      name: user.name ?? '',
      role: user.role,
      organisationId: user.organisationId ?? '',
    });
    setEditing(user);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const isUpdate = !!editing?.id;
    if (!isUpdate && !values.email?.trim()) {
      alertError?.(labels.EMAIL_REQUIRED_MESSAGE);
      return;
    }
    if (!values.role) {
      alertError?.(labels.ROLE_REQUIRED_MESSAGE);
      return;
    }

    // An admin carries no organisation by design, so send null rather than a
    // stale id left in the form when the role was switched.
    const organisationId = values.role === ROLES.ADMIN ? null : Number(values.organisationId) || null;

    const result = await request({
      endpoint: isUpdate ? `/organisation-users/${editing.id}` : '/organisation-users',
      method: isUpdate ? 'PATCH' : 'POST',
      data: isUpdate
        ? { name: values.name?.trim(), role: values.role, organisationId }
        : { email: values.email.trim(), name: values.name?.trim(), role: values.role, organisationId },
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result?.success) {
      setEditing(null);
      onChanged?.();
    }
  };

  const roleLabel = (role) => labels.ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
  const organisationName = (user) => user.organisation?.name || labels.NO_ORGANISATION_LABEL;

  const term = search.trim().toLowerCase();
  const visible = term
    ? users.filter((u) => [u.name, u.email, roleLabel(u.role), u.organisation?.name].filter(Boolean).join(' ').toLowerCase().includes(term))
    : users;

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'center' }}>
        <SearchBar value={search} onChange={setSearch} placeholder={labels.SEARCH_PLACEHOLDER} />
        {CAN_MANAGE_USERS && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            sx={{ background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, boxShadow: SHADOW, borderRadius: 2, textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
          >
            {labels.ADD_BUTTON_LABEL}
          </Button>
        )}
      </Box>

      <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, border: `1px solid ${BORDER}`, boxShadow: SHADOW, overflow: 'hidden' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: COLS,
            gap: { xs: 1, sm: 2 },
            px: { xs: 2, sm: 3 },
            py: 1.5,
            borderBottom: `1px solid ${BORDER}`,
            background: 'var(--app-navy-gradient)',
          }}
        >
          <MapComponent Component={HeaderCell} data={headers} showNoDataAvailable={false} isLoading={false} />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : visible.length > 0 ? (
          visible.map((user, i) => (
            <motion.div key={user.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: COLS,
                  gap: { xs: 1, sm: 2 },
                  px: { xs: 2, sm: 3 },
                  py: 2,
                  alignItems: 'center',
                  borderBottom: i < visible.length - 1 ? `1px solid ${BORDER}` : 'none',
                  '&:hover': { bgcolor: HOVER_BG },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name || '—'}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: MUTED, display: { xs: 'block', sm: 'none' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 13, color: MUTED, display: { xs: 'none', sm: 'block' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>{roleLabel(user.role)}</Typography>
                <Typography sx={{ fontSize: 13, color: MUTED, display: { xs: 'none', sm: 'block' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {organisationName(user)}
                </Typography>
                <Box>
                  {CAN_MANAGE_USERS && (
                    <IconButton size="small" onClick={() => openEdit(user)} aria-label={labels.EDIT_TITLE}>
                      <EditIcon sx={{ fontSize: 16, color: MUTED }} />
                    </IconButton>
                  )}
                </Box>
              </Box>
            </motion.div>
          ))
        ) : (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, color: MUTED }}>{labels.EMPTY_MESSAGE}</Typography>
          </Box>
        )}
      </Box>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800 }}>{editing?.id ? labels.EDIT_TITLE : labels.CREATE_TITLE}</DialogTitle>
        <form onSubmit={handleSave}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label={labels.EMAIL_LABEL}
              type="email"
              required={!editing?.id}
              // An email is the account's identity, so it is set once at creation
              // rather than edited underneath everything that references it.
              disabled={!!editing?.id}
              value={values.email}
              onChange={handleInput('email')}
              InputLabelProps={{ shrink: true }}
              sx={inputSx}
            />
            <TextField
              fullWidth
              label={labels.NAME_LABEL}
              value={values.name}
              onChange={handleInput('name')}
              InputLabelProps={{ shrink: true }}
              sx={inputSx}
            />
            <TextField fullWidth select label={labels.ROLE_LABEL} value={values.role} onChange={handleInput('role')} InputLabelProps={{ shrink: true }} sx={inputSx}>
              {roleOptions.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </TextField>

            {values.role !== ROLES.ADMIN &&
              (isAdmin ? (
                <TextField
                  fullWidth
                  select
                  label={labels.ORGANISATION_LABEL}
                  value={values.organisationId}
                  onChange={handleInput('organisationId')}
                  InputLabelProps={{ shrink: true }}
                  sx={inputSx}
                >
                  {organisations.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <Typography sx={{ fontSize: 12, color: MUTED }}>{labels.ORGANISATION_FIXED_HELP}</Typography>
              ))}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setEditing(null)} sx={{ color: MUTED, textTransform: 'none' }}>
              {labels.CANCEL_BUTTON_LABEL}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              {labels.SAVE_BUTTON_LABEL}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

export default OrganisationUsersTable;
