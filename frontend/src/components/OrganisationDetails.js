import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { BusinessOutlined, PeopleOutline, DeleteOutline } from '@mui/icons-material';
import request from '../helper/api';
import MapComponent from './MapComponent';
import OrganisationUsersTable from './OrganisationUsersTable';
import { FormCard, FormFieldRow } from './cards/AppCards';
import { DetailBreadcrumb, DetailHero, DetailTabBar, UnsavedChangesBar } from './DetailShell';
import { MUTED, NAVY_GRADIENT, TEXT_MUTED_LIGHT } from '../theme';
import constants from '../constants.json';

const labels = constants.ORGANISATIONS;

const TABS = [
  { key: 'details', label: labels.TAB_DETAILS, Icon: BusinessOutlined },
  { key: 'members', label: labels.TAB_USERS, Icon: PeopleOutline },
  { key: 'danger', label: labels.TAB_DANGER, Icon: DeleteOutline },
];

const FIELDS = [
  { field: 'name', label: labels.NAME_LABEL, required: true },
  { field: 'description', label: labels.DESCRIPTION_LABEL, multiline: true, minRows: 3 },
];

function OrganisationDetails({ loading, setLoading, account, navigate, alertSuccess, alertError }) {
  const { id } = useParams();
  const [organisation, setOrganisation] = useState(null);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('details');
  const [values, setValues] = useState({ name: '', description: '' });
  const [dirty, setDirty] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const CAN_MANAGE_ORGANISATIONS = account && !!constants.PERMISSIONS.CAN_MANAGE_ORGANISATIONS[account.role];

  const applyOrganisation = (data) => {
    setOrganisation(data);
    setValues({ name: data?.name ?? '', description: data?.description ?? '' });
    setDirty(false);
  };

  const fetchOrganisation = async () => {
    await request({ endpoint: `/organisations/${id}`, method: 'GET', setLoading, setData: applyOrganisation, defaultData: null, alertError, delay: false });
  };

  const fetchUsers = async () => {
    await request({ endpoint: `/organisation-users?organisationId=${id}`, method: 'GET', setData: setUsers, defaultData: [], alertError });
  };

  useEffect(() => {
    fetchOrganisation();
    fetchUsers();
  }, []);

  const handleInput = (field) => (e) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!values.name?.trim()) {
      alertError?.(labels.NAME_REQUIRED_MESSAGE);
      return;
    }
    const result = await request({
      endpoint: `/organisations/${id}`,
      method: 'PATCH',
      data: { name: values.name.trim(), description: values.description?.trim() ?? '' },
      setLoading,
      alertSuccess,
      alertError,
    });
    if (result?.success) {
      fetchOrganisation();
    }
  };

  const handleDelete = async () => {
    const result = await request({ endpoint: `/organisations/${id}`, method: 'DELETE', setLoading, alertSuccess, alertError });
    if (result?.success) {
      setConfirmingDelete(false);
      navigate('/organisations');
    }
  };

  if (!organisation) return null;

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 12, maxWidth: 1200, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <DetailBreadcrumb
          items={[
            { label: labels.PAGE_TITLE, onClick: () => navigate('/organisations') },
            { label: organisation.name },
          ]}
        />

        <DetailHero
          name={organisation.name}
          gradient={NAVY_GRADIENT}
          eyebrow={labels.PAGE_EYEBROW}
          fallback={organisation.name?.[0]?.toUpperCase()}
          meta={
            <Typography sx={{ fontSize: 12, color: TEXT_MUTED_LIGHT }}>
              {users.length} {labels.MEMBERS_LABEL.toLowerCase()}
            </Typography>
          }
        />

        <DetailTabBar tabs={CAN_MANAGE_ORGANISATIONS ? TABS : TABS.filter((t) => t.key === 'members')} active={tab} onChange={setTab} />
      </motion.div>

      {tab === 'details' && CAN_MANAGE_ORGANISATIONS && (
        <FormCard title={labels.DETAILS_CARD_TITLE} sub={labels.DETAILS_CARD_SUB}>
          <MapComponent Component={FormFieldRow} data={FIELDS} values={values} onChange={handleInput} withLabel showNoDataAvailable={false} isLoading={false} />
        </FormCard>
      )}

      {tab === 'members' && (
        <OrganisationUsersTable
          users={users}
          organisations={[organisation]}
          organisationId={organisation.id}
          account={account}
          loading={loading}
          setLoading={setLoading}
          alertSuccess={alertSuccess}
          alertError={alertError}
          onChanged={() => {
            fetchUsers();
            fetchOrganisation();
          }}
        />
      )}

      {tab === 'danger' && CAN_MANAGE_ORGANISATIONS && (
        <FormCard title={labels.DANGER_CARD_TITLE} sub={labels.DANGER_CARD_SUB}>
          <Button
            variant="contained"
            color="error"
            onClick={() => setConfirmingDelete(true)}
            sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
          >
            {labels.DELETE_TITLE}
          </Button>
        </FormCard>
      )}

      {dirty && <UnsavedChangesBar onDiscard={() => applyOrganisation(organisation)} onSave={handleSave} />}

      <Dialog open={confirmingDelete} onClose={() => setConfirmingDelete(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>{labels.DELETE_TITLE}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {labels.DELETE_CONFIRM_PREFIX} <strong>{organisation.name}</strong>? {labels.DELETE_CONFIRM_SUFFIX}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setConfirmingDelete(false)} sx={{ color: MUTED, textTransform: 'none' }}>
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

export default OrganisationDetails;
