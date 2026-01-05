import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';
import { AppError } from './errorHandler';

// Create uploads directory path
const uploadsDir = path.join(__dirname, '../../uploads');

// Allowed file types
const ALLOWED_FILE_TYPES = [
  'application/pdf',                                                      // PDF
  'application/msword',                                                   // DOC
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.ms-excel',                                            // XLS
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',   // XLSX
  'image/jpeg',                                                          // JPG/JPEG
  'image/png',                                                           // PNG
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Configure storage
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  },
});

// File filter
const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  if (ALLOWED_FILE_TYPES.includes(mimeType) && ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError(
      `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
      400
    ));
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// Helper function to handle multer errors
export const handleUploadError = (error: any): AppError => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new AppError('File size exceeds 10MB limit', 400);
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return new AppError('Unexpected file field', 400);
    }
    return new AppError(`Upload error: ${error.message}`, 400);
  }

  if (error instanceof AppError) {
    return error;
  }

  return new AppError('File upload failed', 500);
};

// Export upload directory path for serving static files
export { uploadsDir };
