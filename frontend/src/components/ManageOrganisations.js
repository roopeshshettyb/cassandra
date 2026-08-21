import React, { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Tab, Tabs, TextField } from '@mui/material';
import { motion } from 'framer-motion';
import AddIcon from '@mui/icons-material/Add';
import request from '../helper/api';
import DataGrid from './DataGrid';
import MapComponent from './MapComponent';
import OrganisationCard from './cards/OrganisationCard';
import OrganisationUsersTable from './OrganisationUsersTable';
import { PageHeader, SearchBar, inputSx } from './cards/AppCards';
import { BRAND_GRADIENT, MUTED, PRIMARY_CONTRAST, SHADOW } from '../theme';
import constants from '../constants.json';

const labels = constants.ORGANISATIONS;

const emptyOrganisation = { name: '', description: '' };

const FIELDS = [
  { field: 'name', label: labels.NAME_LABEL, required: true },
  { field: 'description', label: labels.DESCRIPTION_LABEL, multiline: true },
];

function OrganisationFieldRow({ data: config, values, handleInput }) {
  const { field, label, required, type, multiline } = config;
  return (
    <TextField
      fullWidth
      label={label}
      type={type || 'text'}
      required={!!required}
      multiline={!!multiline}
      minRows={multiline ? 2 : undefined}
      value={values[field] || ''}
      onChange={handleInput(field)}
      InputLabelProps={{ shrink: true }}
      sx={inputSx}
    />
  );
}

function ManageOrganisations({ loading, setLoading, account, navigate, alertSuccess, alertError, isMobile }) {
  const [organisations, setOrganisations] = useState([]);
  const [users, setUsers] = useState([]);
  // An owner reaches this page from a "Manage Users" nav item and cannot edit
  // organisations, so open on the tab they came for.
  const [tab, setTab] = useState(account && constants.PERMISSIONS.CAN_MANAGE_ORGANISATIONS[account.role] ? 0 : 1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(emptyOrganisation);
  const [deleting, setDeleting] = useState(null);

  const CAN_MANAGE_ORGANISATIONS = account && !!constants.PERMISSIONS.CAN_MANAGE_ORGANISATIONS[account.role];

  const fetchOrganisations = async () => {
    await request({ endpoint: '/organisations', method: 'GET', setLoading, setData: setOrganisations, defaultData: [], alertError, delay: false });
  };

  const fetchUsers = async () => {
    await request({ endpoint: '/organisation-users', method: 'GET', setData: setUsers, defaultData: [], alertError });
  };

  useEffect(() => {
    fetchOrganisations();
    fetchUsers();
  }, []);

  const handleInput = (field) => (e) => setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const openCreate = () => {
    setValues(emptyOrganisation);
    setEditing({});
  };

  const openEdit = (organisation) => {
    setValues({ name: organisation.name ?? '', description: organisation.description ?? '' });
    setEditing(organisation);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!values.name?.trim()) {
      alertError?.(labels.NAME_REQUIRED_MESSAGE);
      return;
    }
    const isUpdate = !!editing?.id;
    const result = await request({
      endpoint: isUpdate ? `/organisations/${editing.id}` : '/organisations',
      method: isUpdate ? 'PATCH' : 'POST',
      data: { name: values.name.trim(), description: values.description?.trim() || undefined },
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result?.success) {
      setEditing(null);
      fetchOrganisations();
    }
  };

  const handleDelete = async () => {
    const result = await request({ endpoint: `/organisations/${deleting.id}`, method: 'DELETE', setLoading, alertSuccess, alertError });
    if (result?.success) {
      setDeleting(null);
      fetchOrganisations();
      // A deleted organisation can only have had no members, but the users list
      // still carries its name in a column, so keep the two views in step.
      fetchUsers();
    }
  };

  const term = search.trim().toLowerCase();
  const visibleOrganisations = term
    ? organisations.filter((o) =>
        [o.name, o.description].filter(Boolean).join(' ').toLowerCase().includes(term),
      )
    : organisations;

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: '4vh', sm: 1.5 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          eyebrow={labels.PAGE_EYEBROW}
          title={labels.PAGE_TITLE}
          right={
            CAN_MANAGE_ORGANISATIONS && tab === 0 ? (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreate}
                sx={{ background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, boxShadow: SHADOW, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
              >
                {labels.ADD_BUTTON_LABEL}
              </Button>
            ) : null
          }
        />
      </motion.div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2.5, minHeight: 0 }}>
        <Tab label={labels.TAB_ORGANISATIONS} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 13 }} />
        <Tab label={labels.TAB_USERS} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 13 }} />
      </Tabs>

      {tab === 0 ? (
        <>
          <Box sx={{ mb: 3 }}>
            <SearchBar value={search} onChange={setSearch} placeholder={labels.SEARCH_PLACEHOLDER} />
          </Box>
          <DataGrid
            CardComponent={OrganisationCard}
            data={visibleOrganisations}
            isLoading={loading}
            navigate={navigate}
            onEdit={CAN_MANAGE_ORGANISATIONS ? openEdit : null}
            onDelete={CAN_MANAGE_ORGANISATIONS ? setDeleting : null}
          />
        </>
      ) : (
        <OrganisationUsersTable
          users={users}
          organisations={organisations}
          account={account}
          loading={loading}
          setLoading={setLoading}
          alertSuccess={alertSuccess}
          alertError={alertError}
          onChanged={() => {
            fetchUsers();
            // Member counts on the organisation cards move with every user change.
            fetchOrganisations();
          }}
        />
      )}

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 800 }}>{editing?.id ? labels.EDIT_TITLE : labels.CREATE_TITLE}</DialogTitle>
        <form onSubmit={handleSave}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <MapComponent
              Component={OrganisationFieldRow}
              data={FIELDS}
              values={values}
              handleInput={handleInput}
              showNoDataAvailable={false}
              isLoading={false}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setEditing(null)} sx={{ color: MUTED, textTransform: 'none' }}>
              {labels.USERS.CANCEL_BUTTON_LABEL}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              {labels.USERS.SAVE_BUTTON_LABEL}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>{labels.DELETE_TITLE}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {labels.DELETE_CONFIRM_PREFIX} <strong>{deleting?.name}</strong>? {labels.DELETE_CONFIRM_SUFFIX}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleting(null)} sx={{ color: MUTED, textTransform: 'none' }}>
            {labels.USERS.CANCEL_BUTTON_LABEL}
          </Button>
          <Button onClick={handleDelete} variant="contained" color="error" sx={{ textTransform: 'none', fontWeight: 700 }}>
            {labels.DELETE_BUTTON_LABEL}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ManageOrganisations;
