import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Request,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { TalentService } from './talent.service';
import { UpdateTalentProfileDto } from './dto/update-talent-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { profileImageUploadOptions } from '../common/utils/profile-image-upload.config';
import { cvUploadOptions } from '../common/utils/cv-upload.config';
import { diskStorage } from 'multer';

@ApiTags('talent')
@Controller('talent')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TalentController {
  constructor(private readonly talentService: TalentService) {}

  @Get('profile')
  @Roles('talent')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get talent profile',
    description: 'Retrieves the profile information of the authenticated talent.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    schema: {
      example: {
        message: 'Profile retrieved successfully',
        user: {
          _id: '673ab2c3e8f9a1234567890c',
          fullName: 'John Doe',
          email: 'john.doe@example.com',
          role: 'talent',
          phone: '+1234567890',
          location: 'New York, USA',
          talent: 'Singer',
          skills: ['Vocal Performance', 'Songwriting', 'Guitar'],
          description: 'Professional singer with 10 years of experience',
          profileImage: 'uploads/profile/profile-1731504922456-123456789.jpg',
          createdAt: '2025-11-13T12:35:22.456Z',
          updatedAt: '2025-11-13T15:20:10.123Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a talent',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User does not exist',
  })
  async getProfile(@Request() req: any) {
    const userId = req.user.id;
    return this.talentService.getProfile(userId);
  }

  @Put('profile')
  @Roles('talent')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update talent profile',
    description:
      'Allows authenticated talents to update their profile information including full name, email, phone, location, talent category, skills, description, and profile image. Only provided fields will be updated (partial update). Profile image must be PNG, JPG, or JPEG format. Skills array cannot exceed 10 items.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: {
          type: 'string',
          example: 'John Doe',
          description: 'Full name of the talent',
        },
        email: {
          type: 'string',
          example: 'john.doe@example.com',
          description: 'Email address (must be unique)',
        },
        phone: {
          type: 'string',
          example: '+1234567890',
          description: 'Phone number',
        },
        location: {
          type: 'string',
          example: 'New York, USA',
          description: 'Location/address',
        },
        talent: {
          type: 'string',
          example: 'Singer',
          description: 'Talent category (e.g., singer, designer, actor)',
        },
        skills: {
          type: 'array',
          items: {
            type: 'string',
          },
          example: ['Vocal Performance', 'Songwriting', 'Guitar'],
          description: 'Array of skills (maximum 10 items)',
        },
        description: {
          type: 'string',
          example: 'Professional singer with 10 years of experience in live performances',
          description: 'Profile description or bio',
        },
        profileImage: {
          type: 'string',
          format: 'binary',
          description: 'Profile image file (PNG, JPG, JPEG only)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    schema: {
      example: {
        message: 'Profile updated successfully',
        user: {
          _id: '673ab2c3e8f9a1234567890c',
          fullName: 'John Doe',
          email: 'john.doe@example.com',
          role: 'talent',
          phone: '+1234567890',
          location: 'New York, USA',
          talent: 'Singer',
          skills: ['Vocal Performance', 'Songwriting', 'Guitar'],
          description: 'Professional singer with 10 years of experience',
          profileImage: 'uploads/profile/profile-1731504922456-123456789.jpg',
          createdAt: '2025-11-13T12:35:22.456Z',
          updatedAt: '2025-11-13T15:20:10.123Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Email already in use, invalid file type, or skills array too large',
    schema: {
      example: {
        statusCode: 400,
        message: 'Email already in use by another account',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a talent',
    schema: {
      example: {
        statusCode: 403,
        message: 'Only talents can access this endpoint',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User does not exist',
    schema: {
      example: {
        statusCode: 404,
        message: 'User not found',
        error: 'Not Found',
      },
    },
  })
  @UseInterceptors(FileInterceptor('profileImage', profileImageUploadOptions))
  async updateProfile(
    @Request() req: any,
    @Body() updateDto: UpdateTalentProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user.id;
    const profileImagePath = file ? file.path : undefined;

    return this.talentService.updateProfile(userId, updateDto, profileImagePath);
  }

  // 🔍 Lire le profil du talent connecté (kept for backward compatibility)
  @Get('me')
  @Roles('talent')
  async getProfileLegacy(@Request() req: any) {
    return this.talentService.getProfile(req.user.id);
  }

  // 📸 Upload de la photo de profil (kept for backward compatibility)
  @Post('upload-profile')
  @Roles('talent')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/profile',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${file.originalname}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async uploadProfileImage(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    const imageUrl = `/uploads/profile/${file.filename}`;
    return this.talentService.updateProfileImage(req.user.id, imageUrl);
  }

  // 🖼️ Upload de la bannière (kept for backward compatibility)
  @Post('upload-banner')
  @Roles('talent')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/banner',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${file.originalname}`;
          cb(null, uniqueName);
        },
      }),
    }),
  )
  async uploadBanner(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    const bannerUrl = `/uploads/banner/${file.filename}`;
    return this.talentService.updateBannerImage(req.user.id, bannerUrl);
  }

  // 📄 Upload du CV
  @Post('upload-cv')
  @Roles('talent')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload CV file',
    description: 'Allows authenticated talents to upload a CV file (PDF, DOC, or DOCX format). The CV URL will be saved in the talent profile.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CV file (PDF, DOC, or DOCX only, max 10MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'CV uploaded successfully',
    schema: {
      example: {
        message: 'CV uploaded successfully',
        cvUrl: 'uploads/cv/cv-1731504922456-123456789.pdf',
        user: {
          _id: '673ab2c3e8f9a1234567890c',
          fullName: 'John Doe',
          email: 'john.doe@example.com',
          role: 'talent',
          cvUrl: 'uploads/cv/cv-1731504922456-123456789.pdf',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid file type or file too large',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a talent',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User does not exist',
  })
  @UseInterceptors(FileInterceptor('file', cvUploadOptions))
  async uploadCv(@Request() req: any, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('CV file is required');
    }
    const cvUrl = file.path;
    return this.talentService.updateCvUrl(req.user.id, cvUrl);
  }

  @Get('stats')
  @Roles('talent')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get talent proposal statistics',
    description: 'Retrieves aggregated proposal statistics (sent, accepted, refused) for the authenticated talent within a specified time period.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      example: {
        totalProposalsSent: 15,
        totalProposalsAccepted: 8,
        totalProposalsRefused: 3,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a talent',
  })
  async getStats(
    @Request() req: any,
    @Query('days') days?: string,
  ) {
    const userId = req.user.id;
    
    // Default to 7 days if not specified
    const daysNumber = days ? parseInt(days, 10) : 7;
    
    // Validate days parameter
    if (isNaN(daysNumber) || daysNumber < 1) {
      throw new BadRequestException('Invalid days parameter. Must be a positive number.');
    }
    
    
  }}
