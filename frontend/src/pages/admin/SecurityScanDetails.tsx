import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { securityService, SecurityScan } from '../../services';
import { Card, Button, Loading } from '../../components/common';

const SecurityScanDetails: React.FC = () => {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scan, setScan] = useState<SecurityScan | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (scanId) {
      fetchScanDetails();
    }
  }, [scanId]);

  const fetchScanDetails = async () => {
    try {
      setLoading(true);
      const response = await securityService.getScanDetails(scanId!);
      if (response.success) {
        setScan(response.data);
      }
    } catch (error) {
      console.error('Error fetching scan details:', error);
      alert('Failed to load scan details');
      navigate('/admin/security');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadgeClass = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const exportAsJSON = () => {
    if (!scan) return;

    const dataStr = JSON.stringify(scan, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `security-scan-${scan.id}-${new Date().toISOString()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const filteredFindings = scan?.findings.filter((finding) => {
    if (filter === 'all') return true;
    return finding.severity === filter;
  }) || [];

  if (loading) {
    return <Loading />;
  }

  if (!scan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600">Scan not found</p>
          <Button onClick={() => navigate('/admin/security')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button onClick={() => navigate('/admin/security')} variant="outline" className="mb-4">
          ← Back to Dashboard
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{getScanTypeLabel(scan.scanType)}</h1>
            <p className="text-gray-600">Scan ID: {scan.id}</p>
          </div>
          <span className={`px-4 py-2 rounded-lg text-sm font-medium ${getStatusBadgeClass(scan.status)}`}>
            {scan.status}
          </span>
        </div>
      </div>

      {/* Scan Metadata */}
      <Card className="mb-8">
        <h2 className="text-xl font-bold mb-4">Scan Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Started At</p>
            <p className="font-medium">{new Date(scan.startedAt).toLocaleString()}</p>
          </div>
          {scan.completedAt && (
            <div>
              <p className="text-sm text-gray-600">Completed At</p>
              <p className="font-medium">{new Date(scan.completedAt).toLocaleString()}</p>
            </div>
          )}
          {scan.duration && (
            <div>
              <p className="text-sm text-gray-600">Duration</p>
              <p className="font-medium">{(scan.duration / 1000).toFixed(2)}s</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Environment</p>
            <p className="font-medium capitalize">{scan.environment}</p>
          </div>
          {scan.triggeredBy && (
            <div>
              <p className="text-sm text-gray-600">Triggered By</p>
              <p className="font-medium">{scan.triggeredBy}</p>
            </div>
          )}
        </div>
        {scan.errorMessage && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-800">Error:</p>
            <p className="text-sm text-red-600">{scan.errorMessage}</p>
          </div>
        )}
      </Card>

      {/* Summary Statistics */}
      <Card className="mb-8">
        <h2 className="text-xl font-bold mb-4">Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-700">{scan.summary.total}</p>
            <p className="text-sm text-gray-600">Total Findings</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-3xl font-bold text-red-600">{scan.summary.critical}</p>
            <p className="text-sm text-red-600">Critical</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-3xl font-bold text-orange-600">{scan.summary.high}</p>
            <p className="text-sm text-orange-600">High</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-3xl font-bold text-yellow-600">{scan.summary.medium}</p>
            <p className="text-sm text-yellow-600">Medium</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{scan.summary.low}</p>
            <p className="text-sm text-blue-600">Low</p>
          </div>
        </div>
      </Card>

      {/* Findings */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Findings ({filteredFindings.length})</h2>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <Button onClick={exportAsJSON} variant="outline" className="text-sm">
              Export JSON
            </Button>
          </div>
        </div>

        {filteredFindings.length > 0 ? (
          <div className="space-y-4">
            {filteredFindings.map((finding, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityBadgeClass(finding.severity)}`}>
                      {finding.severity.toUpperCase()}
                    </span>
                    <h3 className="font-semibold text-lg">{finding.title}</h3>
                  </div>
                  {(finding.cve || finding.cwe) && (
                    <div className="flex gap-2">
                      {finding.cve && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          {finding.cve}
                        </span>
                      )}
                      {finding.cwe && (
                        <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                          {finding.cwe}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Description:</p>
                    <p className="text-sm text-gray-600">{finding.description}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Affected Component:</p>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{finding.affectedComponent}</code>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Recommendation:</p>
                    <p className="text-sm text-gray-600">{finding.recommendation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600">
              {filter === 'all' ? 'No findings detected' : `No ${filter} severity findings`}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SecurityScanDetails;
