import { diskStorage } from 'multer';
import { extname } from 'node:path';
import { BadRequestException } from '@nestjs/common';

// Banner image upload configuration
export const offerBannerUploadOptions = {
  storage: diskStorage({
    destination: './uploads/offers/banners',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      cb(null, `banner-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Invalid file type. Only JPEG, PNG, and WebP images are allowed for banners.',
        ),
        false,
      );
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
};

// Gallery images upload configuration
export const offerGalleryUploadOptions = {
  storage: diskStorage({
    destination: './uploads/offers/gallery',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      cb(null, `gallery-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Invalid file type. Only JPEG, PNG, and WebP images are allowed for gallery.',
        ),
        false,
      );
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per image
    files: 10, // Maximum 10 images
  },
};

// Video upload configuration
export const offerVideoUploadOptions = {
  storage: diskStorage({
    destination: './uploads/offers/videos',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      cb(null, `video-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Invalid file type. Only MP4, MOV, and AVI videos are allowed.',
        ),
        false,
      );
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
};
