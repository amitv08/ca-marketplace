import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tabs,
  Tab,
  Badge,
  Stack,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  TrendingUp as EscalateIcon,
  Check as CheckIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8081/api';

interface Dispute {
  id: string;
  requestId: string;
  status: string;
  reason: string;
  amount: number;
  priority: number;
  raisedAt: string;
  resolvedAt?: string;
  resolution?: string;
  resolutionNotes?: string;
  refundAmount?: number;
  requiresAction: boolean;
  isEscalated: boolean;
  client: {
    user: {
      name: string;
      email: string;
    };
  };
  ca?: {
    user: {
      name: string;
      email: string;
    };
  };
  firm?: {
    id: string;
    firmName: string;
  };
  request: {
    id: string;
    serviceType: string;
    status: string;
  };
  clientEvidence?: any[];
  caEvidence?: any[];
  adminNotes?: Array<{
    note: string;
    adminId: string;
    createdAt: string;
  }>;
}

const DisputesPage: React.FC = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundPercentage, setRefundPercentage] = useState(50);
  const [adminNote, setAdminNote] = useState('');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDisputes();
  }, [page, rowsPerPage, statusFilter]);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/disputes`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          page: page + 1,
          limit: rowsPerPage,
        },
      });
      setDisputes(response.data.data.items || []);
      setTotal(response.data.data.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (disputeId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/disputes/${disputeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedDispute(response.data.data);
      setDetailsOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dispute details');
    }
  };

  const handleResolve = async () => {
    if (!selectedDispute || !resolution || !resolutionNotes) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/admin/disputes/${selectedDispute.id}/resolve`,
        {
          resolution,
          resolutionNotes,
          refundPercentage: resolution === 'PARTIAL_REFUND' ? refundPercentage : undefined,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setResolveOpen(false);
      setDetailsOpen(false);
      setResolution('');
      setResolutionNotes('');
      loadDisputes();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resolve dispute');
    }
  };

  const handleEscalate = async (disputeId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/admin/disputes/${disputeId}/escalate`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      loadDisputes();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to escalate dispute');
    }
  };

  const handleAddNote = async () => {
    if (!selectedDispute || !adminNote) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/admin/disputes/${selectedDispute.id}/notes`,
        { note: adminNote },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setAdminNote('');
      handleViewDetails(selectedDispute.id); // Reload details
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add note');
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 4: return 'error';
      case 3: return 'warning';
      case 2: return 'info';
      default: return 'default';
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 4: return 'URGENT';
      case 3: return 'HIGH';
      case 2: return 'MEDIUM';
      default: return 'LOW';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'error';
      case 'UNDER_REVIEW': return 'warning';
      case 'RESOLVED': return 'success';
      case 'CLOSED': return 'default';
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center">
            <GavelIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
            <Typography variant="h4" component="h1">
              Dispute Management
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Status Filter Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={statusFilter} onChange={(_, newValue) => setStatusFilter(newValue)}>
            <Tab label="Open" value="OPEN" />
            <Tab label="Under Review" value="UNDER_REVIEW" />
            <Tab label="Resolved" value="RESOLVED" />
            <Tab label="Closed" value="CLOSED" />
            <Tab label="All" value="ALL" />
          </Tabs>
        </Box>

        {/* Disputes Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Request ID</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>CA/Firm</TableCell>
                <TableCell>Service Type</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Raised</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    Loading disputes...
                  </TableCell>
                </TableRow>
              ) : disputes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    No disputes found
                  </TableCell>
                </TableRow>
              ) : (
                disputes.map((dispute) => (
                  <TableRow key={dispute.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {dispute.requestId.substring(0, 8)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{dispute.client.user.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dispute.client.user.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {dispute.firm ? (
                        <Typography variant="body2">{dispute.firm.firmName}</Typography>
                      ) : dispute.ca ? (
                        <>
                          <Typography variant="body2">{dispute.ca.user.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {dispute.ca.user.email}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          N/A
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={dispute.request.serviceType.replace(/_/g, ' ')}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>₹{dispute.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge
                        badgeContent={dispute.isEscalated ? '!' : 0}
                        color="error"
                      >
                        <Chip
                          label={getPriorityLabel(dispute.priority)}
                          color={getPriorityColor(dispute.priority)}
                          size="small"
                        />
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={dispute.status.replace(/_/g, ' ')}
                        color={getStatusColor(dispute.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {format(new Date(dispute.raisedAt), 'MMM dd, yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleViewDetails(dispute.id)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        {dispute.status === 'OPEN' && !dispute.isEscalated && (
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleEscalate(dispute.id)}
                          >
                            <EscalateIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Dispute Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Dispute Details</Typography>
            <IconButton onClick={() => setDetailsOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedDispute && (
            <Grid container spacing={3}>
              {/* Basic Info */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Basic Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Chip
                          label={selectedDispute.status}
                          color={getStatusColor(selectedDispute.status)}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Priority
                        </Typography>
                        <Chip
                          label={getPriorityLabel(selectedDispute.priority)}
                          color={getPriorityColor(selectedDispute.priority)}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          Reason
                        </Typography>
                        <Typography variant="body1">{selectedDispute.reason}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Amount
                        </Typography>
                        <Typography variant="body1">₹{selectedDispute.amount.toLocaleString()}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Raised On
                        </Typography>
                        <Typography variant="body1">
                          {format(new Date(selectedDispute.raisedAt), 'PPP')}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Evidence */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Client Evidence
                    </Typography>
                    {selectedDispute.clientEvidence && selectedDispute.clientEvidence.length > 0 ? (
                      selectedDispute.clientEvidence.map((ev: any, idx: number) => (
                        <Box key={idx} sx={{ mb: 1 }}>
                          <Chip
                            icon={<AttachFileIcon />}
                            label={ev.type || 'Document'}
                            size="small"
                            variant="outlined"
                          />
                          <Typography variant="caption" display="block">
                            {ev.description}
                          </Typography>
                        </Box>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No evidence provided
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      CA Evidence
                    </Typography>
                    {selectedDispute.caEvidence && selectedDispute.caEvidence.length > 0 ? (
                      selectedDispute.caEvidence.map((ev: any, idx: number) => (
                        <Box key={idx} sx={{ mb: 1 }}>
                          <Chip
                            icon={<AttachFileIcon />}
                            label={ev.type || 'Document'}
                            size="small"
                            variant="outlined"
                          />
                          <Typography variant="caption" display="block">
                            {ev.description}
                          </Typography>
                        </Box>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No evidence provided
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Admin Notes */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Admin Notes
                    </Typography>
                    {selectedDispute.adminNotes && selectedDispute.adminNotes.length > 0 ? (
                      selectedDispute.adminNotes.map((note, idx) => (
                        <Box key={idx} sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                          <Typography variant="body2">{note.note}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {format(new Date(note.createdAt), 'PPP p')}
                          </Typography>
                        </Box>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No admin notes
                      </Typography>
                    )}

                    <Divider sx={{ my: 2 }} />

                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      placeholder="Add admin note..."
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      sx={{ mb: 1 }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleAddNote}
                      disabled={!adminNote}
                    >
                      Add Note
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              {/* Resolution */}
              {selectedDispute.resolution && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Resolution
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">
                            Resolution Type
                          </Typography>
                          <Chip label={selectedDispute.resolution} color="success" size="small" />
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">
                            Notes
                          </Typography>
                          <Typography variant="body1">{selectedDispute.resolutionNotes}</Typography>
                        </Grid>
                        {selectedDispute.refundAmount && (
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">
                              Refund Amount
                            </Typography>
                            <Typography variant="body1">
                              ₹{selectedDispute.refundAmount.toLocaleString()}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          {selectedDispute && selectedDispute.status !== 'RESOLVED' && selectedDispute.status !== 'CLOSED' && (
            <Button
              variant="contained"
              startIcon={<CheckIcon />}
              onClick={() => setResolveOpen(true)}
            >
              Resolve Dispute
            </Button>
          )}
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Resolve Dispute Dialog */}
      <Dialog open={resolveOpen} onClose={() => setResolveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Resolve Dispute</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Resolution</InputLabel>
                <Select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  label="Resolution"
                >
                  <MenuItem value="FULL_REFUND">Full Refund</MenuItem>
                  <MenuItem value="PARTIAL_REFUND">Partial Refund</MenuItem>
                  <MenuItem value="NO_REFUND">No Refund</MenuItem>
                  <MenuItem value="RELEASE_TO_CA">Release to CA</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {resolution === 'PARTIAL_REFUND' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="number"
                  label="Refund Percentage"
                  value={refundPercentage}
                  onChange={(e) => setRefundPercentage(parseInt(e.target.value))}
                  InputProps={{
                    endAdornment: <Typography>%</Typography>,
                  }}
                  helperText="Enter refund percentage (0-100)"
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Resolution Notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                helperText="Explain the reasoning for this resolution"
                required
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleResolve}
            disabled={!resolution || !resolutionNotes}
          >
            Confirm Resolution
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DisputesPage;
