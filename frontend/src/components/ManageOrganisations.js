import { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField } from '@mui/material';
import { GridView, TableRows } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import { motion } from 'framer-motion';
import request from '../helper/api';
import DataGrid from './DataGrid';
import MapComponent from './MapComponent';
import OrganisationCard, { OrganisationTableRow } from './cards/OrganisationCard';
import { ColumnLabel, CARD_SX, PageHeader, SearchBar, inputSx } from './cards/AppCards';
import { BRAND_GRADIENT, NAVY, BORDER, SHADOW, MUTED, PRIMARY_CONTRAST, BG } from '../theme';
import constants from '../constants.json';

const labels = constants.ORGANISATIONS;
const TABLE_COLS = [labels.NAME_LABEL, labels.MEMBERS_LABEL, ''];
const emptyOrganisation = { name: '', description: '' };

const FIELDS = [
  { field: 'name', label: labels.NAME_LABEL, required: true },
  { field: 'description', label: labels.DESCRIPTION_LABEL, multiline: true },
];

function OrganisationFieldRow({ data: config, values, handleInput }) {
  const { field, label, required, multiline } = config;
  return (
    <TextField
      fullWidth
      label={label}
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
  const [view, setView] = useState('gallery');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState(emptyOrganisation);

  const CAN_MANAGE_ORGANISATIONS = account && !!constants.PERMISSIONS.CAN_MANAGE_ORGANISATIONS[account.role];

  const fetchOrganisations = async () => {
    await request({ endpoint: '/organisations', method: 'GET', setLoading, setData: setOrganisations, defaultData: [], alertError, delay: false });
  };

  useEffect(() => {
    fetchOrganisations();
  }, []);

  const handleInput = (field) => (e) => setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!values.name?.trim()) {
      alertError?.(labels.NAME_REQUIRED_MESSAGE);
      return;
    }
    const result = await request({
      endpoint: '/organisations',
      method: 'POST',
      data: { name: values.name.trim(), description: values.description?.trim() || undefined },
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result?.success) {
      setCreating(false);
      setValues(emptyOrganisation);
      fetchOrganisations();
    }
  };

  const term = search.trim().toLowerCase();
  const visible = term
    ? organisations.filter((o) => [o.name, o.description].filter(Boolean).join(' ').toLowerCase().includes(term))
    : organisations;

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pt: { xs: '4vh', sm: 1.5 }, pb: 6, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          eyebrow={labels.PAGE_EYEBROW}
          title={labels.PAGE_TITLE}
          right={
            CAN_MANAGE_ORGANISATIONS ? (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => { setValues(emptyOrganisation); setCreating(true); }}
                sx={{ background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, boxShadow: SHADOW, borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
              >
                {labels.ADD_BUTTON_LABEL}
              </Button>
            ) : null
          }
        />
      </motion.div>

      {/* Filter rail */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'center' }}>
        <SearchBar value={search} onChange={setSearch} placeholder={labels.SEARCH_PLACEHOLDER} />
        <Box sx={{ display: 'flex', gap: 0.5, bgcolor: BG, borderRadius: 2, p: 0.5, flexShrink: 0 }}>
          <IconButton size="small" onClick={() => setView('gallery')} sx={{ borderRadius: 1.5, bgcolor: view === 'gallery' ? 'background.paper' : 'transparent', boxShadow: view === 'gallery' ? SHADOW : 'none' }}>
            <GridView sx={{ fontSize: 18, color: view === 'gallery' ? NAVY : MUTED }} />
          </IconButton>
          <IconButton size="small" onClick={() => setView('table')} sx={{ borderRadius: 1.5, bgcolor: view === 'table' ? 'background.paper' : 'transparent', boxShadow: view === 'table' ? SHADOW : 'none' }}>
            <TableRows sx={{ fontSize: 18, color: view === 'table' ? NAVY : MUTED }} />
          </IconButton>
        </Box>
      </Box>

      {view === 'gallery' ? (
        <DataGrid CardComponent={OrganisationCard} data={visible} isLoading={loading} navigate={navigate} />
      ) : (
        <Box sx={{ ...CARD_SX, overflow: 'hidden' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', px: 2.5, py: 1.5, borderBottom: `1px solid ${BORDER}`, gap: 1 }}>
            <MapComponent Component={ColumnLabel} data={TABLE_COLS} showNoDataAvailable={false} />
          </Box>
          <MapComponent Component={OrganisationTableRow} data={visible} isLoading={loading} navigate={navigate} />
        </Box>
      )}

      <Dialog open={creating} onClose={() => setCreating(false)} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ fontWeight: 800 }}>{labels.CREATE_TITLE}</DialogTitle>
        <form onSubmit={handleCreate}>
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
            <Button onClick={() => setCreating(false)} sx={{ color: MUTED, textTransform: 'none' }}>
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
    </Box>
  );
}

export default ManageOrganisations;
