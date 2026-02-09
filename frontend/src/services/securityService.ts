import api from './api';

export interface SecurityScanSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface SecurityFinding {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedComponent: string;
  recommendation: string;
  cve?: string;
  cwe?: string;
}

export interface SecurityScan {
  id: string;
  scanType: 'SECURITY_HEADERS' | 'VULNERABILITY_SCAN' | 'PENETRATION_TEST' | 'ACCESS_CONTROL_TEST';
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  findings: SecurityFinding[];
  summary: SecurityScanSummary;
  startedAt: string;
  completedAt?: string;
  triggeredBy?: string;
  environment: string;
  duration?: number;
  errorMessage?: string;
}

export interface DashboardSummary {
  securityScore: number;
  lastScanDate?: string;
  totalScans: number;
  failedScans: number;
  scansLast7Days: number;
  latestSummary?: SecurityScanSummary;
  criticalFindings: SecurityFinding[];
  recentScans: Array<{
    id: string;
    scanType: string;
    status: string;
    startedAt: string;
    findingsCount: number;
  }>;
}

export interface SecurityStats {
  scans: {
    total: number;
    completed: number;
    failed: number;
    running: number;
  };
  scansByType: Array<{
    type: string;
    count: number;
  }>;
  recentFindings: SecurityScanSummary;
}

export interface CspViolation {
  id: string;
  documentUri: string;
  violatedDirective: string;
  blockedUri: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  userAgent?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const securityService = {
  // Get security dashboard summary
  getDashboard: async () => {
    const response = await api.get<{ success: boolean; data: DashboardSummary }>('/admin/security/dashboard');
    return response.data;
  },

  // Get all scans with pagination
  getScans: async (params?: { page?: number; limit?: number; scanType?: string; status?: string }) => {
    const response = await api.get<{ success: boolean; data: PaginatedResponse<SecurityScan> }>('/admin/security/scans', { params });
    return response.data;
  },

  // Get specific scan details
  getScanDetails: async (scanId: string) => {
    const response = await api.get<{ success: boolean; data: SecurityScan }>(`/admin/security/scans/${scanId}`);
    return response.data;
  },

  // Delete a scan
  deleteScan: async (scanId: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/admin/security/scans/${scanId}`);
    return response.data;
  },

  // Trigger security headers scan
  triggerHeadersScan: async () => {
    const response = await api.post<{
      success: boolean;
      data: {
        scanId: string;
        status: string;
        message: string;
        findings: SecurityFinding[];
        summary: SecurityScanSummary;
      };
    }>('/admin/security/scan/headers');
    return response.data;
  },

  // Trigger vulnerability scan
  triggerVulnerabilityScan: async () => {
    const response = await api.post<{
      success: boolean;
      data: {
        scanId: string;
        status: string;
        message: string;
        findings: SecurityFinding[];
        summary: SecurityScanSummary;
      };
    }>('/admin/security/scan/vulnerabilities');
    return response.data;
  },

  // Trigger penetration test
  triggerPenetrationTest: async () => {
    const response = await api.post<{
      success: boolean;
      data: {
        scanId: string;
        status: string;
        message: string;
        findings: SecurityFinding[];
        summary: SecurityScanSummary;
      };
    }>('/admin/security/scan/penetration');
    return response.data;
  },

  // Trigger access control test
  triggerAccessControlTest: async () => {
    const response = await api.post<{
      success: boolean;
      data: {
        scanId: string;
        status: string;
        message: string;
        findings: SecurityFinding[];
        summary: SecurityScanSummary;
      };
    }>('/admin/security/scan/access-control');
    return response.data;
  },

  // Trigger full security audit
  triggerFullAudit: async () => {
    const response = await api.post<{
      success: boolean;
      data: {
        scanId: string;
        status: string;
        message: string;
      };
    }>('/admin/security/scan/full');
    return response.data;
  },

  // Get security statistics
  getStats: async () => {
    const response = await api.get<{ success: boolean; data: SecurityStats }>('/admin/security/stats');
    return response.data;
  },

  // Get recent critical findings
  getRecentFindings: async (params?: { severity?: string; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: SecurityFinding[] }>('/admin/security/recent-findings', { params });
    return response.data;
  },

  // Get CSP violations
  getCspViolations: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get<{ success: boolean; data: PaginatedResponse<CspViolation> }>('/admin/security/csp-violations', { params });
    return response.data;
  },
};

export default securityService;
