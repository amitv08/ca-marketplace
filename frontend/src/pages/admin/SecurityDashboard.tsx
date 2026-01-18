import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { securityService, SecurityFinding, DashboardSummary } from '../../services';
import { Card, Button, Loading } from '../../components/common';

const SecurityDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [scanning, setScanning] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await securityService.getDashboard();
      if (response.success) {
        setDashboard(response.data);
      }
    } catch (error) {
      console.error('Error fetching security dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerScan = async (scanType: string) => {
    try {
      setScanning({ ...scanning, [scanType]: true });

      let response;
      switch (scanType) {
        case 'headers':
          response = await securityService.triggerHeadersScan();
          break;
        case 'vulnerabilities':
          response = await securityService.triggerVulnerabilityScan();
          break;
        case 'penetration':
          response = await securityService.triggerPenetrationTest();
          break;
        case 'access-control':
          response = await securityService.triggerAccessControlTest();
          break;
        case 'full':
          response = await securityService.triggerFullAudit();
          break;
        default:
          return;
      }

      if (response.success) {
        alert(response.data.message);
        // Refresh dashboard
        await fetchDashboardData();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to trigger scan';
      alert(errorMessage);
    } finally {
      setScanning({ ...scanning, [scanType]: false });
    }
  };

  const getSecurityScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getSeverityBadgeClass = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getScanTypeLabel = (scanType: string): string => {
    const labels: { [key: string]: string } = {
      SECURITY_HEADERS: 'Security Headers',
      VULNERABILITY_SCAN: 'Vulnerability Scan',
      PENETRATION_TEST: 'Penetration Test',
      ACCESS_CONTROL_TEST: 'Access Control Test',
    };
    return labels[scanType] || scanType;
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600">Unable to load security dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Security Dashboard</h1>
        <p className="text-gray-600">Monitor and manage application security</p>
      </div>

      {/* Security Score Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="text-center">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Security Score</h3>
          <p className={`text-4xl font-bold ${getSecurityScoreColor(dashboard.securityScore)}`}>
            {dashboard.securityScore}
          </p>
          <p className="text-xs text-gray-500 mt-2">out of 100</p>
        </Card>

        <Card className="text-center">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Scans</h3>
          <p className="text-4xl font-bold text-blue-600">{dashboard.totalScans}</p>
          <p className="text-xs text-gray-500 mt-2">all time</p>
        </Card>

        <Card className="text-center">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Failed Scans</h3>
          <p className="text-4xl font-bold text-red-600">{dashboard.failedScans}</p>
          <p className="text-xs text-gray-500 mt-2">require attention</p>
        </Card>

        <Card className="text-center">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Scans (7 days)</h3>
          <p className="text-4xl font-bold text-purple-600">{dashboard.scansLast7Days}</p>
          <p className="text-xs text-gray-500 mt-2">recent activity</p>
        </Card>
      </div>

      {/* Vulnerability Summary */}
      {dashboard.latestSummary && (
        <Card className="mb-8">
          <h2 className="text-xl font-bold mb-4">Vulnerability Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-700">{dashboard.latestSummary.total}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{dashboard.latestSummary.critical}</p>
              <p className="text-sm text-red-600">Critical</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{dashboard.latestSummary.high}</p>
              <p className="text-sm text-orange-600">High</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{dashboard.latestSummary.medium}</p>
              <p className="text-sm text-yellow-600">Medium</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{dashboard.latestSummary.low}</p>
              <p className="text-sm text-blue-600">Low</p>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Scan Buttons */}
      <Card className="mb-8">
        <h2 className="text-xl font-bold mb-4">Run Security Scans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={() => triggerScan('headers')}
            disabled={scanning.headers}
            className="w-full"
          >
            {scanning.headers ? 'Scanning...' : 'Security Headers'}
          </Button>
          <Button
            onClick={() => triggerScan('vulnerabilities')}
            disabled={scanning.vulnerabilities}
            className="w-full"
          >
            {scanning.vulnerabilities ? 'Scanning...' : 'Vulnerabilities'}
          </Button>
          <Button
            onClick={() => triggerScan('penetration')}
            disabled={scanning.penetration}
            className="w-full"
          >
            {scanning.penetration ? 'Testing...' : 'Penetration Test'}
          </Button>
          <Button
            onClick={() => triggerScan('access-control')}
            disabled={scanning['access-control']}
            className="w-full"
          >
            {scanning['access-control'] ? 'Testing...' : 'Access Control'}
          </Button>
          <Button
            onClick={() => triggerScan('full')}
            disabled={scanning.full}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {scanning.full ? 'Running...' : 'Full Security Audit'}
          </Button>
          <Button
            onClick={() => navigate('/admin/security/scans')}
            variant="outline"
            className="w-full"
          >
            View All Scans
          </Button>
        </div>
      </Card>

      {/* Critical Findings */}
      {dashboard.criticalFindings && dashboard.criticalFindings.length > 0 && (
        <Card className="mb-8">
          <h2 className="text-xl font-bold mb-4">Critical Findings</h2>
          <div className="space-y-3">
            {dashboard.criticalFindings.map((finding, index) => (
              <div key={index} className="border-l-4 border-red-500 pl-4 py-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityBadgeClass(finding.severity)}`}>
                        {finding.severity.toUpperCase()}
                      </span>
                      <h3 className="font-semibold">{finding.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{finding.description}</p>
                    <p className="text-xs text-gray-500">Component: {finding.affectedComponent}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Scans */}
      <Card>
        <h2 className="text-xl font-bold mb-4">Recent Scans</h2>
        {dashboard.recentScans && dashboard.recentScans.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scan Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Findings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dashboard.recentScans.map((scan) => (
                  <tr key={scan.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {getScanTypeLabel(scan.scanType)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(scan.status)}`}>
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {scan.findingsCount} issue{scan.findingsCount !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(scan.startedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => navigate(`/admin/security/scans/${scan.id}`)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600">No scans available</p>
        )}
      </Card>

      {/* Last Scan Date */}
      {dashboard.lastScanDate && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Last scan: {new Date(dashboard.lastScanDate).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default SecurityDashboard;
