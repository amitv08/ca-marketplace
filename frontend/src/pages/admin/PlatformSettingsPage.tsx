import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Alert,
  Snackbar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  InputAdornment,
  Card,
  CardContent,
  CardHeader,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8081/api';

interface PlatformConfig {
  id: string;
  individualPlatformFeePercent: number;
  firmPlatformFeePercent: number;
  enabledServiceTypes: string[];
  autoVerifyCAAfterDays: number;
  requireDocumentUpload: boolean;
  minimumExperienceYears: number;
  requirePhoneVerification: boolean;
  requireEmailVerification: boolean;
  escrowAutoReleaseDays: number;
  allowInstantPayments: boolean;
  minimumPaymentAmount: number;
  maximumPaymentAmount: number | null;
  allowClientRefunds: boolean;
  refundProcessingDays: number;
  partialRefundMinPercent: number;
  partialRefundMaxPercent: number;
  disputeAutoCloseDays: number;
  requireDisputeEvidence: boolean;
  allowCAResponse: boolean;
  maxActiveRequestsPerClient: number;
  maxActiveRequestsPerCA: number;
  requestCancellationHours: number;
  isMaintenanceMode: boolean;
  maintenanceMessage: string | null;
}

const SERVICE_TYPES = [
  { value: 'GST_FILING', label: 'GST Filing' },
  { value: 'INCOME_TAX_RETURN', label: 'Income Tax Return' },
  { value: 'AUDIT', label: 'Audit' },
  { value: 'ACCOUNTING', label: 'Accounting' },
  { value: 'TAX_PLANNING', label: 'Tax Planning' },
  { value: 'FINANCIAL_CONSULTING', label: 'Financial Consulting' },
  { value: 'COMPANY_REGISTRATION', label: 'Company Registration' },
  { value: 'OTHER', label: 'Other' },
];

const PlatformSettingsPage: React.FC = () => {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/platform-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConfig(response.data.data);
      setOriginalConfig(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/admin/platform-settings`, config, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess('Platform settings updated successfully');
      loadConfig(); // Reload to get updated data
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update platform settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (originalConfig) {
      setConfig({ ...originalConfig });
    }
  };

  const handleChange = (field: keyof PlatformConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (loading) {
    return (
      <Container>
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography>Loading platform settings...</Typography>
        </Box>
      </Container>
    );
  }

  if (!config) {
    return (
      <Container>
        <Box sx={{ mt: 4 }}>
          <Alert severity="error">Failed to load platform settings</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <SettingsIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            Platform Settings
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Live Preview Section */}
        <Box sx={{ mb: 3 }}>
          <Card sx={{ bgcolor: 'info.light', borderLeft: '4px solid', borderColor: 'info.main' }}>
            <CardHeader
              title="Live Fee Preview"
              titleTypographyProps={{ variant: 'h6' }}
            />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Preview how platform fees will be calculated with current settings:
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      Individual CA Example
                    </Typography>
                    <Typography variant="body2">
                      Service Amount: ₹10,000
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 1 }}>
                      Platform Fee ({config.individualPlatformFeePercent}%): ₹{(10000 * config.individualPlatformFeePercent / 100).toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
                      CA Receives: ₹{(10000 * (100 - config.individualPlatformFeePercent) / 100).toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                      CA Firm Example
                    </Typography>
                    <Typography variant="body2">
                      Service Amount: ₹10,000
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 1 }}>
                      Platform Fee ({config.firmPlatformFeePercent}%): ₹{(10000 * config.firmPlatformFeePercent / 100).toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
                      Firm Receives: ₹{(10000 * (100 - config.firmPlatformFeePercent) / 100).toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="caption">
                  Difference: Firms pay {(config.firmPlatformFeePercent - config.individualPlatformFeePercent).toFixed(1)}% more in platform fees compared to individual CAs
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Box>

        <Grid container spacing={3}>
          {/* Platform Fees */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Platform Fees" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Individual CA Platform Fee"
                      type="number"
                      value={config.individualPlatformFeePercent}
                      onChange={e => handleChange('individualPlatformFeePercent', parseFloat(e.target.value))}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      helperText="Fee charged to individual CAs"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Firm Platform Fee"
                      type="number"
                      value={config.firmPlatformFeePercent}
                      onChange={e => handleChange('firmPlatformFeePercent', parseFloat(e.target.value))}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      helperText="Fee charged to CA firms"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Service Types */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Enabled Service Types" />
              <CardContent>
                <FormControl fullWidth>
                  <InputLabel>Service Types</InputLabel>
                  <Select
                    multiple
                    value={config.enabledServiceTypes}
                    onChange={e => handleChange('enabledServiceTypes', e.target.value)}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={SERVICE_TYPES.find(st => st.value === value)?.label || value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {SERVICE_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </CardContent>
            </Card>
          </Grid>

          {/* Verification Rules */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="CA Verification Rules" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Auto-Verify After Days"
                      type="number"
                      value={config.autoVerifyCAAfterDays}
                      onChange={e => handleChange('autoVerifyCAAfterDays', parseInt(e.target.value))}
                      helperText="0 = disabled"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Minimum Experience Years"
                      type="number"
                      value={config.minimumExperienceYears}
                      onChange={e => handleChange('minimumExperienceYears', parseInt(e.target.value))}
                      helperText="Minimum years required to register"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.requireDocumentUpload}
                          onChange={e => handleChange('requireDocumentUpload', e.target.checked)}
                        />
                      }
                      label="Require Document Upload"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.requirePhoneVerification}
                          onChange={e => handleChange('requirePhoneVerification', e.target.checked)}
                        />
                      }
                      label="Require Phone Verification"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.requireEmailVerification}
                          onChange={e => handleChange('requireEmailVerification', e.target.checked)}
                        />
                      }
                      label="Require Email Verification"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Payment & Escrow Settings */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Payment & Escrow Settings" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Escrow Auto-Release Days"
                      type="number"
                      value={config.escrowAutoReleaseDays}
                      onChange={e => handleChange('escrowAutoReleaseDays', parseInt(e.target.value))}
                      helperText="Days after completion to auto-release"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.allowInstantPayments}
                          onChange={e => handleChange('allowInstantPayments', e.target.checked)}
                        />
                      }
                      label="Allow Instant Payments (No Escrow)"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Minimum Payment Amount"
                      type="number"
                      value={config.minimumPaymentAmount}
                      onChange={e => handleChange('minimumPaymentAmount', parseFloat(e.target.value))}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Maximum Payment Amount"
                      type="number"
                      value={config.maximumPaymentAmount || ''}
                      onChange={e => handleChange('maximumPaymentAmount', e.target.value ? parseFloat(e.target.value) : null)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      }}
                      helperText="Leave empty for no limit"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Refund & Dispute Settings */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Refund & Dispute Settings" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.allowClientRefunds}
                          onChange={e => handleChange('allowClientRefunds', e.target.checked)}
                        />
                      }
                      label="Allow Client Refunds"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Refund Processing Days"
                      type="number"
                      value={config.refundProcessingDays}
                      onChange={e => handleChange('refundProcessingDays', parseInt(e.target.value))}
                      helperText="Business days to process refunds"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Partial Refund Min %"
                      type="number"
                      value={config.partialRefundMinPercent}
                      onChange={e => handleChange('partialRefundMinPercent', parseFloat(e.target.value))}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Partial Refund Max %"
                      type="number"
                      value={config.partialRefundMaxPercent}
                      onChange={e => handleChange('partialRefundMaxPercent', parseFloat(e.target.value))}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Dispute Auto-Close Days"
                      type="number"
                      value={config.disputeAutoCloseDays}
                      onChange={e => handleChange('disputeAutoCloseDays', parseInt(e.target.value))}
                      helperText="Auto-close unresolved disputes"
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.requireDisputeEvidence}
                          onChange={e => handleChange('requireDisputeEvidence', e.target.checked)}
                        />
                      }
                      label="Require Evidence"
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.allowCAResponse}
                          onChange={e => handleChange('allowCAResponse', e.target.checked)}
                        />
                      }
                      label="Allow CA Response"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Business Rules */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Business Rules" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Max Requests Per Client"
                      type="number"
                      value={config.maxActiveRequestsPerClient}
                      onChange={e => handleChange('maxActiveRequestsPerClient', parseInt(e.target.value))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Max Requests Per CA"
                      type="number"
                      value={config.maxActiveRequestsPerCA}
                      onChange={e => handleChange('maxActiveRequestsPerCA', parseInt(e.target.value))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Cancellation Hours"
                      type="number"
                      value={config.requestCancellationHours}
                      onChange={e => handleChange('requestCancellationHours', parseInt(e.target.value))}
                      helperText="Hours before start to cancel"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Maintenance Mode */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Maintenance Mode" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.isMaintenanceMode}
                          onChange={e => handleChange('isMaintenanceMode', e.target.checked)}
                        />
                      }
                      label="Enable Maintenance Mode"
                    />
                  </Grid>
                  {config.isMaintenanceMode && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Maintenance Message"
                        multiline
                        rows={3}
                        value={config.maintenanceMessage || ''}
                        onChange={e => handleChange('maintenanceMessage', e.target.value)}
                        helperText="Message shown to users during maintenance"
                      />
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Action Buttons */}
        <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<RestoreIcon />}
            onClick={handleReset}
            disabled={saving}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Paper>

      {/* Snackbar for success/error messages */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PlatformSettingsPage;
