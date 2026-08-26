import React, { useState } from 'react';
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import request from '../helper/api';
import MapComponent from './MapComponent';
import { ColumnLabel, PrimaryButton, SearchBar, inputSx } from './cards/AppCards';
import { MemberRow } from './cards/MemberRow';
import { MUTED, BORDER, SHADOW } from '../theme';
import constants from '../constants.json';

const labels = constants.ORGANISATIONS.USERS;
const ROLES = constants.ACCOUNT_ROLES;


const emptyUser = { email: '', name: '', role: ROLES.HOTEL_STAFF, organisationId: '' };

const COLS = '40px 1fr 110px 1fr auto';

function UserRow({ data: user, canManage, roleLabel, onEdit }) {
  return (
    <MemberRow
      name={user.name}
      email={user.email}
      gridTemplateColumns={COLS}
      hover
      columns={[
        { value: roleLabel(user.role), strong: true },
        { value: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—', hideOnMobile: true },
      ]}
      trailing={canManage && (
        <IconButton size="small" onClick={() => onEdit(user)} aria-label={labels.EDIT_TITLE}>
          <EditIcon sx={{ fontSize: 16, color: MUTED }} />
        </IconButton>
      )}
    />
  );
}

// Owners see only their own organisation's people; the picker is hidden for them
// because the API would refuse another.
function OrganisationUsersTable({ users, organisations, organisationId, account, loading, setLoading, alertSuccess, alertError, onChanged }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(emptyUser);

  const isAdmin = account?.role === ROLES.ADMIN;
  const CAN_MANAGE_USERS = account && !!constants.PERMISSIONS.CAN_MANAGE_USERS[account.role];

  // Only an admin may mint another admin, so owners never see the option.
  const roleOptions = isAdmin ? labels.ROLE_OPTIONS : labels.ROLE_OPTIONS.filter((r) => r.value !== ROLES.ADMIN);

  const headers = [
    { label: '', onDark: true },
    { label: labels.NAME_LABEL, onDark: true },
    { label: labels.ROLE_LABEL, onDark: true },
    { label: labels.JOINED_LABEL, onDark: true, hideOnMobile: true },
    { label: labels.ACTIONS_LABEL, onDark: true },
  ];

  const handleInput = (field) => (e) => setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const openCreate = () => {
    setValues({ ...emptyUser, organisationId: organisationId ?? (isAdmin ? '' : account?.organisationId ?? '') });
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

  const term = search.trim().toLowerCase();
  const visible = term
    ? users.filter((u) => [u.name, u.email, roleLabel(u.role)].filter(Boolean).join(' ').toLowerCase().includes(term))
    : users;

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'center' }}>
        <SearchBar value={search} onChange={setSearch} placeholder={labels.SEARCH_PLACEHOLDER} />
        {CAN_MANAGE_USERS && (
          <PrimaryButton startIcon={<AddIcon />} onClick={openCreate} sx={{ boxShadow: SHADOW, flexShrink: 0 }}>
            {labels.ADD_BUTTON_LABEL}
          </PrimaryButton>
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
          <MapComponent Component={ColumnLabel} data={headers} showNoDataAvailable={false} isLoading={false} />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : visible.length > 0 ? (
          <MapComponent
            Component={UserRow}
            data={visible}
            showNoDataAvailable={false}
            isLoading={false}
            canManage={CAN_MANAGE_USERS}
            roleLabel={roleLabel}
            onEdit={openEdit}
          />
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
              // The email is the account uuid, so it is set once at creation.
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
            <PrimaryButton type="submit" disabled={loading}>{labels.SAVE_BUTTON_LABEL}</PrimaryButton>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

export default OrganisationUsersTable;
