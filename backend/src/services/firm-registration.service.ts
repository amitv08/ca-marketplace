import {
  PrismaClient,
  FirmType,
  FirmStatus,
  FirmVerificationLevel,
  FirmMemberRole,
  MembershipType,
  VerificationStatus,
  Specialization,
  FirmDocumentType,
} from '@prisma/client';

const prisma = new PrismaClient();

interface InitiateFirmData {
  // Basic Information
  firmName: string;
  registrationNumber: string;
  gstin?: string;
  pan?: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  website?: string;

  // Firm Details
  firmType: FirmType;
  establishedYear: number;
  specializations?: Specialization[];
  description?: string;

  // Configuration
  allowIndependentWork?: boolean;
  autoAssignmentEnabled?: boolean;
  minimumCARequired?: number;

  // Branding
  logoUrl?: string;
  profileImage?: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;

  // Initiator Details
  initiatorCAId: string; // CA starting the registration
}

interface SubmitForVerificationData {
  firmId: string;
  requiredDocumentIds: string[]; // Document IDs that must be uploaded
}

interface VerifyFirmData {
  firmId: string;
  approved: boolean;
  verificationLevel?: FirmVerificationLevel;
  verificationNotes?: string;
  verifiedByUserId: string;
}

export class FirmRegistrationService {
  /**
   * Step 1: Initiate firm registration
   * Creates a firm in DRAFT status with the initiator as FIRM_ADMIN
   */
  static async initiateFirm(data: InitiateFirmData) {
    // 1. Validate initiator CA
    const initiatorCA = await prisma.charteredAccountant.findUnique({
      where: { id: data.initiatorCAId },
      include: { user: true },
    });

    if (!initiatorCA) {
      throw new Error('CA not found');
    }

    // 2. Check if CA is verified
    if (initiatorCA.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new Error('Only verified CAs can initiate firm registration');
    }

    // 3. Check if CA already has an active firm
    const activeMembership = await prisma.firmMembership.findFirst({
      where: {
        caId: data.initiatorCAId,
        isActive: true,
      },
    });

    if (activeMembership) {
      throw new Error('You are already a member of an active firm');
    }

    // 4. Check if CA has a pending firm registration (DRAFT status)
    const existingDraftFirm = await prisma.cAFirm.findFirst({
      where: {
        status: FirmStatus.DRAFT,
        members: {
          some: {
            caId: data.initiatorCAId,
            role: FirmMemberRole.FIRM_ADMIN,
          },
        },
      },
    });

    if (existingDraftFirm) {
      throw new Error('You already have a pending firm registration. Please complete or cancel it first.');
    }

    // 5. Validate unique constraints
    const existingFirm = await prisma.cAFirm.findFirst({
      where: {
        OR: [
          { firmName: data.firmName },
          { registrationNumber: data.registrationNumber },
          ...(data.gstin ? [{ gstin: data.gstin }] : []),
          ...(data.pan ? [{ pan: data.pan }] : []),
          { email: data.email },
        ],
      },
    });

    if (existingFirm) {
      if (existingFirm.firmName === data.firmName) {
        throw new Error('Firm name already exists');
      }
      if (existingFirm.registrationNumber === data.registrationNumber) {
        throw new Error('Registration number already exists');
      }
      if (data.gstin && existingFirm.gstin === data.gstin) {
        throw new Error('GSTIN already exists');
      }
      if (data.pan && existingFirm.pan === data.pan) {
        throw new Error('PAN already exists');
      }
      if (existingFirm.email === data.email) {
        throw new Error('Email already exists');
      }
    }

    // 6. Create firm and membership in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create firm
      const firm = await tx.cAFirm.create({
        data: {
          firmName: data.firmName,
          registrationNumber: data.registrationNumber,
          gstin: data.gstin,
          pan: data.pan,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          website: data.website,
          firmType: data.firmType,
          status: FirmStatus.DRAFT,
          verificationLevel: FirmVerificationLevel.BASIC,
          establishedYear: data.establishedYear,
          specializations: data.specializations || [],
          description: data.description,
          allowIndependentWork: data.allowIndependentWork ?? false,
          autoAssignmentEnabled: data.autoAssignmentEnabled ?? true,
          minimumCARequired: data.minimumCARequired || 2,
          logoUrl: data.logoUrl,
          profileImage: data.profileImage,
          contactPersonName: data.contactPersonName,
          contactPersonEmail: data.contactPersonEmail,
          contactPersonPhone: data.contactPersonPhone,
        },
      });

      // Create membership for initiator
      const membership = await tx.firmMembership.create({
        data: {
          firmId: firm.id,
          caId: data.initiatorCAId,
          role: FirmMemberRole.FIRM_ADMIN,
          membershipType: MembershipType.FULL_TIME,
          isActive: true,
          canWorkIndependently: data.allowIndependentWork ?? false,
        },
      });

      // Update CA's currentFirmId
      await tx.charteredAccountant.update({
        where: { id: data.initiatorCAId },
        data: {
          currentFirmId: firm.id,
        },
      });

      return { firm, membership };
    });

    return result;
  }

  /**
   * Step 2: Submit firm for verification
   * Validates all requirements and changes status to PENDING_VERIFICATION
   */
  static async submitForVerification(data: SubmitForVerificationData) {
    const { firmId, requiredDocumentIds } = data;

    // 1. Get firm with members and documents
    const firm = await prisma.cAFirm.findUnique({
      where: { id: firmId },
      include: {
        members: {
          where: { isActive: true },
          include: {
            ca: {
              include: {
                user: true,
              },
            },
          },
        },
        documents: true,
        invitations: {
          where: {
            status: 'PENDING',
            expiresAt: {
              gt: new Date(),
            },
          },
        },
      },
    });

    if (!firm) {
      throw new Error('Firm not found');
    }

    // 2. Validate firm is in DRAFT status
    if (firm.status !== FirmStatus.DRAFT) {
      throw new Error(`Cannot submit firm in ${firm.status} status for verification`);
    }

    // 3. Validate minimum members (at least 2 CAs, all must have accepted invitations)
    const activeMemberCount = firm.members.length;
    const pendingInvitationCount = firm.invitations.length;

    if (activeMemberCount + pendingInvitationCount < 2) {
      throw new Error(
        'Firm must have at least 2 members. Please invite additional CAs before submitting for verification.'
      );
    }

    if (activeMemberCount < 2) {
      throw new Error(
        `You have ${pendingInvitationCount} pending invitation(s). All invited CAs must accept before submission.`
      );
    }

    // 4. Validate all members are verified CAs
    for (const member of firm.members) {
      if (member.ca.verificationStatus !== VerificationStatus.VERIFIED) {
        throw new Error(
          `Member ${member.ca.user.name} is not a verified CA. All members must be verified.`
        );
      }
    }

    // 5. Validate required documents are uploaded
    const requiredDocTypes: FirmDocumentType[] = [
      FirmDocumentType.REGISTRATION_CERTIFICATE,
      FirmDocumentType.PAN_CARD,
      FirmDocumentType.ADDRESS_PROOF,
    ];

    // If firm has GST, require GST certificate
    if (firm.gstin) {
      requiredDocTypes.push(FirmDocumentType.GST_CERTIFICATE);
    }

    // If partnership/LLP, require partnership deed
    if (firm.firmType === FirmType.PARTNERSHIP || firm.firmType === FirmType.LLP) {
      requiredDocTypes.push(FirmDocumentType.PARTNERSHIP_DEED);
    }

    // If private limited, require MOA/AOA
    if (firm.firmType === FirmType.PRIVATE_LIMITED) {
      requiredDocTypes.push(FirmDocumentType.MOA_AOA);
    }

    const uploadedDocTypes = firm.documents.map((doc) => doc.documentType);
    const missingDocTypes = requiredDocTypes.filter(
      (type) => !uploadedDocTypes.includes(type)
    );

    if (missingDocTypes.length > 0) {
      throw new Error(
        `Missing required documents: ${missingDocTypes.join(', ').replace(/_/g, ' ')}`
      );
    }

    // 6. Validate provided document IDs exist
    const documents = await prisma.firmDocument.findMany({
      where: {
        id: { in: requiredDocumentIds },
        firmId,
      },
    });

    if (documents.length !== requiredDocumentIds.length) {
      throw new Error('Some document IDs are invalid');
    }

    // 7. Update firm status
    const updatedFirm = await prisma.cAFirm.update({
      where: { id: firmId },
      data: {
        status: FirmStatus.PENDING_VERIFICATION,
      },
      include: {
        members: {
          where: { isActive: true },
          include: {
            ca: {
              include: {
                user: true,
              },
            },
          },
        },
        documents: true,
      },
    });

    // TODO: Send notification to admins for verification

    return updatedFirm;
  }

  /**
   * Admin: Get firms pending verification (with escalation alerts for >7 days)
   */
  static async getPendingFirms(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [firms, total] = await Promise.all([
      prisma.cAFirm.findMany({
        where: {
          status: FirmStatus.PENDING_VERIFICATION,
        },
        include: {
          members: {
            where: { isActive: true },
            include: {
              ca: {
                include: {
                  user: true,
                },
              },
            },
          },
          documents: true,
          _count: {
            select: {
              members: true,
              documents: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'asc', // Oldest first (needs attention)
        },
        skip,
        take: limit,
      }),
      prisma.cAFirm.count({
        where: {
          status: FirmStatus.PENDING_VERIFICATION,
        },
      }),
    ]);

    // Calculate days pending and add escalation flag
    const now = new Date();
    const firmsWithEscalation = firms.map((firm) => {
      const daysPending = Math.floor(
        (now.getTime() - firm.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...firm,
        daysPending,
        needsEscalation: daysPending > 7,
      };
    });

    return {
      firms: firmsWithEscalation,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Verify or reject a firm
   */
  static async verifyFirm(data: VerifyFirmData) {
    const { firmId, approved, verificationLevel, verificationNotes, verifiedByUserId } = data;

    // 1. Get firm
    const firm = await prisma.cAFirm.findUnique({
      where: { id: firmId },
      include: {
        members: {
          where: { isActive: true },
          include: {
            ca: {
              include: {
                user: true,
              },
            },
          },
        },
        documents: true,
      },
    });

    if (!firm) {
      throw new Error('Firm not found');
    }

    // 2. Validate firm is in PENDING_VERIFICATION status
    if (firm.status !== FirmStatus.PENDING_VERIFICATION) {
      throw new Error(`Firm is not pending verification. Current status: ${firm.status}`);
    }

    // 3. Update firm
    const updatedFirm = await prisma.cAFirm.update({
      where: { id: firmId },
      data: {
        status: approved ? FirmStatus.ACTIVE : FirmStatus.DRAFT,
        verificationLevel: approved
          ? verificationLevel || FirmVerificationLevel.VERIFIED
          : FirmVerificationLevel.BASIC,
        verifiedAt: approved ? new Date() : null,
        verifiedBy: approved ? verifiedByUserId : null,
        verificationNotes,
      },
      include: {
        members: {
          where: { isActive: true },
          include: {
            ca: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    // TODO: Send notifications to all firm members about approval/rejection

    return updatedFirm;
  }

  /**
   * Get firm registration status (for the registration wizard)
   */
  static async getFirmRegistrationStatus(firmId: string) {
    const firm = await prisma.cAFirm.findUnique({
      where: { id: firmId },
      include: {
        members: {
          where: { isActive: true },
          include: {
            ca: {
              include: {
                user: true,
              },
            },
          },
        },
        documents: true,
        invitations: {
          where: {
            status: 'PENDING',
            expiresAt: {
              gt: new Date(),
            },
          },
          include: {
            ca: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!firm) {
      throw new Error('Firm not found');
    }

    // Calculate requirements
    const activeMemberCount = firm.members.length;
    const pendingInvitationCount = firm.invitations.length;
    const totalMembers = activeMemberCount + pendingInvitationCount;

    const requiredDocTypes: FirmDocumentType[] = [
      FirmDocumentType.REGISTRATION_CERTIFICATE,
      FirmDocumentType.PAN_CARD,
      FirmDocumentType.ADDRESS_PROOF,
    ];

    if (firm.gstin) {
      requiredDocTypes.push(FirmDocumentType.GST_CERTIFICATE);
    }

    if (firm.firmType === FirmType.PARTNERSHIP || firm.firmType === FirmType.LLP) {
      requiredDocTypes.push(FirmDocumentType.PARTNERSHIP_DEED);
    }

    if (firm.firmType === FirmType.PRIVATE_LIMITED) {
      requiredDocTypes.push(FirmDocumentType.MOA_AOA);
    }

    const uploadedDocTypes = firm.documents.map((doc) => doc.documentType);
    const missingDocTypes = requiredDocTypes.filter(
      (type) => !uploadedDocTypes.includes(type)
    );

    const allMembersVerified = firm.members.every(
      (m) => m.ca.verificationStatus === VerificationStatus.VERIFIED
    );

    const canSubmit =
      firm.status === FirmStatus.DRAFT &&
      activeMemberCount >= 2 &&
      pendingInvitationCount === 0 &&
      missingDocTypes.length === 0 &&
      allMembersVerified;

    return {
      firm,
      status: {
        currentStatus: firm.status,
        canSubmit,
        requirements: {
          minimumMembers: {
            required: 2,
            current: activeMemberCount,
            pending: pendingInvitationCount,
            met: activeMemberCount >= 2 && pendingInvitationCount === 0,
          },
          requiredDocuments: {
            required: requiredDocTypes,
            uploaded: uploadedDocTypes,
            missing: missingDocTypes,
            met: missingDocTypes.length === 0,
          },
          allMembersVerified: {
            met: allMembersVerified,
          },
        },
      },
    };
  }

  /**
   * Cancel firm registration (delete DRAFT firm)
   */
  static async cancelFirmRegistration(firmId: string, caId: string) {
    // 1. Get firm
    const firm = await prisma.cAFirm.findUnique({
      where: { id: firmId },
      include: {
        members: {
          where: {
            caId,
            isActive: true,
            role: FirmMemberRole.FIRM_ADMIN,
          },
        },
      },
    });

    if (!firm) {
      throw new Error('Firm not found');
    }

    // 2. Validate caller is firm admin
    if (firm.members.length === 0) {
      throw new Error('Only firm admins can cancel registration');
    }

    // 3. Validate firm is in DRAFT status
    if (firm.status !== FirmStatus.DRAFT) {
      throw new Error('Only DRAFT firms can be cancelled');
    }

    // 4. Delete firm (cascade will delete memberships, invitations, documents)
    await prisma.cAFirm.delete({
      where: { id: firmId },
    });

    return { message: 'Firm registration cancelled successfully' };
  }
}

export default FirmRegistrationService;
