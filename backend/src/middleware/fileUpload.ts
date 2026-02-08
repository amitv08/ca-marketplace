import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';
import fs from 'fs';
// SEC-010: Added file-type for robust file type detection
import { fileTypeFromFile } from 'file-type';

// File type configurations
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/plain',
];

const ALLOWED_EXTENSIONS = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'],
};

// Size limits (in bytes)
const MAX_FILE_SIZE = {
  image: 5 * 1024 * 1024, // 5MB
  document: 10 * 1024 * 1024, // 10MB
  default: 5 * 1024 * 1024, // 5MB
};

// Magic numbers for file type validation (first few bytes)
const FILE_SIGNATURES: { [key: string]: number[][] } = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]], // GIF8
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'application/zip': [[0x50, 0x4b, 0x03, 0x04]], // PK.. (also used by docx, xlsx)
};

/**
 * Validate file type against magic numbers
 * SEC-010 FIX: Enhanced with file-type library for robust detection
 */
async function validateFileSignature(filePath: string, mimeType: string): Promise<boolean> {
  try {
    // SEC-010: Use file-type library for comprehensive file type detection
    const detectedType = await fileTypeFromFile(filePath);

    if (!detectedType) {
      // File type could not be determined - check if it's a plain text file
      if (mimeType === 'text/plain') {
        // For text files, basic signature check is sufficient
        return validateBasicSignature(filePath, mimeType);
      }
      console.warn(`Could not determine file type for: ${filePath}`);
      return false;
    }

    // Verify the detected MIME type matches the claimed MIME type
    if (detectedType.mime !== mimeType) {
      // Allow some known compatible types
      const compatibleTypes: { [key: string]: string[] } = {
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['application/zip'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['application/zip'],
        'application/msword': ['application/x-cfb'],
        'application/vnd.ms-excel': ['application/x-cfb'],
      };

      const allowedTypes = compatibleTypes[mimeType] || [];
      if (!allowedTypes.includes(detectedType.mime)) {
        console.warn(`File type mismatch: claimed=${mimeType}, detected=${detectedType.mime}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error validating file signature:', error);
    return false;
  }
}

/**
 * Basic signature validation (fallback for text files)
 */
function validateBasicSignature(filePath: string, mimeType: string): boolean {
  try {
    const signatures = FILE_SIGNATURES[mimeType];
    if (!signatures) {
      return true;
    }

    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    return signatures.some((signature) => {
      return signature.every((byte, index) => buffer[index] === byte);
    });
  } catch (error) {
    console.error('Error in basic signature validation:', error);
    return false;
  }
}

/**
 * Sanitize filename to prevent directory traversal
 */
function sanitizeFilename(filename: string): string {
  // Remove path separators and special characters
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_') // Replace multiple dots
    .substring(0, 255); // Limit length
}

/**
 * Generate unique filename
 */
function generateUniqueFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const sanitized = sanitizeFilename(path.basename(originalFilename, ext));
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  return `${sanitized}_${timestamp}_${randomString}${ext}`;
}

/**
 * File filter function for multer
 */
const fileFilter = (allowedTypes: string[]) => {
  return (_req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    // Check MIME type
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allAllowedExts = [...ALLOWED_EXTENSIONS.images, ...ALLOWED_EXTENSIONS.documents];

    if (!allAllowedExts.includes(ext)) {
      return callback(new Error(`Invalid file extension: ${ext}`));
    }

    callback(null, true);
  };
};

/**
 * Storage configuration for multer
 */
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    const uploadDir = path.join(__dirname, '../../uploads');

    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    callback(null, uploadDir);
  },
  filename: (_req, file, callback) => {
    const uniqueFilename = generateUniqueFilename(file.originalname);
    callback(null, uniqueFilename);
  },
});

/**
 * Image upload middleware
 */
export const imageUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE.image,
    files: 5, // Maximum 5 files
  },
  fileFilter: fileFilter(ALLOWED_IMAGE_TYPES),
}).array('images', 5);

/**
 * Document upload middleware
 */
export const documentUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE.document,
    files: 10, // Maximum 10 documents
  },
  fileFilter: fileFilter(ALLOWED_DOCUMENT_TYPES),
}).array('documents', 10);

/**
 * Single image upload
 */
export const singleImageUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE.image,
  },
  fileFilter: fileFilter(ALLOWED_IMAGE_TYPES),
}).single('image');

/**
 * Single document upload
 */
export const singleDocumentUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE.document,
  },
  fileFilter: fileFilter(ALLOWED_DOCUMENT_TYPES),
}).single('document');

/**
 * Profile image upload (stricter limits)
 */
export const profileImageUpload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB for profile images
  },
  fileFilter: fileFilter(ALLOWED_IMAGE_TYPES),
}).single('profileImage');

/**
 * Post-upload validation middleware
 */
export const validateUploadedFiles = async (
  req: Request,
  res: any,
  next: any
): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    const file = req.file as Express.Multer.File;

    const filesToValidate = files || (file ? [file] : []);

    if (filesToValidate.length === 0) {
      return next();
    }

    // Validate each file's magic number
    for (const uploadedFile of filesToValidate) {
      const isValid = await validateFileSignature(uploadedFile.path, uploadedFile.mimetype);

      if (!isValid) {
        // Delete invalid file
        fs.unlinkSync(uploadedFile.path);

        return res.status(400).json({
          error: 'Invalid file',
          message: `File ${uploadedFile.originalname} failed security validation`,
        });
      }

      // Additional security checks
      if (uploadedFile.size === 0) {
        fs.unlinkSync(uploadedFile.path);
        return res.status(400).json({
          error: 'Invalid file',
          message: 'File is empty',
        });
      }

      // SEC-010: Enhanced security checks
      // Check for double extensions (e.g., file.pdf.exe)
      const fileName = uploadedFile.originalname;
      const extensionCount = (fileName.match(/\./g) || []).length;
      if (extensionCount > 1) {
        const parts = fileName.split('.');
        const lastExt = parts[parts.length - 1].toLowerCase();
        const secondLastExt = parts[parts.length - 2].toLowerCase();

        // Only allow known safe double extensions
        const safeDoubleExtensions = ['tar.gz', 'tar.bz2'];
        const doubleExt = `${secondLastExt}.${lastExt}`;
        if (!safeDoubleExtensions.includes(doubleExt)) {
          fs.unlinkSync(uploadedFile.path);
          return res.status(400).json({
            error: 'Invalid file',
            message: 'Files with multiple extensions are not allowed for security reasons',
          });
        }
      }

      // Check for executable content in the first few KB
      const buffer = Buffer.alloc(4096);
      const fd = fs.openSync(uploadedFile.path, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
      fs.closeSync(fd);

      // Check for executable headers (PE, ELF, Mach-O)
      const executableSignatures = [
        [0x4d, 0x5a], // PE (Windows .exe)
        [0x7f, 0x45, 0x4c, 0x46], // ELF (Linux)
        [0xcf, 0xfa, 0xed, 0xfe], // Mach-O 32-bit
        [0xcf, 0xfa, 0xed, 0xff], // Mach-O 64-bit
      ];

      for (const sig of executableSignatures) {
        let matches = true;
        for (let i = 0; i < sig.length; i++) {
          if (buffer[i] !== sig[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          fs.unlinkSync(uploadedFile.path);
          return res.status(400).json({
            error: 'Invalid file',
            message: 'Executable files are not allowed',
          });
        }
      }

      // Check for suspicious patterns (scripts, macros)
      const content = buffer.slice(0, bytesRead).toString('utf8', 0, Math.min(bytesRead, 1024));
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /on(load|error|click)=/i,
        /eval\(/i,
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          console.warn(`⚠️ Suspicious pattern detected in file: ${uploadedFile.originalname}`);
          // Don't reject for now, just warn (PDFs and docs may contain legitimate scripts)
        }
      }
    }

    next();
  } catch (error) {
    console.error('File validation error:', error);
    res.status(500).json({
      error: 'File validation failed',
      message: 'An error occurred while validating uploaded files',
    });
  }
};

/**
 * Clean up uploaded files on error
 */
export const cleanupUploadedFiles = (req: Request): void => {
  try {
    const files = req.files as Express.Multer.File[];
    const file = req.file as Express.Multer.File;

    const filesToDelete = files || (file ? [file] : []);

    filesToDelete.forEach((uploadedFile) => {
      if (fs.existsSync(uploadedFile.path)) {
        fs.unlinkSync(uploadedFile.path);
      }
    });
  } catch (error) {
    console.error('Error cleaning up files:', error);
  }
};

/**
 * File size validator
 */
export const validateFileSize = (maxSize: number) => {
  return (req: Request, res: any, next: any): void => {
    const files = req.files as Express.Multer.File[];
    const file = req.file as Express.Multer.File;

    const filesToCheck = files || (file ? [file] : []);

    const oversizedFile = filesToCheck.find((f) => f.size > maxSize);

    if (oversizedFile) {
      cleanupUploadedFiles(req);
      return res.status(400).json({
        error: 'File too large',
        message: `File ${oversizedFile.originalname} exceeds maximum size of ${maxSize / 1024 / 1024}MB`,
      });
    }

    next();
  };
};

/**
 * Scan filename for malicious patterns
 */
export const scanFilename = (filename: string): boolean => {
  const maliciousPatterns = [
    /\.exe$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.sh$/i,
    /\.php$/i,
    /\.jsp$/i,
    /\.asp$/i,
    /<script>/i,
    /\.\./,  // Directory traversal
    /[<>:"|?*]/, // Invalid filename characters
  ];

  return maliciousPatterns.some((pattern) => pattern.test(filename));
};

/**
 * Virus scan using ClamAV integration
 * Scans uploaded files for malware and viruses
 */
export const virusScan = async (filePath: string): Promise<boolean> => {
  const { VirusScanService } = await import('../services/virus-scan.service');

  try {
    const result = await VirusScanService.scanFile(filePath);

    if (!result.clean) {
      console.error(`🦠 Virus detected in file: ${filePath}`, {
        virus: result.virus,
        method: result.method,
        message: result.message,
      });

      return false;
    }

    console.log(`✅ File scan clean: ${filePath} (${result.method}, ${result.scanTime}ms)`);
    return true;
  } catch (error) {
    console.error('❌ Virus scan error:', error);
    // Fail-safe: reject file if scan fails
    return false;
  }
};

/**
 * Virus scan middleware - scans uploaded files for malware
 * Use this after multer upload middleware to scan files before processing
 */
export const virusScanMiddleware = async (
  req: Request,
  res: any,
  next: any
): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    const file = req.file as Express.Multer.File;

    const filesToScan = files || (file ? [file] : []);

    if (filesToScan.length === 0) {
      // No files uploaded, proceed
      return next();
    }

    console.log(`🔍 Scanning ${filesToScan.length} file(s) for viruses...`);

    // Scan each file
    for (const uploadedFile of filesToScan) {
      const isClean = await virusScan(uploadedFile.path);

      if (!isClean) {
        // Delete infected file immediately
        if (fs.existsSync(uploadedFile.path)) {
          fs.unlinkSync(uploadedFile.path);
        }

        // Clean up any other uploaded files in this request
        cleanupUploadedFiles(req);

        return res.status(400).json({
          success: false,
          error: 'File rejected',
          message: `File "${uploadedFile.originalname}" failed virus scan and has been rejected for security reasons`,
        });
      }
    }

    console.log(`✅ All files passed virus scan`);
    next();
  } catch (error) {
    console.error('❌ Virus scan middleware error:', error);

    // Delete all uploaded files on error
    cleanupUploadedFiles(req);

    res.status(500).json({
      success: false,
      error: 'Scan failed',
      message: 'File virus scan failed - all files rejected for safety',
    });
  }
};
