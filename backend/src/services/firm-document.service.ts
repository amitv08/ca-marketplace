import { PrismaClient, FirmDocumentType } from '@prisma/client';
import { CacheService } from './cache.service';

const prisma = new PrismaClient();

/**
 * Firm Document Service
 * Handles document upload, verification, and management for CA firms
 *
 * Cache Keys:
 * - firm:documents:{firmId}
 * - document:detail:{documentId}
 */

export interface UploadDocumentData {
  firmId: string;
  documentType: FirmDocumentType;
  documentUrl: string; // S3/CDN URL
  fileName: string;
  fileSize: bigint;
  mimeType?: string;
  uploadedByUserId: string;
}

export interface VerifyDocumentData {
  verifiedBy: string;
  isVerified: boolean;
  verificationNotes?: string;
}

export interface DocumentFilters {
  firmId?: string;
  documentType?: FirmDocumentType;
  isVerified?: boolean;
}

export class FirmDocumentService {
  private static readonly CACHE_TTL = 300; // 5 minutes

  // Document type requirements map
  private static readonly REQUIRED_DOCUMENTS: FirmDocumentType[] = [
    'REGISTRATION_CERTIFICATE',
    'GST_CERTIFICATE',
    'PAN_CARD',
  ];

  private static readonly OPTIONAL_DOCUMENTS: FirmDocumentType[] = [
    'ADDRESS_PROOF',
    'BANK_DETAILS',
    'CA_LICENSE',
    'PARTNERSHIP_DEED',
    'MOA_AOA',
    'OTHER',
  ];

  /**
   * Upload a new document
   */
  static async uploadDocument(data: UploadDocumentData) {
    // Validate firm exists
    const firm = await prisma.cAFirm.findUnique({
      where: { id: data.firmId },
    });

    if (!firm) {
      throw new Error('Firm not found');
    }

    // Check if document of this type already exists
    const existingDocument = await prisma.firmDocument.findFirst({
      where: {
        firmId: data.firmId,
        documentType: data.documentType,
        isVerified: true,
      },
    });

    if (existingDocument) {
      // If verified document exists, create new version and mark old as superseded
      await prisma.firmDocument.update({
        where: { id: existingDocument.id },
        data: {
          verificationNotes: 'Superseded by new document upload',
        },
      });
    }

    // Create document record
    const document = await prisma.firmDocument.create({
      data: {
        firmId: data.firmId,
        documentType: data.documentType,
        documentUrl: data.documentUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        uploadedAt: new Date(),
        isVerified: false,
      },
      include: {
        firm: {
          select: {
            id: true,
            firmName: true,
          },
        },
      },
    });

    // Invalidate caches
    await this.invalidateDocumentCaches(data.firmId);

    return document;
  }

  /**
   * Get document by ID
   */
  static async getDocumentById(documentId: string) {
    const cacheKey = `document:detail:${documentId}`;

    // Try cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const document = await prisma.firmDocument.findUnique({
      where: { id: documentId },
      include: {
        firm: {
          select: {
            id: true,
            firmName: true,
            status: true,
          },
        },
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Cache result
    await CacheService.set(cacheKey, document, { ttl: this.CACHE_TTL });

    return document;
  }

  /**
   * Get all documents for a firm
   */
  static async getFirmDocuments(firmId: string, includeUnverified: boolean = true) {
    const cacheKey = `firm:documents:${firmId}:${includeUnverified}`;

    // Try cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const where: any = { firmId };
    if (!includeUnverified) {
      where.isVerified = true;
    }

    const documents = await prisma.firmDocument.findMany({
      where,
      orderBy: [
        { documentType: 'asc' },
        { uploadedAt: 'desc' },
      ],
    });

    // Cache results
    await CacheService.set(cacheKey, documents, { ttl: this.CACHE_TTL });

    return documents;
  }

  /**
   * Verify a document (Admin only)
   */
  static async verifyDocument(documentId: string, data: VerifyDocumentData) {
    const document = await this.getDocumentById(documentId) as any;

    if (document.isVerified) {
      throw new Error('Document is already verified');
    }

    const updated = await prisma.firmDocument.update({
      where: { id: documentId },
      data: {
        isVerified: data.isVerified,
        verifiedBy: data.verifiedBy,
        verifiedAt: data.isVerified ? new Date() : null,
        verificationNotes: data.verificationNotes,
      },
      include: {
        firm: {
          select: {
            id: true,
            firmName: true,
          },
        },
      },
    });

    // Invalidate caches
    await this.invalidateDocumentCaches(document.firmId);

    return updated;
  }

  /**
   * Reject a document (Admin only)
   */
  static async rejectDocument(documentId: string, verifiedBy: string, reason: string) {
    const document = await this.getDocumentById(documentId) as any;

    const updated = await prisma.firmDocument.update({
      where: { id: documentId },
      data: {
        isVerified: false,
        verifiedBy,
        verifiedAt: null,
        verificationNotes: `REJECTED: ${reason}`,
      },
      include: {
        firm: {
          select: {
            id: true,
            firmName: true,
          },
        },
      },
    });

    // Invalidate caches
    await this.invalidateDocumentCaches(document.firmId);

    return updated;
  }

  /**
   * Delete a document
   */
  static async deleteDocument(documentId: string, deletedByUserId: string) {
    const document = await this.getDocumentById(documentId) as any;

    // Don't allow deletion of verified documents
    if (document.isVerified) {
      throw new Error('Cannot delete verified documents. Please upload a new version instead.');
    }

    await prisma.firmDocument.delete({
      where: { id: documentId },
    });

    // Invalidate caches
    await this.invalidateDocumentCaches(document.firmId);

    return { success: true, message: 'Document deleted successfully' };
  }

  /**
   * Check document completeness for verification
   */
  static async checkDocumentCompleteness(firmId: string): Promise<{
    isComplete: boolean;
    missingDocuments: FirmDocumentType[];
    verifiedDocuments: FirmDocumentType[];
    pendingVerification: FirmDocumentType[];
  }> {
    const documents = await this.getFirmDocuments(firmId, true) as any[];

    const verifiedTypes = new Set(
      documents.filter((doc: any) => doc.isVerified).map((doc: any) => doc.documentType)
    );

    const uploadedTypes = new Set(documents.map((doc: any) => doc.documentType));

    const missingDocuments = this.REQUIRED_DOCUMENTS.filter(
      type => !uploadedTypes.has(type)
    );

    const pendingVerification = this.REQUIRED_DOCUMENTS.filter(
      type => uploadedTypes.has(type) && !verifiedTypes.has(type)
    );

    const isComplete = missingDocuments.length === 0 && pendingVerification.length === 0;

    return {
      isComplete,
      missingDocuments,
      verifiedDocuments: Array.from(verifiedTypes),
      pendingVerification,
    };
  }

  /**
   * Get documents by type
   */
  static async getDocumentsByType(firmId: string, documentType: FirmDocumentType) {
    const documents = await prisma.firmDocument.findMany({
      where: {
        firmId,
        documentType,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return documents;
  }

  /**
   * Get latest verified document of a type
   */
  static async getLatestVerifiedDocument(firmId: string, documentType: FirmDocumentType) {
    const document = await prisma.firmDocument.findFirst({
      where: {
        firmId,
        documentType,
        isVerified: true,
      },
      orderBy: { verifiedAt: 'desc' },
    });

    return document;
  }

  /**
   * Get pending verification documents (Admin)
   */
  static async getPendingVerificationDocuments(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      prisma.firmDocument.findMany({
        where: {
          isVerified: false,
          verifiedAt: null,
        },
        include: {
          firm: {
            select: {
              id: true,
              firmName: true,
              status: true,
              email: true,
            },
          },
        },
        orderBy: { uploadedAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.firmDocument.count({
        where: {
          isVerified: false,
          verifiedAt: null,
        },
      }),
    ]);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get document statistics for a firm
   */
  static async getDocumentStats(firmId: string) {
    const [total, verified, pending, rejected] = await Promise.all([
      prisma.firmDocument.count({
        where: { firmId },
      }),
      prisma.firmDocument.count({
        where: { firmId, isVerified: true },
      }),
      prisma.firmDocument.count({
        where: {
          firmId,
          isVerified: false,
          verificationNotes: null,
        },
      }),
      prisma.firmDocument.count({
        where: {
          firmId,
          isVerified: false,
          verificationNotes: { contains: 'REJECTED' },
        },
      }),
    ]);

    const completeness = await this.checkDocumentCompleteness(firmId);

    return {
      total,
      verified,
      pending,
      rejected,
      completeness,
    };
  }

  /**
   * Bulk verify documents
   */
  static async bulkVerifyDocuments(
    documentIds: string[],
    verifiedBy: string,
    notes?: string
  ) {
    const updated = await prisma.firmDocument.updateMany({
      where: {
        id: { in: documentIds },
        isVerified: false,
      },
      data: {
        isVerified: true,
        verifiedBy,
        verifiedAt: new Date(),
        verificationNotes: notes || 'Bulk verified',
      },
    });

    // Get affected firms to invalidate cache
    const documents = await prisma.firmDocument.findMany({
      where: { id: { in: documentIds } },
      select: { firmId: true },
    });

    const uniqueFirmIds = [...new Set(documents.map(doc => doc.firmId))];

    // Invalidate all affected firm caches
    await Promise.all(
      uniqueFirmIds.map(firmId => this.invalidateDocumentCaches(firmId))
    );

    return {
      updated: updated.count,
      message: `${updated.count} documents verified successfully`,
    };
  }

  /**
   * Get document verification status summary
   */
  static async getVerificationStatusSummary(firmId: string) {
    const documents = await this.getFirmDocuments(firmId, true) as any[];

    const summary = {
      requiredDocuments: {} as Record<string, { uploaded: boolean; verified: boolean }>,
      optionalDocuments: {} as Record<string, { uploaded: boolean; verified: boolean }>,
    };

    // Initialize required documents
    this.REQUIRED_DOCUMENTS.forEach(type => {
      const doc = documents.find((d: any) => d.documentType === type && d.isVerified);
      summary.requiredDocuments[type] = {
        uploaded: documents.some((d: any) => d.documentType === type),
        verified: !!doc,
      };
    });

    // Initialize optional documents
    this.OPTIONAL_DOCUMENTS.forEach(type => {
      const hasDoc = documents.some((d: any) => d.documentType === type);
      if (hasDoc) {
        const doc = documents.find((d: any) => d.documentType === type && d.isVerified);
        summary.optionalDocuments[type] = {
          uploaded: true,
          verified: !!doc,
        };
      }
    });

    return summary;
  }

  /**
   * Search documents across all firms (Admin)
   */
  static async searchDocuments(filters: DocumentFilters, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.firmId) {
      where.firmId = filters.firmId;
    }

    if (filters.documentType) {
      where.documentType = filters.documentType;
    }

    if (filters.isVerified !== undefined) {
      where.isVerified = filters.isVerified;
    }

    const [documents, total] = await Promise.all([
      prisma.firmDocument.findMany({
        where,
        include: {
          firm: {
            select: {
              id: true,
              firmName: true,
              status: true,
            },
          },
        },
        orderBy: { uploadedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.firmDocument.count({ where }),
    ]);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Cache invalidation helper
   */
  private static async invalidateDocumentCaches(firmId: string) {
    await Promise.all([
      CacheService.delete(`firm:documents:${firmId}:true`),
      CacheService.delete(`firm:documents:${firmId}:false`),
      CacheService.delete(`firm:detail:${firmId}`),
    ]);
  }
}

export default FirmDocumentService;
