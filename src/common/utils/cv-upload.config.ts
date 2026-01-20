import { diskStorage } from 'multer';
import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';

// Allowed CV extensions (PDF, DOC, DOCX)
const allowedCvExtensions = ['.pdf', '.doc', '.docx'];

// File filter for CV validation
export const cvFileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  const ext = extname(file.originalname).toLowerCase();
  
  if (!allowedCvExtensions.includes(ext)) {
    return callback(
      new BadRequestException(
        `Invalid file type. Only ${allowedCvExtensions.join(', ')} files are allowed`
      ),
      false
    );
  }
  
  callback(null, true);
};

// Storage configuration for CV files
export const cvStorage = diskStorage({
  destination: './uploads/cv',
  filename: (req, file, callback) => {
    // Generate unique filename: timestamp-randomstring.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname).toLowerCase();
    const filename = `cv-${uniqueSuffix}${ext}`;
    callback(null, filename);
  },
});

// Multer options for CV upload
export const cvUploadOptions = {
  storage: cvStorage,
  fileFilter: cvFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
};
