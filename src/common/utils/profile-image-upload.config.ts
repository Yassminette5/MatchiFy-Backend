import { diskStorage } from 'multer';
import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';

// Allowed image extensions
const allowedExtensions = ['.png', '.jpg', '.jpeg'];

// File filter for image validation
export const imageFileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  const ext = extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return callback(
      new BadRequestException(
        `Invalid file type. Only ${allowedExtensions.join(', ')} files are allowed`
      ),
      false
    );
  }
  
  callback(null, true);
};

// Storage configuration for profile images
export const profileImageStorage = diskStorage({
  destination: './uploads/profile',
  filename: (req, file, callback) => {
    // Generate unique filename: timestamp-randomstring.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname).toLowerCase();
    const filename = `profile-${uniqueSuffix}${ext}`;
    callback(null, filename);
  },
});

// Multer options for profile image upload
export const profileImageUploadOptions = {
  storage: profileImageStorage,
  fileFilter: imageFileFilter,
};
