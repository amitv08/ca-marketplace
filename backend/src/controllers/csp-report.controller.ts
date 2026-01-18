import { Request, Response } from 'express';
import { prisma } from '../config/database';

/**
 * CSP Report Controller
 * Handles Content Security Policy violation reports from browsers
 */

/**
 * Handle CSP violation report
 * POST /api/csp-report
 * This endpoint is called by browsers when CSP violations occur
 */
export const handleCspReport = async (req: Request, res: Response): Promise<void> => {
  try {
    // CSP reports come in the format: { "csp-report": { ... } }
    const report = req.body['csp-report'];

    if (!report) {
      res.status(400).json({ error: 'Invalid CSP report format' });
      return;
    }

    // Extract CSP violation details
    const {
      'document-uri': documentUri,
      'violated-directive': violatedDirective,
      'blocked-uri': blockedUri,
      'source-file': sourceFile,
      'line-number': lineNumber,
      'column-number': columnNumber,
    } = report;

    // Get user agent from request headers
    const userAgent = req.headers['user-agent'] || '';

    // Save violation to database
    await prisma.cspViolation.create({
      data: {
        documentUri: documentUri || '',
        violatedDirective: violatedDirective || '',
        blockedUri: blockedUri || '',
        sourceFile: sourceFile || null,
        lineNumber: lineNumber ? parseInt(lineNumber) : null,
        columnNumber: columnNumber ? parseInt(columnNumber) : null,
        userAgent: userAgent.substring(0, 500), // Limit user agent length
      },
    });

    // Log violation for debugging (optional)
    console.log('CSP Violation reported:', {
      documentUri,
      violatedDirective,
      blockedUri,
      sourceFile,
      lineNumber,
      columnNumber,
    });

    // Return 204 No Content as per CSP spec
    res.status(204).send();
  } catch (error) {
    console.error('Error processing CSP report:', error);

    // Still return 204 to avoid browser retries
    res.status(204).send();
  }
};

/**
 * Get CSP violation statistics
 * GET /api/admin/security/csp-stats
 * Admin-only endpoint
 */
export const getCspStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get total violations
    const totalViolations = await prisma.cspViolation.count();

    // Get violations by directive
    const violationsByDirective = await prisma.cspViolation.groupBy({
      by: ['violatedDirective'],
      _count: {
        violatedDirective: true,
      },
      orderBy: {
        _count: {
          violatedDirective: 'desc',
        },
      },
    });

    // Get violations by blocked URI
    const violationsByUri = await prisma.cspViolation.groupBy({
      by: ['blockedUri'],
      _count: {
        blockedUri: true,
      },
      orderBy: {
        _count: {
          blockedUri: 'desc',
        },
      },
      take: 10, // Top 10 blocked URIs
    });

    // Get recent violations
    const recentViolations = await prisma.cspViolation.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: {
        total: totalViolations,
        byDirective: violationsByDirective.map((item) => ({
          directive: item.violatedDirective,
          count: item._count.violatedDirective,
        })),
        byUri: violationsByUri.map((item) => ({
          uri: item.blockedUri,
          count: item._count.blockedUri,
        })),
        recent: recentViolations,
      },
    });
  } catch (error) {
    console.error('Error getting CSP stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get CSP statistics' });
  }
};
