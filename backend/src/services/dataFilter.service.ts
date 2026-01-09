import { UserRole, Prisma } from '@prisma/client';

/**
 * Data Filter Service
 * Provides query filters for multi-tenant data isolation
 * Ensures users only access data they're authorized to see
 */
export class DataFilterService {
  /**
   * Get filter for service requests based on user role
   */
  static getServiceRequestFilter(
    userRole: UserRole,
    userId: string
  ): Prisma.ServiceRequestWhereInput {
    // Super admins and admins see everything
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      return {};
    }

    // Clients see only their requests
    if (userRole === UserRole.CLIENT) {
      return {
        client: {
          userId,
        },
      };
    }

    // CAs see only their assigned requests
    if (userRole === UserRole.CA) {
      return {
        ca: {
          userId,
        },
      };
    }

    // No access by default
    return {
      id: '__no_access__',
    };
  }

  /**
   * Get filter for payments based on user role
   */
  static getPaymentFilter(userRole: UserRole, userId: string): Prisma.PaymentWhereInput {
    // Super admins and admins see everything
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      return {};
    }

    // Clients see only their payments
    if (userRole === UserRole.CLIENT) {
      return {
        client: {
          userId,
        },
      };
    }

    // CAs see only their earnings
    if (userRole === UserRole.CA) {
      return {
        ca: {
          userId,
        },
      };
    }

    return {
      id: '__no_access__',
    };
  }

  /**
   * Get filter for messages based on user role
   */
  static getMessageFilter(userRole: UserRole, userId: string): Prisma.MessageWhereInput {
    // Super admins and admins see all messages (for moderation)
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      return {};
    }

    // Regular users see messages they sent or received
    return {
      OR: [{ senderId: userId }, { receiverId: userId }],
    };
  }

  /**
   * Get filter for reviews based on user role
   */
  static getReviewFilter(_userRole: UserRole, _userId: string): Prisma.ReviewWhereInput {
    // Everyone can see all reviews (public data)
    // But writing reviews is permission-controlled
    return {};
  }

  /**
   * Get filter for users based on user role
   */
  static getUserFilter(userRole: UserRole, userId: string): Prisma.UserWhereInput {
    // Super admins and admins see all users
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      return {};
    }

    // CAs can see their clients
    if (userRole === UserRole.CA) {
      return {
        OR: [
          { id: userId }, // Own profile
          {
            // Clients with assigned requests
            client: {
              serviceRequests: {
                some: {
                  ca: {
                    userId,
                  },
                },
              },
            },
          },
        ],
      };
    }

    // Clients can see CAs they've hired
    if (userRole === UserRole.CLIENT) {
      return {
        OR: [
          { id: userId }, // Own profile
          {
            // CAs with assigned requests
            charteredAccountant: {
              serviceRequests: {
                some: {
                  client: {
                    userId,
                  },
                },
              },
            },
          },
          {
            // All CAs (for browsing)
            role: UserRole.CA,
          },
        ],
      };
    }

    // Default: only own profile
    return {
      id: userId,
    };
  }

  /**
   * Get filter for CA profiles
   */
  static getCAProfileFilter(
    userRole: UserRole,
    userId: string
  ): Prisma.CharteredAccountantWhereInput {
    // Super admins and admins see all CA profiles
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      return {};
    }

    // CAs see only their own profile
    if (userRole === UserRole.CA) {
      return {
        userId,
      };
    }

    // Clients can see all verified CA profiles
    if (userRole === UserRole.CLIENT) {
      return {
        verificationStatus: 'VERIFIED',
      };
    }

    return {
      id: '__no_access__',
    };
  }

  /**
   * Get filter for client profiles
   */
  static getClientProfileFilter(userRole: UserRole, userId: string): Prisma.ClientWhereInput {
    // Super admins and admins see all clients
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      return {};
    }

    // Clients see only their own profile
    if (userRole === UserRole.CLIENT) {
      return {
        userId,
      };
    }

    // CAs can see their assigned clients
    if (userRole === UserRole.CA) {
      return {
        serviceRequests: {
          some: {
            ca: {
              userId,
            },
          },
        },
      };
    }

    return {
      id: '__no_access__',
    };
  }

  /**
   * Apply data filter to existing query
   */
  static applyFilter<T extends object>(
    baseFilter: T,
    dataFilter: T
  ): T {
    return {
      ...baseFilter,
      ...dataFilter,
    } as T;
  }

  /**
   * Check if user can access specific resource by ID
   */
  static async canAccessResource(
    resourceType: string,
    resourceId: string,
    userRole: UserRole,
    userId: string,
    prisma: any
  ): Promise<boolean> {
    try {
      let filter: any;
      let model: any;

      switch (resourceType) {
        case 'serviceRequest':
          filter = this.getServiceRequestFilter(userRole, userId);
          model = prisma.serviceRequest;
          break;

        case 'payment':
          filter = this.getPaymentFilter(userRole, userId);
          model = prisma.payment;
          break;

        case 'message':
          filter = this.getMessageFilter(userRole, userId);
          model = prisma.message;
          break;

        case 'user':
          filter = this.getUserFilter(userRole, userId);
          model = prisma.user;
          break;

        case 'caProfile':
          filter = this.getCAProfileFilter(userRole, userId);
          model = prisma.charteredAccountant;
          break;

        case 'clientProfile':
          filter = this.getClientProfileFilter(userRole, userId);
          model = prisma.client;
          break;

        default:
          return false;
      }

      const resource = await model.findFirst({
        where: {
          id: resourceId,
          ...filter,
        },
      });

      return !!resource;
    } catch (error) {
      console.error('Error checking resource access:', error);
      return false;
    }
  }

  /**
   * Get select fields based on user role
   * Limits sensitive data exposure
   */
  static getUserSelect(userRole: UserRole, isOwnProfile: boolean): Prisma.UserSelect {
    const baseSelect: Prisma.UserSelect = {
      id: true,
      email: true,
      name: true,
      role: true,
      profileImage: true,
      createdAt: true,
    };

    // Super admins and admins see everything
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      return {
        ...baseSelect,
        phone: true,
        updatedAt: true,
      };
    }

    // Users see their own full profile
    if (isOwnProfile) {
      return {
        ...baseSelect,
        phone: true,
        updatedAt: true,
      };
    }

    // Others see limited profile
    return baseSelect;
  }

  /**
   * Get payment select fields based on user role
   */
  static getPaymentSelect(userRole: UserRole): Prisma.PaymentSelect {
    const baseSelect: Prisma.PaymentSelect = {
      id: true,
      amount: true,
      status: true,
      createdAt: true,
    };

    // Super admins and admins see full payment details
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      return {
        ...baseSelect,
        platformFee: true,
        caAmount: true,
        paymentMethod: true,
        transactionId: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        releasedToCA: true,
        releasedAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        ca: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      };
    }

    // Regular users see limited payment info
    return {
      ...baseSelect,
      paymentMethod: true,
      transactionId: true,
    };
  }

  /**
   * Sanitize sensitive data based on role
   */
  static sanitizeData<T extends Record<string, any>>(
    data: T,
    userRole: UserRole,
    sensitiveFields: string[]
  ): T {
    // Super admins see everything
    if (userRole === UserRole.SUPER_ADMIN) {
      return data;
    }

    // Remove sensitive fields for non-admin users
    const sanitized = { ...data };

    if (userRole !== UserRole.ADMIN) {
      sensitiveFields.forEach((field) => {
        if (field in sanitized) {
          delete sanitized[field];
        }
      });
    }

    return sanitized as T;
  }
}
