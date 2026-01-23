import { PrismaClient, InvitationStatus, FirmMemberRole, MembershipType, VerificationStatus } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface SendInvitationData {
  firmId: string;
  invitedById: string;
  email: string;
  caId?: string;
  role?: FirmMemberRole;
  membershipType?: MembershipType;
  message?: string;
}

interface AcceptInvitationData {
  invitationToken: string;
  caId: string; // The CA accepting the invitation
}

export class FirmInvitationService {
  /**
   * Send an invitation to join a firm
   */
  static async sendInvitation(data: SendInvitationData) {
    // 1. Validate inviter has permission (must be FIRM_ADMIN)
    const inviterMembership = await prisma.firmMembership.findFirst({
      where: {
        firmId: data.firmId,
        caId: data.invitedById,
        isActive: true,
        role: FirmMemberRole.FIRM_ADMIN,
      },
      include: {
        firm: true,
      },
    });

    if (!inviterMembership) {
      throw new Error('Only firm admins can send invitations');
    }

    // 2. Check firm status - must be DRAFT or ACTIVE
    const firm = inviterMembership.firm;
    if (!['DRAFT', 'ACTIVE'].includes(firm.status)) {
      throw new Error(`Cannot send invitations when firm status is ${firm.status}`);
    }

    // 3. If caId provided, validate the CA
    if (data.caId) {
      const ca = await prisma.charteredAccountant.findUnique({
        where: { id: data.caId },
        include: {
          user: true,
        },
      });

      if (!ca) {
        throw new Error('CA not found');
      }

      // Check if CA is verified
      if (ca.verificationStatus !== VerificationStatus.VERIFIED) {
        throw new Error('Only verified CAs can be invited to join a firm');
      }

      // Check if CA already has an active firm membership
      const activeMembership = await prisma.firmMembership.findFirst({
        where: {
          caId: data.caId,
          isActive: true,
        },
      });

      if (activeMembership) {
        throw new Error('CA is already a member of an active firm');
      }

      // Check if CA already has a pending invitation from this firm
      const existingInvitation = await prisma.firmInvitation.findFirst({
        where: {
          firmId: data.firmId,
          caId: data.caId,
          status: InvitationStatus.PENDING,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (existingInvitation) {
        throw new Error('CA already has a pending invitation from this firm');
      }

      // Use CA's email if not provided
      if (!data.email) {
        data.email = ca.user.email;
      }
    }

    // 4. Check for pending invitation to this email
    const existingEmailInvitation = await prisma.firmInvitation.findFirst({
      where: {
        firmId: data.firmId,
        email: data.email.toLowerCase(),
        status: InvitationStatus.PENDING,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingEmailInvitation) {
      throw new Error('An invitation has already been sent to this email address');
    }

    // 5. Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');

    // 6. Set expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 7. Create invitation
    const invitation = await prisma.firmInvitation.create({
      data: {
        firmId: data.firmId,
        invitedById: data.invitedById,
        caId: data.caId,
        email: data.email.toLowerCase(),
        role: data.role || FirmMemberRole.JUNIOR_CA,
        membershipType: data.membershipType || MembershipType.FULL_TIME,
        invitationToken,
        message: data.message,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
      include: {
        firm: true,
        invitedBy: {
          include: {
            user: true,
          },
        },
        ca: {
          include: {
            user: true,
          },
        },
      },
    });

    // TODO: Send email notification to invitee
    // This will be implemented in the email service

    return invitation;
  }

  /**
   * Accept an invitation
   */
  static async acceptInvitation(data: AcceptInvitationData) {
    // 1. Find invitation by token
    const invitation = await prisma.firmInvitation.findUnique({
      where: {
        invitationToken: data.invitationToken,
      },
      include: {
        firm: true,
        invitedBy: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    // 2. Validate invitation status
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error(`Invitation is ${invitation.status.toLowerCase()}`);
    }

    // 3. Check if expired
    if (new Date() > invitation.expiresAt) {
      await prisma.firmInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new Error('Invitation has expired');
    }

    // 4. Validate the CA accepting matches the invitation
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: data.caId },
      include: { user: true },
    });

    if (!ca) {
      throw new Error('CA not found');
    }

    // Check if CA email matches invitation email
    if (ca.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error('This invitation was sent to a different email address');
    }

    // 5. Check if CA is verified
    if (ca.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new Error('Only verified CAs can join a firm');
    }

    // 6. Check if CA already has an active firm membership
    const activeMembership = await prisma.firmMembership.findFirst({
      where: {
        caId: data.caId,
        isActive: true,
      },
    });

    if (activeMembership) {
      throw new Error('You are already a member of an active firm. Please leave your current firm before joining a new one.');
    }

    // 7. Create firm membership and update invitation in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update invitation status
      const updatedInvitation = await tx.firmInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          caId: data.caId, // Link the CA if not already linked
        },
      });

      // Create firm membership
      const membership = await tx.firmMembership.create({
        data: {
          firmId: invitation.firmId,
          caId: data.caId,
          role: invitation.role,
          membershipType: invitation.membershipType,
          isActive: true,
          canWorkIndependently: invitation.firm.allowIndependentWork,
        },
        include: {
          firm: true,
          ca: {
            include: {
              user: true,
            },
          },
        },
      });

      // Update CA's currentFirmId
      await tx.charteredAccountant.update({
        where: { id: data.caId },
        data: {
          currentFirmId: invitation.firmId,
          isIndependentPractitioner: invitation.firm.allowIndependentWork,
        },
      });

      return { invitation: updatedInvitation, membership };
    });

    // TODO: Send notification to firm admin about acceptance

    return result;
  }

  /**
   * Reject an invitation
   */
  static async rejectInvitation(invitationToken: string, caId: string) {
    // 1. Find invitation
    const invitation = await prisma.firmInvitation.findUnique({
      where: { invitationToken },
      include: {
        ca: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    // 2. Validate invitation status
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error(`Invitation is ${invitation.status.toLowerCase()}`);
    }

    // 3. Validate the CA rejecting
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: caId },
      include: { user: true },
    });

    if (!ca) {
      throw new Error('CA not found');
    }

    if (ca.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error('This invitation was sent to a different email address');
    }

    // 4. Update invitation
    const updatedInvitation = await prisma.firmInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.REJECTED,
        rejectedAt: new Date(),
      },
      include: {
        firm: true,
        invitedBy: {
          include: {
            user: true,
          },
        },
      },
    });

    // TODO: Send notification to firm admin about rejection

    return updatedInvitation;
  }

  /**
   * Cancel an invitation (by inviter)
   */
  static async cancelInvitation(invitationId: string, caId: string) {
    // 1. Find invitation
    const invitation = await prisma.firmInvitation.findUnique({
      where: { id: invitationId },
      include: {
        firm: {
          include: {
            members: {
              where: {
                caId,
                isActive: true,
                role: FirmMemberRole.FIRM_ADMIN,
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    // 2. Validate canceller is firm admin
    if (invitation.firm.members.length === 0) {
      throw new Error('Only firm admins can cancel invitations');
    }

    // 3. Validate invitation is pending
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new Error(`Cannot cancel ${invitation.status.toLowerCase()} invitation`);
    }

    // 4. Update invitation
    const updatedInvitation = await prisma.firmInvitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.CANCELLED,
      },
    });

    return updatedInvitation;
  }

  /**
   * Get pending invitations for a firm
   */
  static async getFirmInvitations(firmId: string, status?: InvitationStatus) {
    const invitations = await prisma.firmInvitation.findMany({
      where: {
        firmId,
        ...(status && { status }),
      },
      include: {
        invitedBy: {
          include: {
            user: true,
          },
        },
        ca: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        sentAt: 'desc',
      },
    });

    return invitations;
  }

  /**
   * Get pending invitations for a CA (by email or caId)
   */
  static async getCAInvitations(caId: string) {
    const ca = await prisma.charteredAccountant.findUnique({
      where: { id: caId },
      include: { user: true },
    });

    if (!ca) {
      throw new Error('CA not found');
    }

    const invitations = await prisma.firmInvitation.findMany({
      where: {
        OR: [
          { caId },
          { email: ca.user.email.toLowerCase() },
        ],
        status: InvitationStatus.PENDING,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        firm: true,
        invitedBy: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        sentAt: 'desc',
      },
    });

    return invitations;
  }

  /**
   * Get invitation by token (for viewing invitation details)
   */
  static async getInvitationByToken(token: string) {
    const invitation = await prisma.firmInvitation.findUnique({
      where: { invitationToken: token },
      include: {
        firm: true,
        invitedBy: {
          include: {
            user: true,
          },
        },
        ca: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    // Check if expired (update status if needed)
    if (invitation.status === InvitationStatus.PENDING && new Date() > invitation.expiresAt) {
      await prisma.firmInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      invitation.status = InvitationStatus.EXPIRED;
    }

    return invitation;
  }

  /**
   * Expire old pending invitations (cron job)
   */
  static async expireOldInvitations() {
    const result = await prisma.firmInvitation.updateMany({
      where: {
        status: InvitationStatus.PENDING,
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: InvitationStatus.EXPIRED,
      },
    });

    return result.count;
  }
}

export default FirmInvitationService;
