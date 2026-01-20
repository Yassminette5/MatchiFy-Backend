import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Param,
  Query,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RecruiterService } from './recruiter.service';
import { UpdateRecruiterProfileDto } from './dto/update-recruiter-profile.dto';
import { profileImageUploadOptions } from '../common/utils/profile-image-upload.config';
import { ProposalsService } from '../proposals/proposals.service';

@ApiTags('recruiter')
@Controller('recruiter')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecruiterController {
  constructor(
    private readonly recruiterService: RecruiterService,
    private readonly proposalsService: ProposalsService,
  ) {}

  @Get('profile')
  @Roles('recruiter')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get recruiter profile',
    description: 'Retrieves the profile information of the authenticated recruiter.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    schema: {
      example: {
        message: 'Profile retrieved successfully',
        user: {
          _id: '673ab2c3e8f9a1234567890b',
          fullName: 'Jane Smith',
          email: 'jane.smith@company.com',
          role: 'recruiter',
          phone: '+1234567890',
          location: 'San Francisco, CA',
          description: 'Experienced tech recruiter specializing in software engineering roles',
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
    description: 'Forbidden - User is not a recruiter',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User does not exist',
  })
  async getProfile(@Request() req: any) {
    const userId = req.user.id;
    return this.recruiterService.getProfile(userId);
  }

  @Put('profile')
  @Roles('recruiter')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update recruiter profile',
    description:
      'Allows authenticated recruiters to update their profile information including full name, email, phone, location, and profile image. Only provided fields will be updated (partial update). Profile image must be PNG, JPG, or JPEG format.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: {
          type: 'string',
          example: 'Jane Smith',
          description: 'Full name of the recruiter',
        },
        email: {
          type: 'string',
          example: 'jane.smith@company.com',
          description: 'Email address (must be unique)',
        },
        phone: {
          type: 'string',
          example: '+1234567890',
          description: 'Phone number',
        },
        location: {
          type: 'string',
          example: 'San Francisco, CA',
          description: 'Location/address',
        },
        description: {
          type: 'string',
          example: 'Experienced tech recruiter specializing in software engineering roles',
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
          _id: '673ab2c3e8f9a1234567890b',
          fullName: 'Jane Smith',
          email: 'jane.smith@company.com',
          role: 'recruiter',
          phone: '+1234567890',
          location: 'San Francisco, CA',
          description: 'Experienced tech recruiter specializing in software engineering roles',
          profileImage: 'uploads/profile/profile-1731504922456-123456789.jpg',
          createdAt: '2025-11-13T12:35:22.456Z',
          updatedAt: '2025-11-13T15:20:10.123Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Email already in use or invalid file type',
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
    description: 'Forbidden - User is not a recruiter',
    schema: {
      example: {
        statusCode: 403,
        message: 'Only recruiters can access this endpoint',
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
    @Body() updateDto: UpdateRecruiterProfileDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const userId = req.user.id;
    const profileImagePath = file ? file.path : undefined;

    return this.recruiterService.updateProfile(
      userId,
      updateDto,
      profileImagePath
    );
  }

  @Get('missions')
  @Roles('recruiter')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get recruiter missions',
    description:
      'Retrieves all missions created by the authenticated recruiter. Returns simplified mission list with ID and title for mission selector.',
  })
  @ApiResponse({
    status: 200,
    description: 'Missions retrieved successfully',
    schema: {
      example: [
        {
          _id: '673ab2c3e8f9a1234567890a',
          title: 'Full Stack Developer Needed',
          createdAt: '2025-11-20T10:00:00.000Z',
          unviewedCount: 2,
        },
        {
          _id: '673ab2c3e8f9a1234567890b',
          title: 'Senior React Developer',
          createdAt: '2025-11-21T14:30:00.000Z',
          unviewedCount: 0,
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a recruiter',
  })
  async getRecruiterMissions(@Request() req: any) {
    const recruiterId = req.user.id;
    return this.recruiterService.getRecruiterMissions(recruiterId);
  }

  @Get('proposals/mission/:missionId')
  @Roles('recruiter')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get proposals for a mission with optional AI sorting',
    description:
      'Retrieves all proposals for a specific mission. When sort=ai query parameter is provided, proposals are sorted by AI compatibility score (highest first). Otherwise, sorted by creation date (newest first).',
  })
  @ApiResponse({
    status: 200,
    description: 'Proposals retrieved successfully',
    schema: {
      example: {
        mission: {
          _id: '673ab2c3e8f9a1234567890a',
          title: 'Full Stack Developer Needed',
          description: 'Looking for an experienced developer...',
          skills: ['React', 'Node.js', 'MongoDB'],
          budget: 5000,
          duration: '3 months',
        },
        proposals: [
          {
            _id: '673ab2c3e8f9a1234567890c',
            missionId: '673ab2c3e8f9a1234567890a',
            talentId: '673ab2c3e8f9a1234567890d',
            message: 'I am interested in this project',
            proposalContent: 'Detailed proposal content...',
            status: 'NOT_VIEWED',
            aiScore: 85,
            talent: {
              fullName: 'John Doe',
              email: 'john@example.com',
              skills: ['React', 'Node.js'],
              mainTalent: 'Full Stack Developer',
            },
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Recruiter does not own this mission',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Mission does not exist',
  })
  async getProposalsForMission(
    @Request() req: any,
    @Param('missionId') missionId: string,
    @Query('sort') sort?: string,
  ) {
    const recruiterId = req.user.id;
    const useAiSort = sort === 'ai';
    return this.proposalsService.findByMissionWithAiSort(
      recruiterId,
      missionId,
      useAiSort,
    );
  }

  @Get('proposals')
  @Roles('recruiter')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search proposals by mission title',
    description:
      'Searches for missions by title (case-insensitive partial match) and returns proposals for matching missions. Only searches missions created by the authenticated recruiter.',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    schema: {
      example: [
        {
          mission: {
            _id: '673ab2c3e8f9a1234567890a',
            title: 'Full Stack Developer Needed',
            description: 'Looking for an experienced developer...',
          },
          proposalCount: 3,
          proposals: [
            {
              _id: '673ab2c3e8f9a1234567890c',
              missionId: '673ab2c3e8f9a1234567890a',
              talentId: '673ab2c3e8f9a1234567890d',
              message: 'I am interested',
              status: 'NOT_VIEWED',
              talent: {
                fullName: 'John Doe',
                email: 'john@example.com',
              },
            },
          ],
        },
      ],
    },
  })
  async searchProposalsByMissionTitle(
    @Request() req: any,
    @Query('title') title?: string,
  ) {
    const recruiterId = req.user.id;
    if (!title) {
      return [];
    }
    return this.proposalsService.findByMissionTitle(recruiterId, title);
  }
}
