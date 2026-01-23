import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { asyncHandler, validateBody, authenticate, generateToken } from '../middleware';
import { sendSuccess, sendCreated, sendError, hashPassword, comparePassword, sanitizeUser } from '../utils';
import { isValidEmail } from '../middleware';

const router = Router();

// Register new user
const registerSchema = {
  email: { required: true, type: 'string' as const, custom: isValidEmail },
  password: { required: true, type: 'string' as const, min: 8, max: 100 },
  name: { required: true, type: 'string' as const, min: 2, max: 100 },
  phone: { type: 'string' as const, min: 10, max: 15 },
  role: { required: true, type: 'string' as const },
};

router.post('/register', validateBody(registerSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name, phone, role } = req.body;

  // Validate role
  if (!['CLIENT', 'CA'].includes(role)) {
    return sendError(res, 'Role must be CLIENT or CA', 400);
  }

  // Check if user exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return sendError(res, 'Email already registered', 400);
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      phone,
      role,
    },
  });

  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const userData = sanitizeUser(user);

  sendCreated(res, {
    user: userData,
    token,
  }, 'User registered successfully');
}));

// Login
const loginSchema = {
  email: { required: true, type: 'string' as const, custom: isValidEmail },
  password: { required: true, type: 'string' as const },
};

router.post('/login', validateBody(loginSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Find user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return sendError(res, 'Invalid email or password', 401);
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    return sendError(res, 'Invalid email or password', 401);
  }

  // Get CA/Client ID for token
  let caId: string | undefined;
  let clientId: string | undefined;

  if (user.role === 'CA') {
    const ca = await prisma.charteredAccountant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    caId = ca?.id;
  } else if (user.role === 'CLIENT') {
    const client = await prisma.client.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    clientId = client?.id;
  }

  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    caId,
    clientId,
  });

  const userData = sanitizeUser(user);

  sendSuccess(res, {
    user: userData,
    token,
  }, 'Login successful');
}));

// Get current user
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: {
      client: true,
      charteredAccountant: true,
    },
  });

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  const userData = sanitizeUser(user);
  sendSuccess(res, userData);
}));

// Logout (client-side token removal, but can be extended with token blacklist)
router.post('/logout', authenticate, asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, null, 'Logout successful');
}));

export default router;
