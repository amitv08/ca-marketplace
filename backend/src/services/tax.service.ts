import { PrismaClient, TaxType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Tax Service
 *
 * Handles tax calculations and certificate generation:
 * - TDS calculation and deduction
 * - GST calculation
 * - Quarterly TDS certificates
 * - Form 16/16A generation
 * - Tax record management
 */

export interface TDSCalculation {
  taxableAmount: number;
  tdsRate: number;
  tdsAmount: number;
  netAmount: number;
}

export interface GSTCalculation {
  baseAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

export class TaxService {
  // TDS Rates (as per Income Tax Act)
  private static readonly TDS_RATE_194J = 10.0; // Professional/Technical Services
  private static readonly TDS_RATE_194C = 1.0; // Contractor payments (if PAN available)
  private static readonly TDS_RATE_194C_NO_PAN = 20.0; // Without PAN

  // GST Rates
  private static readonly GST_RATE_18 = 18.0; // Standard rate for services
  private static readonly GST_RATE_12 = 12.0; // Concessional rate

  // Tax Thresholds
  private static readonly TDS_THRESHOLD_194J = 30000; // ₹30,000 per year
  private static readonly GST_THRESHOLD = 2000000; // ₹20 lakhs turnover

  /**
   * Calculate TDS for professional services (194J)
   */
  static calculateTDS_194J(amount: number, hasPan: boolean = true): TDSCalculation {
    // Check if amount exceeds threshold
    if (amount < this.TDS_THRESHOLD_194J) {
      return {
        taxableAmount: amount,
        tdsRate: 0,
        tdsAmount: 0,
        netAmount: amount,
      };
    }

    const tdsRate = hasPan ? this.TDS_RATE_194J : 20.0; // 20% if no PAN
    const tdsAmount = (amount * tdsRate) / 100;
    const netAmount = amount - tdsAmount;

    return {
      taxableAmount: amount,
      tdsRate,
      tdsAmount,
      netAmount,
    };
  }

  /**
   * Calculate TDS for contractor payments (194C)
   */
  static calculateTDS_194C(amount: number, hasPan: boolean = true): TDSCalculation {
    const tdsRate = hasPan ? this.TDS_RATE_194C : this.TDS_RATE_194C_NO_PAN;
    const tdsAmount = (amount * tdsRate) / 100;
    const netAmount = amount - tdsAmount;

    return {
      taxableAmount: amount,
      tdsRate,
      tdsAmount,
      netAmount,
    };
  }

  /**
   * Calculate GST
   */
  static calculateGST(amount: number, gstRate: number = 18.0): GSTCalculation {
    const gstAmount = (amount * gstRate) / 100;
    const totalAmount = amount + gstAmount;

    return {
      baseAmount: amount,
      gstRate,
      gstAmount,
      totalAmount,
    };
  }

  /**
   * Check if GST is applicable
   */
  static isGSTApplicable(annualTurnover: number): boolean {
    return annualTurnover >= this.GST_THRESHOLD;
  }

  /**
   * Create tax record
   */
  static async createTaxRecord(data: {
    firmId?: string;
    caId?: string;
    taxType: TaxType;
    taxableAmount: number;
    taxRate: number;
    taxAmount: number;
    financialYear: string;
    quarter?: string;
    month?: string;
    panNumber?: string;
    gstNumber?: string;
  }) {
    return await prisma.taxRecord.create({
      data: {
        firmId: data.firmId,
        caId: data.caId,
        taxType: data.taxType,
        taxableAmount: data.taxableAmount,
        taxRate: data.taxRate,
        taxAmount: data.taxAmount,
        totalAmount: data.taxableAmount + data.taxAmount,
        financialYear: data.financialYear,
        quarter: data.quarter,
        month: data.month,
        panNumber: data.panNumber,
        gstNumber: data.gstNumber,
      },
    });
  }

  /**
   * Get quarterly TDS summary
   */
  static async getQuarterlyTDSSummary(
    financialYear: string,
    quarter: string,
    firmId?: string,
    caId?: string
  ) {
    const where: any = {
      financialYear,
      quarter,
      taxType: { in: [TaxType.TDS_194J, TaxType.TDS_194C] },
    };

    if (firmId) where.firmId = firmId;
    if (caId) where.caId = caId;

    const records = await prisma.taxRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      totalTaxable: 0,
      totalTDS: 0,
      recordCount: records.length,
      byType: {} as any,
    };

    records.forEach(record => {
      summary.totalTaxable += record.taxableAmount;
      summary.totalTDS += record.taxAmount;

      if (!summary.byType[record.taxType]) {
        summary.byType[record.taxType] = {
          count: 0,
          taxable: 0,
          tds: 0,
        };
      }

      summary.byType[record.taxType].count++;
      summary.byType[record.taxType].taxable += record.taxableAmount;
      summary.byType[record.taxType].tds += record.taxAmount;
    });

    return {
      financialYear,
      quarter,
      summary,
      records,
    };
  }

  /**
   * Generate TDS certificate data (Form 16A)
   */
  static async generateTDSCertificate(
    financialYear: string,
    quarter: string,
    caId: string
  ) {
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: caId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!ca) {
      throw new Error('CA not found');
    }

    if (!ca.panNumber) {
      throw new Error('PAN number not available for CA');
    }

    // Get TDS records for the quarter
    const summary = await this.getQuarterlyTDSSummary(financialYear, quarter, undefined, caId);

    // Generate certificate number
    const certificateNumber = `TDS/${financialYear}/${quarter}/${caId.slice(0, 8).toUpperCase()}`;

    // Certificate data for Form 16A
    const certificateData = {
      certificateNumber,
      financialYear,
      quarter,
      deductee: {
        name: ca.user.name,
        pan: ca.panNumber,
        email: ca.user.email,
      },
      deductor: {
        name: 'CA Marketplace Platform',
        tan: 'PLAT12345A', // TODO: Replace with actual TAN
        pan: 'AABCP1234Q', // TODO: Replace with actual PAN
      },
      summary: {
        totalPayment: summary.summary.totalTaxable,
        totalTDS: summary.summary.totalTDS,
        netPayment: summary.summary.totalTaxable - summary.summary.totalTDS,
      },
      records: summary.records.map(r => ({
        date: r.createdAt,
        description: `Payment for ${r.taxType}`,
        amount: r.taxableAmount,
        tdsRate: r.taxRate,
        tdsAmount: r.taxAmount,
      })),
      generatedAt: new Date(),
    };

    // TODO: Generate actual PDF certificate using a PDF library
    // For now, return certificate data
    // In production: Use puppeteer or similar to generate PDF from HTML template

    return certificateData;
  }

  /**
   * Generate GST summary for a period
   */
  static async getGSTSummary(
    financialYear: string,
    month: string,
    firmId?: string,
    caId?: string
  ) {
    const where: any = {
      financialYear,
      month,
      taxType: { in: [TaxType.GST_18, TaxType.GST_12] },
    };

    if (firmId) where.firmId = firmId;
    if (caId) where.caId = caId;

    const records = await prisma.taxRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      totalTaxable: 0,
      totalGST: 0,
      recordCount: records.length,
      byRate: {} as any,
    };

    records.forEach(record => {
      summary.totalTaxable += record.taxableAmount;
      summary.totalGST += record.taxAmount;

      const rate = record.taxRate;
      if (!summary.byRate[rate]) {
        summary.byRate[rate] = {
          count: 0,
          taxable: 0,
          gst: 0,
        };
      }

      summary.byRate[rate].count++;
      summary.byRate[rate].taxable += record.taxableAmount;
      summary.byRate[rate].gst += record.taxAmount;
    });

    return {
      financialYear,
      month,
      summary,
      records,
    };
  }

  /**
   * Get all tax records for an entity
   */
  static async getTaxRecords(
    firmId?: string,
    caId?: string,
    financialYear?: string,
    taxType?: TaxType,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (firmId) where.firmId = firmId;
    if (caId) where.caId = caId;
    if (financialYear) where.financialYear = financialYear;
    if (taxType) where.taxType = taxType;

    const [records, total] = await Promise.all([
      prisma.taxRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.taxRecord.count({ where }),
    ]);

    return {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get current financial year (April to March)
   */
  static getCurrentFinancialYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    if (month >= 3) {
      // April onwards
      return `FY ${year}-${year + 1}`;
    } else {
      // Jan-Mar
      return `FY ${year - 1}-${year}`;
    }
  }

  /**
   * Get current quarter
   */
  static getCurrentQuarter(): string {
    const now = new Date();
    const month = now.getMonth(); // 0-11

    // Financial year: Apr-Jun (Q1), Jul-Sep (Q2), Oct-Dec (Q3), Jan-Mar (Q4)
    if (month >= 3 && month <= 5) return 'Q1';
    if (month >= 6 && month <= 8) return 'Q2';
    if (month >= 9 && month <= 11) return 'Q3';
    return 'Q4';
  }

  /**
   * Get current month name
   */
  static getCurrentMonth(): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[new Date().getMonth()];
  }

  /**
   * Update tax record with certificate details
   */
  static async updateTaxCertificate(
    taxRecordId: string,
    certificateNumber: string,
    certificateUrl: string
  ) {
    return await prisma.taxRecord.update({
      where: { id: taxRecordId },
      data: {
        certificateNumber,
        certificateUrl,
        certificateDate: new Date(),
      },
    });
  }

  /**
   * Mark tax as paid/filed
   */
  static async markTaxAsPaid(
    taxRecordId: string,
    challanNumber: string,
    challanDate: Date
  ) {
    return await prisma.taxRecord.update({
      where: { id: taxRecordId },
      data: {
        paymentStatus: 'PAID',
        challanNumber,
        challanDate,
      },
    });
  }

  /**
   * Get tax statistics
   */
  static async getTaxStats(firmId?: string, caId?: string, financialYear?: string) {
    const where: any = {};
    if (firmId) where.firmId = firmId;
    if (caId) where.caId = caId;
    if (financialYear) where.financialYear = financialYear;

    const [totalRecords, totalTax, tdsSummary, gstSummary] = await Promise.all([
      prisma.taxRecord.count({ where }),
      prisma.taxRecord.aggregate({
        where,
        _sum: { taxAmount: true },
      }),
      prisma.taxRecord.aggregate({
        where: {
          ...where,
          taxType: { in: [TaxType.TDS_194J, TaxType.TDS_194C] },
        },
        _sum: { taxAmount: true },
      }),
      prisma.taxRecord.aggregate({
        where: {
          ...where,
          taxType: { in: [TaxType.GST_18, TaxType.GST_12] },
        },
        _sum: { taxAmount: true },
      }),
    ]);

    return {
      totalRecords,
      totalTax: totalTax._sum.taxAmount || 0,
      totalTDS: tdsSummary._sum.taxAmount || 0,
      totalGST: gstSummary._sum.taxAmount || 0,
    };
  }
}

export default TaxService;
