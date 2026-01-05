import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { asyncHandler, authenticate, validateBody, authorize } from '../middleware';
import { sendSuccess, sendError, hashPassword, comparePassword, sanitizeUser } from '../utils';

const router = Router();

// Get user profile
router.get('/profile', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: {
      client: true,
      charteredAccountant: {
        include: {
          reviews: {
            select: {
              rating: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Calculate average rating for CAs
  let averageRating = null;
  if (user.charteredAccountant && user.charteredAccountant.reviews.length > 0) {
    const totalRating = user.charteredAccountant.reviews.reduce((sum, review) => sum + review.rating, 0);
    averageRating = Math.round((totalRating / user.charteredAccountant.reviews.length) * 10) / 10;
  }

  const userData = sanitizeUser(user);
  sendSuccess(res, { ...userData, averageRating });
}));

// Update user profile
const updateProfileSchema = {
  name: { type: 'string' as const, min: 2, max: 100 },
  phone: { type: 'string' as const, min: 10, max: 15 },
  profileImage: { type: 'string' as const },
};

// PATCH for partial updates
router.patch('/profile', authenticate, validateBody(updateProfileSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, phone, profileImage } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      ...(name && { name }),
      ...(phone && { phone }),
      ...(profileImage && { profileImage }),
    },
  });

  const userData = sanitizeUser(user);
  sendSuccess(res, userData, 'Profile updated successfully');
}));

// PUT for full profile replacement (supports Phase-4 spec)
router.put('/profile', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { name, phone, profileImage, companyName, address, specialization, experience, description, hourlyRate } = req.body;

  // Update user basic info
  const userData: any = {};
  if (name) userData.name = name;
  if (phone) userData.phone = phone;
  if (profileImage) userData.profileImage = profileImage;

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: userData,
  });

  // Update role-specific profile
  if (req.user!.role === 'CLIENT') {
    const client = await prisma.client.findUnique({
      where: { userId: req.user!.userId },
    });

    if (client) {
      await prisma.client.update({
        where: { userId: req.user!.userId },
        data: {
          ...(companyName !== undefined && { companyName }),
          ...(address !== undefined && { address }),
        },
      });
    }
  } else if (req.user!.role === 'CA') {
    const ca = await prisma.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (ca) {
      await prisma.charteredAccountant.update({
        where: { userId: req.user!.userId },
        data: {
          ...(specialization !== undefined && { specialization }),
          ...(experience !== undefined && { experienceYears: experience }),
          ...(description !== undefined && { description }),
          ...(hourlyRate !== undefined && { hourlyRate }),
        },
      });
    }
  }

  const userData2 = sanitizeUser(user);
  sendSuccess(res, userData2, 'Profile updated successfully');
}));

// Change password
const changePasswordSchema = {
  currentPassword: { required: true, type: 'string' as const },
  newPassword: { required: true, type: 'string' as const, min: 8, max: 100 },
};

router.post('/change-password', authenticate, validateBody(changePasswordSchema), asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
  });

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  // Verify current password
  const isValidPassword = await comparePassword(currentPassword, user.password);
  if (!isValidPassword) {
    return sendError(res, 'Current password is incorrect', 401);
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  sendSuccess(res, null, 'Password changed successfully');
}));

// Update client profile
const updateClientSchema = {
  companyName: { type: 'string' as const, max: 200 },
  address: { type: 'string' as const, max: 500 },
  taxNumber: { type: 'string' as const, max: 50 },
  documents: { type: 'object' as const },
};

router.patch('/client-profile', authenticate, authorize('CLIENT'), validateBody(updateClientSchema), asyncHandler(async (req: Request, res: Response) => {
  const { companyName, address, taxNumber, documents } = req.body;

  // Check if client profile exists
  let client = await prisma.client.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!client) {
    // Create client profile if doesn't exist
    client = await prisma.client.create({
      data: {
        userId: req.user!.userId,
        companyName,
        address,
        taxNumber,
        documents,
      },
    });
  } else {
    // Update existing profile
    client = await prisma.client.update({
      where: { userId: req.user!.userId },
      data: {
        ...(companyName !== undefined && { companyName }),
        ...(address && { address }),
        ...(taxNumber && { taxNumber }),
        ...(documents && { documents }),
      },
    });
  }

  sendSuccess(res, client, 'Client profile updated successfully');
}));

// Update CA profile
const updateCASchema = {
  caLicenseNumber: { type: 'string' as const },
  specialization: { type: 'object' as const }, // Array of specializations
  experienceYears: { type: 'number' as const, min: 0, max: 70 },
  qualifications: { type: 'object' as const }, // Array of qualifications
  hourlyRate: { type: 'number' as const, min: 0 },
  description: { type: 'string' as const, max: 2000 },
  languages: { type: 'object' as const }, // Array of languages
  availability: { type: 'object' as const },
};

router.patch('/ca-profile', authenticate, authorize('CA'), validateBody(updateCASchema), asyncHandler(async (req: Request, res: Response) => {
  const { caLicenseNumber, specialization, experienceYears, qualifications, hourlyRate, description, languages, availability } = req.body;

  // Check if CA profile exists
  let ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!ca) {
    // Create CA profile if doesn't exist (require caLicenseNumber)
    if (!caLicenseNumber) {
      return sendError(res, 'CA license number is required for first-time setup', 400);
    }

    ca = await prisma.charteredAccountant.create({
      data: {
        userId: req.user!.userId,
        caLicenseNumber,
        specialization: specialization || [],
        experienceYears: experienceYears || 0,
        qualifications: qualifications || [],
        hourlyRate: hourlyRate || 0,
        description,
        languages: languages || [],
        availability,
      },
    });
  } else {
    // Update existing profile
    ca = await prisma.charteredAccountant.update({
      where: { userId: req.user!.userId },
      data: {
        ...(caLicenseNumber && { caLicenseNumber }),
        ...(specialization && { specialization }),
        ...(experienceYears !== undefined && { experienceYears }),
        ...(qualifications && { qualifications }),
        ...(hourlyRate !== undefined && { hourlyRate }),
        ...(description !== undefined && { description }),
        ...(languages && { languages }),
        ...(availability && { availability }),
      },
    });
  }

  sendSuccess(res, ca, 'CA profile updated successfully');
}));

// Get all CAs (for clients to browse)
router.get('/chartered-accountants', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { specialization, minRating, maxRate } = req.query;

  const whereClause: any = {
    verificationStatus: 'VERIFIED',
  };

  if (specialization) {
    whereClause.specialization = {
      has: specialization as string,
    };
  }

  if (maxRate) {
    whereClause.hourlyRate = {
      lte: parseFloat(maxRate as string),
    };
  }

  const cas = await prisma.charteredAccountant.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profileImage: true,
        },
      },
      reviews: {
        select: {
          rating: true,
          comment: true,
          createdAt: true,
          client: {
            select: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      },
    },
  });

  // Calculate average ratings and filter by minRating if specified
  const casWithRatings = cas.map((ca: any) => {
    const totalRating = ca.reviews.reduce((sum: number, review: any) => sum + review.rating, 0);
    const averageRating = ca.reviews.length > 0 ? Math.round((totalRating / ca.reviews.length) * 10) / 10 : 0;

    return {
      ...ca,
      averageRating,
      reviewCount: ca.reviews.length,
    };
  }).filter((ca: any) => {
    if (minRating) {
      return ca.averageRating >= parseFloat(minRating as string);
    }
    return true;
  });

  sendSuccess(res, casWithRatings);
}));

// Get specific CA details
router.get('/chartered-accountants/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const ca = await prisma.charteredAccountant.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profileImage: true,
          createdAt: true,
        },
      },
      reviews: {
        include: {
          client: {
            select: {
              user: {
                select: {
                  name: true,
                  profileImage: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      availabilities: {
        where: {
          date: {
            gte: new Date(),
          },
          isBooked: false,
        },
        orderBy: {
          date: 'asc',
        },
      },
    },
  });

  if (!ca) {
    return sendError(res, 'Chartered Accountant not found', 404);
  }

  // Calculate average rating
  const totalRating = ca.reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = ca.reviews.length > 0 ? Math.round((totalRating / ca.reviews.length) * 10) / 10 : 0;

  sendSuccess(res, {
    ...ca,
    averageRating,
    reviewCount: ca.reviews.length,
  });
}));

export default router;
