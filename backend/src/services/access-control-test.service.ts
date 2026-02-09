import axios from 'axios';
import { SecurityScanType, ScanStatus } from '@prisma/client';
import { SecurityFinding, SecurityScanResult, SecuritySummary } from './security-audit.service';
import { env } from '../config/env';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export interface AccessControlTestResult {
  testName: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  endpoint?: string;
  expectedStatus: number;
  actualStatus?: number;
}

/**
 * Access Control Test Service
 * Tests RBAC (Role-Based Access Control) and privilege escalation
 */
export class AccessControlTestService {
  private static baseUrl: string;

  /**
   * Initialize base URL
   */
  private static getBaseUrl(): string {
    if (!this.baseUrl) {
      this.baseUrl = env.NODE_ENV === 'production'
        ? env.APP_URL || 'http://localhost:5000'
        : 'http://localhost:5000';
    }
    return this.baseUrl;
  }

  /**
   * Generate test token for a specific role
   */
  private static generateTestToken(userId: string, role: 'CLIENT' | 'CA' | 'ADMIN' | 'SUPER_ADMIN'): string {
    const jwtSecret = env.JWT_SECRET || 'your_jwt_secret_key_here';

    return jwt.sign(
      {
        userId,
        role,
        email: `test-${role.toLowerCase()}@test.com`,
      },
      jwtSecret,
      { expiresIn: '1h' }
    );
  }

  /**
   * Run all access control tests
   */
  static async runAllTests(): Promise<SecurityScanResult> {
    const startTime = Date.now();
    const startedAt = new Date();

    try {
      // Run all test types
      const [
        privilegeEscalationResults,
        horizontalPrivilegeResults,
        adminEndpointResults,
        roleBoundaryResults,
      ] = await Promise.allSettled([
        this.testPrivilegeEscalation(),
        this.testHorizontalPrivileges(),
        this.testAdminEndpoints(),
        this.testRoleBoundaries(),
      ]);

      // Collect all findings
      const findings: SecurityFinding[] = [];

      // Process privilege escalation results
      if (privilegeEscalationResults.status === 'fulfilled') {
        privilegeEscalationResults.value.forEach((result) => {
          if (!result.passed) {
            findings.push({
              title: result.testName,
              severity: result.severity,
              description: result.description,
              affectedComponent: result.endpoint || 'Authorization',
              recommendation: 'Implement proper role-based access control and authorization checks',
              cwe: 'CWE-269',
            });
          }
        });
      }

      // Process horizontal privilege results
      if (horizontalPrivilegeResults.status === 'fulfilled') {
        horizontalPrivilegeResults.value.forEach((result) => {
          if (!result.passed) {
            findings.push({
              title: result.testName,
              severity: result.severity,
              description: result.description,
              affectedComponent: result.endpoint || 'Authorization',
              recommendation: 'Implement resource ownership validation',
              cwe: 'CWE-639',
            });
          }
        });
      }

      // Process admin endpoint results
      if (adminEndpointResults.status === 'fulfilled') {
        adminEndpointResults.value.forEach((result) => {
          if (!result.passed) {
            findings.push({
              title: result.testName,
              severity: result.severity,
              description: result.description,
              affectedComponent: result.endpoint || 'Admin Routes',
              recommendation: 'Ensure all admin routes require ADMIN or SUPER_ADMIN role',
              cwe: 'CWE-284',
            });
          }
        });
      }

      // Process role boundary results
      if (roleBoundaryResults.status === 'fulfilled') {
        roleBoundaryResults.value.forEach((result) => {
          if (!result.passed) {
            findings.push({
              title: result.testName,
              severity: result.severity,
              description: result.description,
              affectedComponent: result.endpoint || 'Role Authorization',
              recommendation: 'Enforce strict role boundaries between CLIENT and CA roles',
              cwe: 'CWE-284',
            });
          }
        });
      }

      const summary = this.calculateSummary(findings);
      const duration = Date.now() - startTime;

      return {
        scanType: SecurityScanType.ACCESS_CONTROL_TEST,
        status: ScanStatus.COMPLETED,
        findings,
        summary,
        startedAt,
        completedAt: new Date(),
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        scanType: SecurityScanType.ACCESS_CONTROL_TEST,
        status: ScanStatus.FAILED,
        findings: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
        startedAt,
        completedAt: new Date(),
        duration,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Test privilege escalation attempts
   */
  static async testPrivilegeEscalation(): Promise<AccessControlTestResult[]> {
    const baseUrl = this.getBaseUrl();
    const results: AccessControlTestResult[] = [];

    // Generate CLIENT token
    const clientToken = this.generateTestToken('test-client-id', 'CLIENT');

    // Admin endpoints that CLIENT should NOT access
    const adminEndpoints = [
      { method: 'GET', path: '/api/admin/users', name: 'View All Users' },
      { method: 'GET', path: '/api/admin/ca-verification', name: 'CA Verification List' },
      { method: 'POST', path: '/api/admin/payments/release', name: 'Release Payment' },
    ];

    for (const endpoint of adminEndpoints) {
      try {
        const response = await axios({
          method: endpoint.method as any,
          url: `${baseUrl}${endpoint.path}`,
          headers: {
            Authorization: `Bearer ${clientToken}`,
          },
          validateStatus: () => true,
        });

        const passed = response.status === 403;

        results.push({
          testName: `Privilege Escalation - CLIENT accessing ${endpoint.name}`,
          passed,
          severity: 'critical',
          description: passed
            ? `CLIENT properly denied access to ${endpoint.name}`
            : `CLIENT can escalate privileges to access ${endpoint.name}`,
          endpoint: endpoint.path,
          expectedStatus: 403,
          actualStatus: response.status,
        });
      } catch (error: any) {
        results.push({
          testName: `Privilege Escalation - CLIENT accessing ${endpoint.name}`,
          passed: true,
          severity: 'critical',
          description: 'Endpoint properly protected',
          endpoint: endpoint.path,
          expectedStatus: 403,
        });
      }
    }

    return results;
  }

  /**
   * Test horizontal privilege violations (accessing other users' resources)
   */
  static async testHorizontalPrivileges(): Promise<AccessControlTestResult[]> {
    const baseUrl = this.getBaseUrl();
    const results: AccessControlTestResult[] = [];

    try {
      // Get two different users
      const users = await prisma.user.findMany({
        where: { role: 'CLIENT' },
        take: 2,
      });

      if (users.length < 2) {
        results.push({
          testName: 'Horizontal Privilege Test - Insufficient Test Data',
          passed: true,
          severity: 'low',
          description: 'Not enough users to test horizontal privilege violations',
          expectedStatus: 403,
        });
        return results;
      }

      // Generate tokens for both users
      const user1Token = this.generateTestToken(users[0].id, 'CLIENT');
      const user2Token = this.generateTestToken(users[1].id, 'CLIENT');

      // Get user1's service requests
      const user1Requests = await prisma.serviceRequest.findMany({
        where: { clientId: users[0].id },
        take: 1,
      });

      if (user1Requests.length > 0) {
        // Try to access user1's request with user2's token
        try {
          const response = await axios.get(
            `${baseUrl}/api/service-requests/${user1Requests[0].id}`,
            {
              headers: {
                Authorization: `Bearer ${user2Token}`,
              },
              validateStatus: () => true,
            }
          );

          const passed = response.status === 403 || response.status === 404;

          results.push({
            testName: 'Horizontal Privilege - Client accessing another Client\'s request',
            passed,
            severity: 'high',
            description: passed
              ? 'Client properly denied access to another client\'s service request'
              : 'Client can access another client\'s service request (horizontal privilege violation)',
            endpoint: `/api/service-requests/${user1Requests[0].id}`,
            expectedStatus: 403,
            actualStatus: response.status,
          });
        } catch (error: any) {
          results.push({
            testName: 'Horizontal Privilege - Client accessing another Client\'s request',
            passed: true,
            severity: 'high',
            description: 'Resource properly protected',
            expectedStatus: 403,
          });
        }
      }
    } catch (error: any) {
      results.push({
        testName: 'Horizontal Privilege Test - Error',
        passed: false,
        severity: 'medium',
        description: `Error running horizontal privilege test: ${error.message}`,
        expectedStatus: 403,
      });
    }

    return results;
  }

  /**
   * Test admin endpoint protection
   */
  static async testAdminEndpoints(): Promise<AccessControlTestResult[]> {
    const baseUrl = this.getBaseUrl();
    const results: AccessControlTestResult[] = [];

    // Generate CLIENT and CA tokens
    const clientToken = this.generateTestToken('test-client-id', 'CLIENT');
    const caToken = this.generateTestToken('test-ca-id', 'CA');

    // Admin-only endpoints
    const adminEndpoints = [
      '/api/admin/users',
      '/api/admin/dashboard',
      '/api/admin/security/scans',
      '/api/admin/ca-verification',
    ];

    for (const endpoint of adminEndpoints) {
      // Test with CLIENT token
      try {
        const response = await axios.get(`${baseUrl}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${clientToken}`,
          },
          validateStatus: () => true,
        });

        const passed = response.status === 403;

        results.push({
          testName: `Admin Endpoint Protection - CLIENT accessing ${endpoint}`,
          passed,
          severity: 'critical',
          description: passed
            ? `Admin endpoint ${endpoint} properly protected from CLIENT`
            : `CLIENT can access admin endpoint ${endpoint}`,
          endpoint,
          expectedStatus: 403,
          actualStatus: response.status,
        });
      } catch (error: any) {
        results.push({
          testName: `Admin Endpoint Protection - CLIENT accessing ${endpoint}`,
          passed: true,
          severity: 'critical',
          description: 'Admin endpoint properly protected',
          endpoint,
          expectedStatus: 403,
        });
      }

      // Test with CA token
      try {
        const response = await axios.get(`${baseUrl}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${caToken}`,
          },
          validateStatus: () => true,
        });

        const passed = response.status === 403;

        results.push({
          testName: `Admin Endpoint Protection - CA accessing ${endpoint}`,
          passed,
          severity: 'critical',
          description: passed
            ? `Admin endpoint ${endpoint} properly protected from CA`
            : `CA can access admin endpoint ${endpoint}`,
          endpoint,
          expectedStatus: 403,
          actualStatus: response.status,
        });
      } catch (error: any) {
        results.push({
          testName: `Admin Endpoint Protection - CA accessing ${endpoint}`,
          passed: true,
          severity: 'critical',
          description: 'Admin endpoint properly protected',
          endpoint,
          expectedStatus: 403,
        });
      }
    }

    return results;
  }

  /**
   * Test role boundary enforcement
   */
  static async testRoleBoundaries(): Promise<AccessControlTestResult[]> {
    const baseUrl = this.getBaseUrl();
    const results: AccessControlTestResult[] = [];

    // Generate tokens
    const clientToken = this.generateTestToken('test-client-id', 'CLIENT');
    const caToken = this.generateTestToken('test-ca-id', 'CA');

    // CA-only endpoints
    const caEndpoints = [
      { path: '/api/ca/availability', name: 'CA Availability' },
      { path: '/api/ca/profile', name: 'CA Profile' },
    ];

    // Test CLIENT accessing CA endpoints
    for (const endpoint of caEndpoints) {
      try {
        const response = await axios.get(`${baseUrl}${endpoint.path}`, {
          headers: {
            Authorization: `Bearer ${clientToken}`,
          },
          validateStatus: () => true,
        });

        const passed = response.status === 403 || response.status === 404;

        results.push({
          testName: `Role Boundary - CLIENT accessing ${endpoint.name}`,
          passed,
          severity: 'high',
          description: passed
            ? `CLIENT properly denied access to ${endpoint.name}`
            : `CLIENT can access CA-only endpoint ${endpoint.name}`,
          endpoint: endpoint.path,
          expectedStatus: 403,
          actualStatus: response.status,
        });
      } catch (error: any) {
        results.push({
          testName: `Role Boundary - CLIENT accessing ${endpoint.name}`,
          passed: true,
          severity: 'high',
          description: 'CA endpoint properly protected from CLIENT',
          endpoint: endpoint.path,
          expectedStatus: 403,
        });
      }
    }

    // Client-only endpoints (creating service requests)
    try {
      const response = await axios.post(
        `${baseUrl}/api/service-requests`,
        {
          serviceType: 'GST_FILING',
          description: 'Test request',
          caId: 'test-ca-id',
        },
        {
          headers: {
            Authorization: `Bearer ${caToken}`,
          },
          validateStatus: () => true,
        }
      );

      // CAs should not be able to create service requests as clients
      const passed = response.status === 403 || response.status === 400;

      results.push({
        testName: 'Role Boundary - CA creating service request as client',
        passed,
        severity: 'high',
        description: passed
          ? 'CA properly denied from creating service requests'
          : 'CA can create service requests (should be client-only)',
        endpoint: '/api/service-requests',
        expectedStatus: 403,
        actualStatus: response.status,
      });
    } catch (error: any) {
      results.push({
        testName: 'Role Boundary - CA creating service request as client',
        passed: true,
        severity: 'high',
        description: 'Role boundary properly enforced',
        endpoint: '/api/service-requests',
        expectedStatus: 403,
      });
    }

    return results;
  }

  /**
   * Calculate summary from findings
   */
  private static calculateSummary(findings: SecurityFinding[]): SecuritySummary {
    const summary: SecuritySummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: findings.length,
    };

    findings.forEach((finding) => {
      summary[finding.severity]++;
    });

    return summary;
  }
}
