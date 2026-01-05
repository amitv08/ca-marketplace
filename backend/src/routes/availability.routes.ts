import { Router, Request, Response } from 'express';
import { prisma } from '../config';
import { asyncHandler, authenticate, validateBody, authorize } from '../middleware';
import { sendSuccess, sendCreated, sendError } from '../utils';

const router = Router();

// Create availability slot (CA only)
const createAvailabilitySchema = {
  date: { required: true, type: 'string' as const },
  startTime: { required: true, type: 'string' as const },
  endTime: { required: true, type: 'string' as const },
};

router.post('/', authenticate, authorize('CA'), validateBody(createAvailabilitySchema), asyncHandler(async (req: Request, res: Response) => {
  const { date, startTime, endTime } = req.body;

  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  // Parse times
  const slotDate = new Date(date);
  const start = new Date(`1970-01-01T${startTime}`);
  const end = new Date(`1970-01-01T${endTime}`);

  if (start >= end) {
    return sendError(res, 'End time must be after start time', 400);
  }

  // Check for overlapping slots
  const overlapping = await prisma.availability.findFirst({
    where: {
      caId: ca.id,
      date: slotDate,
      OR: [
        {
          AND: [
            { startTime: { lte: start } },
            { endTime: { gt: start } },
          ],
        },
        {
          AND: [
            { startTime: { lt: end } },
            { endTime: { gte: end } },
          ],
        },
      ],
    },
  });

  if (overlapping) {
    return sendError(res, 'Time slot overlaps with existing availability', 400);
  }

  const availability = await prisma.availability.create({
    data: {
      caId: ca.id,
      date: slotDate,
      startTime: start,
      endTime: end,
    },
  });

  sendCreated(res, availability, 'Availability slot created successfully');
}));

// Get CA's own availability
router.get('/my-availability', authenticate, authorize('CA'), asyncHandler(async (req: Request, res: Response) => {
  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  const { from, to } = req.query;

  const where: any = { caId: ca.id };

  if (from) {
    where.date = { ...where.date, gte: new Date(from as string) };
  }

  if (to) {
    where.date = { ...where.date, lte: new Date(to as string) };
  }

  const availability = await prisma.availability.findMany({
    where,
    orderBy: [
      { date: 'asc' },
      { startTime: 'asc' },
    ],
  });

  sendSuccess(res, availability);
}));

// Get availability for a specific CA
router.get('/ca/:caId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { caId } = req.params;
  const { from, to, availableOnly } = req.query;

  const where: any = { caId };

  // Only show future dates by default
  if (!from) {
    where.date = { gte: new Date() };
  } else {
    where.date = { gte: new Date(from as string) };
  }

  if (to) {
    where.date = { ...where.date, lte: new Date(to as string) };
  }

  if (availableOnly === 'true') {
    where.isBooked = false;
  }

  const availability = await prisma.availability.findMany({
    where,
    orderBy: [
      { date: 'asc' },
      { startTime: 'asc' },
    ],
  });

  sendSuccess(res, availability);
}));

// Update availability slot
const updateAvailabilitySchema = {
  startTime: { type: 'string' as const },
  endTime: { type: 'string' as const },
  isBooked: { type: 'boolean' as const },
};

router.patch('/:id', authenticate, authorize('CA'), validateBody(updateAvailabilitySchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startTime, endTime, isBooked } = req.body;

  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  const slot = await prisma.availability.findUnique({
    where: { id },
  });

  if (!slot) {
    return sendError(res, 'Availability slot not found', 404);
  }

  if (slot.caId !== ca.id) {
    return sendError(res, 'Access denied', 403);
  }

  const updateData: any = {};

  if (startTime) {
    updateData.startTime = new Date(`1970-01-01T${startTime}`);
  }

  if (endTime) {
    updateData.endTime = new Date(`1970-01-01T${endTime}`);
  }

  if (isBooked !== undefined) {
    updateData.isBooked = isBooked;
  }

  const updated = await prisma.availability.update({
    where: { id },
    data: updateData,
  });

  sendSuccess(res, updated, 'Availability slot updated successfully');
}));

// Delete availability slot
router.delete('/:id', authenticate, authorize('CA'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const ca = await prisma.charteredAccountant.findUnique({
    where: { userId: req.user!.userId },
  });

  if (!ca) {
    return sendError(res, 'CA profile not found', 404);
  }

  const slot = await prisma.availability.findUnique({
    where: { id },
  });

  if (!slot) {
    return sendError(res, 'Availability slot not found', 404);
  }

  if (slot.caId !== ca.id) {
    return sendError(res, 'Access denied', 403);
  }

  if (slot.isBooked) {
    return sendError(res, 'Cannot delete booked availability slot', 400);
  }

  await prisma.availability.delete({
    where: { id },
  });

  sendSuccess(res, null, 'Availability slot deleted successfully');
}));

export default router;
