import { diskStorage } from 'multer';
import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';

// Allowed media extensions for portfolio (images, videos, and PDFs)
const allowedImageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const allowedVideoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const allowedPdfExtensions = ['.pdf'];
const allowedPortfolioExtensions = [...allowedImageExtensions, ...allowedVideoExtensions, ...allowedPdfExtensions];

// File filter for portfolio media validation (images, videos, PDFs)
export const portfolioMediaFileFilter = (req: any, file: Express.Multer.File, callback: any) => {
  const ext = extname(file.originalname).toLowerCase();
  
  if (!allowedPortfolioExtensions.includes(ext)) {
    return callback(
      new BadRequestException(
        `Invalid file type. Only ${allowedPortfolioExtensions.join(', ')} files are allowed`
      ),
      false
    );
  }
  
  callback(null, true);
};

// Storage configuration for portfolio media
export const portfolioMediaStorage = diskStorage({
  destination: (req, file, callback) => {
    const ext = extname(file.originalname).toLowerCase();
    let destination = './uploads/portfolio';
    
    if (allowedImageExtensions.includes(ext)) {
      destination = './uploads/portfolio/images';
    } else if (allowedVideoExtensions.includes(ext)) {
      destination = './uploads/portfolio/videos';
    } else if (allowedPdfExtensions.includes(ext)) {
      destination = './uploads/portfolio/pdfs';
    }
    
    callback(null, destination);
  },
  filename: (req, file, callback) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname).toLowerCase();
    let prefix = 'file';
    if (allowedImageExtensions.includes(ext)) {
      prefix = 'image';
    } else if (allowedVideoExtensions.includes(ext)) {
      prefix = 'video';
    } else if (allowedPdfExtensions.includes(ext)) {
      prefix = 'pdf';
    }
    const filename = `portfolio-${prefix}-${uniqueSuffix}${ext}`;
    callback(null, filename);
  },
});

// Multer options for portfolio media upload (supports multiple files)
export const portfolioMediaUploadOptions = {
  storage: portfolioMediaStorage,
  fileFilter: portfolioMediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size per file
  },
};
