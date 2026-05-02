import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Checkbox, Container, FormControlLabel,
  Grid, TextField, Typography,
} from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import MapComponent from './MapComponent';
import { MUTED, NAVY } from '../theme';

const MotionBox = motion(Box);

const hoursFieldConfigs = [
  { key: 'checkInTime', label: 'Check-in Time', type: 'time' },
  { key: 'checkOutTime', label: 'Check-out Time', type: 'time' },
  { key: 'poolHours', label: 'Pool Hours' },
  { key: 'gymHours', label: 'Gym Hours' },
  { key: 'restaurantHours', label: 'Restaurant Hours' },
  { key: 'wifiPassword', label: 'Wi-Fi Password' },
  { key: 'breakfastHours', label: 'Breakfast Hours' },
  { key: 'lunchHours', label: 'Lunch Hours' },
  { key: 'dinnerHours', label: 'Dinner Hours' },
  { key: 'snacksHours', label: 'Snacks Hours' },
  { key: 'houseKeepingHours', label: 'House Keeping Hours' },
  { key: 'roomServiceHours', label: 'Room Service Hours' },
];

const HoursEditField = ({ data, editValues, handleInputChange }) => (
  <Grid item xs={12} sm={6}>
    <TextField fullWidth label={data.label} type={data.type || 'text'}
      value={editValues[data.key] || ''} onChange={handleInputChange(data.key)}
      inputProps={data.type === 'time' ? { step: 60 } : undefined} />
  </Grid>
);

function BrandDetails({ loading, setLoading, account, navigate, alertSuccess, alertError }) {
  const { id } = useParams();
  const [brand, setBrand] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [propagate, setPropagate] = useState(true);
  const [editValues, setEditValues] = useState({
    checkInTime: '', checkOutTime: '', poolHours: '', gymHours: '',
    restaurantHours: '', wifiPassword: '', breakfastHours: '', lunchHours: '',
    dinnerHours: '', snacksHours: '', houseKeepingHours: '', roomServiceHours: '',
    llmInstructions: '', primaryColor: '', secondaryColor: '',
  });

  const fetchBrand = async () => {
    const data = await request({ endpoint: `/hotels/brands/${id}`, method: 'GET', setLoading, defaultData: null, alertError });
    if (data) {
      setBrand(data);
      setEditValues({
        checkInTime: data.checkInTime || '',
        checkOutTime: data.checkOutTime || '',
        poolHours: data.poolHours || '',
        gymHours: data.gymHours || '',
        restaurantHours: data.restaurantHours || '',
        wifiPassword: data.wifiPassword || '',
        breakfastHours: data.breakfastHours || '',
        lunchHours: data.lunchHours || '',
        dinnerHours: data.dinnerHours || '',
        snacksHours: data.snacksHours || '',
        houseKeepingHours: data.houseKeepingHours || '',
        roomServiceHours: data.roomServiceHours || '',
        llmInstructions: data.llmInstructions || '',
        primaryColor: data.themeConfig?.primaryColor || '',
        secondaryColor: data.themeConfig?.secondaryColor || '',
      });
    }
  };

  useEffect(() => { fetchBrand(); }, [id]);

  const handleInputChange = (field) => (event) => setEditValues((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSave = async (event) => {
    event.preventDefault();
    const themeObj = {};
    if (editValues.primaryColor?.trim()) themeObj.primaryColor = editValues.primaryColor.trim();
    if (editValues.secondaryColor?.trim()) themeObj.secondaryColor = editValues.secondaryColor.trim();
    const payload = { ...editValues, themeConfig: Object.keys(themeObj).length ? themeObj : null, propagate };
    delete payload.primaryColor;
    delete payload.secondaryColor;

    const result = await request({ endpoint: `/hotels/brands/${id}`, method: 'PATCH', data: payload, setLoading, alertSuccess, alertError });
    if (result?.success) {
      setBrand(result.data);
      setIsEditing(false);
    }
  };

  if (!brand) return null;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h4">{brand.name}</Typography>
              <Button variant="contained" color="primary" onClick={() => setIsEditing((prev) => !prev)}>
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
            </Box>

            {isEditing ? (
              <Box component="form" onSubmit={handleSave} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Grid container spacing={2}>
                  <MapComponent Component={HoursEditField} data={hoursFieldConfigs} editValues={editValues} handleInputChange={handleInputChange} showNoDataAvailable={false} isLoading={loading} />
                </Grid>

                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>LLM Instructions</Typography>
                  <TextField fullWidth multiline minRows={4} label="Brand-level LLM instructions"
                    value={editValues.llmInstructions || ''} onChange={handleInputChange('llmInstructions')}
                    placeholder="e.g. All Radisson properties offer complimentary breakfast. Emphasize loyalty program." />
                </Box>

                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>Theme Colors</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Primary color" value={editValues.primaryColor || ''} onChange={handleInputChange('primaryColor')} placeholder="#D4AF37"
                        InputProps={{ endAdornment: <input type="color" value={editValues.primaryColor || '#D4AF37'} onChange={(e) => handleInputChange('primaryColor')({ target: { value: e.target.value } })} style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} /> }}
                        InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Secondary color" value={editValues.secondaryColor || ''} onChange={handleInputChange('secondaryColor')} placeholder="#C5A022"
                        InputProps={{ endAdornment: <input type="color" value={editValues.secondaryColor || '#C5A022'} onChange={(e) => handleInputChange('secondaryColor')({ target: { value: e.target.value } })} style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} /> }}
                        InputLabelProps={{ shrink: true }} />
                    </Grid>
                  </Grid>
                </Box>

                <FormControlLabel
                  control={<Checkbox checked={propagate} onChange={(e) => setPropagate(e.target.checked)} color="primary" />}
                  label={`Apply to all ${brand.name} properties (${brand.hotels?.length ?? 0} hotels)`}
                />

                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="submit" variant="contained" color="primary">Save Changes</Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {hoursFieldConfigs.map(({ key, label }) => brand[key] ? (
                  <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{brand[key]}</Typography>
                  </Box>
                ) : null)}
              </Box>
            )}

            {(brand.hotels?.length > 0) && (
              <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Properties ({brand.hotels.length})</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {brand.hotels.map((h) => (
                    <Box key={h.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{h.name}</Typography>
                        <Typography variant="caption" sx={{ color: MUTED }}>{h.address}</Typography>
                      </Box>
                      <Button size="small" onClick={() => navigate(`/hotels/${h.id}`)}>View</Button>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      </MotionBox>
    </Container>
  );
}

export default BrandDetails;
