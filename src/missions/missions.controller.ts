import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MissionsService } from './missions.service';
import { BestMatchService } from './services/best-match.service';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { Observable } from 'rxjs';

import { Inject, forwardRef } from '@nestjs/common';

@ApiTags('missions')
@Controller('missions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MissionsController {
  constructor(
    private readonly missionsService: MissionsService,
    private readonly bestMatchService: BestMatchService,
    
  ) {}

  @Post()
  @Roles('recruiter', 'talent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new mission offer',
    description:
      'Allows authenticated recruiters to create a new mission offer. The mission will be automatically associated with the authenticated recruiter. All fields are required: title, description, duration, budget, and skills.',
  })
  @ApiBody({
    type: CreateMissionDto,
    description: 'Mission offer data',
    examples: {
      example1: {
        summary: 'Example mission offer',
        value: {
          title: 'Développeur Full Stack React/Node.js',
          description:
            'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe et travailler sur des projets innovants utilisant React et Node.js.',
          duration: '6 mois',
          budget: 50000,
          skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Express'],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Mission created successfully',
    schema: {
      example: {
        _id: '673ab2c3e8f9a1234567890c',
        title: 'Développeur Full Stack React/Node.js',
        description:
          'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe et travailler sur des projets innovants utilisant React et Node.js.',
        duration: '6 mois',
        budget: 50000,
        skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Express'],
        recruiterId: '673ab2c3e8f9a1234567890b',
        createdAt: '2025-01-15T10:30:00.000Z',
        updatedAt: '2025-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation error',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'Title is required',
          'Description is required',
          'Budget must be a number',
        ],
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
        message: 'Access denied for role: talent',
        error: 'Forbidden',
      },
    },
  })
  async create(
    @Request() req: any,
    @Body() createMissionDto: CreateMissionDto
  ) {
    const recruiterId = req.user.id;
    return this.missionsService.create(createMissionDto, recruiterId);
  }

  @Get('all')
  @Roles('recruiter', 'talent')
  @ApiOperation({
    summary: 'Get all mission offers (all recruiters)',
    description:
      'Retrieves all mission offers from all recruiters. Results are sorted by creation date (newest first).',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all mission offers retrieved successfully',
    schema: {
      example: [
        {
          _id: '673ab2c3e8f9a1234567890c',
          title: 'Développeur Full Stack React/Node.js',
          description:
            'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe et travailler sur des projets innovants utilisant React et Node.js.',
          duration: '6 mois',
          budget: 50000,
          skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Express'],
          recruiterId: '673ab2c3e8f9a1234567890b',
          createdAt: '2025-01-15T10:30:00.000Z',
          updatedAt: '2025-01-15T10:30:00.000Z',
        },
      ],
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
    description: 'Forbidden - User role not allowed',
    schema: {
      example: {
        statusCode: 403,
        message: 'Access denied: insufficient role',
        error: 'Forbidden',
      },
    },
  })
  async findAllMissions(@Request() req: any) {
    const talentId = req.user.role === 'talent' ? req.user.id : undefined;
    return this.missionsService.findAll(talentId);
  }

  @Sse('stream')
  @Roles('recruiter', 'talent')
  @ApiOperation({
    summary: 'Subscribe to mission updates',
    description:
      'Server-Sent Events stream that broadcasts mission creations, updates, and deletions in real time.',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream started',
  })
  missionUpdates(): Observable<MessageEvent> {
    return this.missionsService.getMissionUpdates();
  }

  @Get()
  @Roles('recruiter', 'talent')
  @ApiOperation({
    summary: 'Get all mission offers for the authenticated recruiter',
    description:
      'Retrieves all mission offers created by the authenticated recruiter. Results are sorted by creation date (newest first). For talents, includes isFavorite status.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of mission offers retrieved successfully',
    schema: {
      example: [
        {
          _id: '673ab2c3e8f9a1234567890c',
          title: 'Développeur Full Stack React/Node.js',
          description:
            'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe et travailler sur des projets innovants utilisant React et Node.js.',
          duration: '6 mois',
          budget: 50000,
          skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Express'],
          recruiterId: '673ab2c3e8f9a1234567890b',
          createdAt: '2025-01-15T10:30:00.000Z',
          updatedAt: '2025-01-15T10:30:00.000Z',
        },
        {
          _id: '673ab2c3e8f9a1234567890d',
          title: 'Designer UX/UI',
          description: 'Recherche d un designer UX/UI créatif pour notre équipe produit.',
          duration: '3 mois',
          budget: 35000,
          skills: ['Figma', 'Adobe XD', 'User Research', 'Prototyping'],
          recruiterId: '673ab2c3e8f9a1234567890b',
          createdAt: '2025-01-14T14:20:00.000Z',
          updatedAt: '2025-01-14T14:20:00.000Z',
        },
      ],
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
        message: 'Access denied for role: talent',
        error: 'Forbidden',
      },
    },
  })
  async findAll(@Request() req: any) {
    const recruiterId = req.user.id;
    const talentId = req.user.role === 'talent' ? req.user.id : undefined;
    return this.missionsService.findAllByRecruiter(recruiterId, talentId);
  }

  @Get('best-match')
  @Roles('talent')
  @ApiOperation({
    summary: 'Get best match missions for talent',
    description:
      'Returns top 20 missions ranked by AI match score based on talent profile analysis. Results are cached for 12 hours.',
  })
  @ApiResponse({
    status: 200,
    description: 'Best match missions retrieved successfully',
    schema: {
      example: {
        missions: [
          {
            missionId: '673ab2c3e8f9a1234567890c',
            title: 'Développeur Full Stack React/Node.js',
            description:
              'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe.',
            matchScore: 85,
            reasoning:
              'Strong match: Your React and Node.js experience aligns perfectly with the mission requirements.',
          },
        ],
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
  async getBestMatches(@Request() req: any) {
    const talentId = req.user.id;
    const missions = await this.bestMatchService.getBestMatches(talentId);
    return { missions };
  }

  @Get(':id')
  @Roles('recruiter', 'talent')
  @ApiOperation({
    summary: 'Get a single mission offer by ID',
    description:
      'Retrieves a specific mission offer by its ID. The mission must belong to the authenticated recruiter.',
  })
  @ApiParam({
    name: 'id',
    description: 'Mission ID',
    example: '673ab2c3e8f9a1234567890c',
  })
  @ApiResponse({
    status: 200,
    description: 'Mission offer retrieved successfully',
    schema: {
      example: {
        _id: '673ab2c3e8f9a1234567890c',
        title: 'Développeur Full Stack React/Node.js',
        description:
          'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe et travailler sur des projets innovants utilisant React et Node.js.',
        duration: '6 mois',
        budget: 50000,
        price: 50000,
        skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Express'],
        recruiterId: '673ab2c3e8f9a1234567890b',
        missionId: '673ab2c3e8f9a1234567890c',
        ownerId: '673ab2c3e8f9a1234567890b',
        proposalsCount: 12,
        interviewingCount: 3,
        createdAt: '2025-01-15T10:30:00.000Z',
        updatedAt: '2025-01-15T10:30:00.000Z',
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
        message: 'Access denied for role: talent',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Mission does not exist',
    schema: {
      example: {
        statusCode: 404,
        message: 'Mission with ID 673ab2c3e8f9a1234567890c not found',
        error: 'Not Found',
      },
    },
  })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const talentId = req.user.role === 'talent' ? req.user.id : undefined;
    const mission = await this.missionsService.findOne(id, talentId);
    
    // Add hasApplied field for talents
  
    
    return mission;
  }

  @Put(':id')
  @Roles('recruiter')
  @ApiOperation({
    summary: 'Update a mission offer',
    description:
      'Allows the owner recruiter to update their mission offer. All fields are optional - only provided fields will be updated. The recruiter must be the owner of the mission.',
  })
  @ApiParam({
    name: 'id',
    description: 'Mission ID',
    example: '673ab2c3e8f9a1234567890c',
  })
  @ApiBody({
    type: UpdateMissionDto,
    description: 'Mission offer data to update',
    examples: {
      example1: {
        summary: 'Partial update example',
        value: {
          budget: 60000,
          duration: '12 mois',
        },
      },
      example2: {
        summary: 'Full update example',
        value: {
          title: 'Développeur Full Stack React/Node.js - Mise à jour',
          description:
            'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe et travailler sur des projets innovants utilisant React et Node.js. Mission en télétravail possible.',
          duration: '12 mois',
          budget: 60000,
          skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Express', 'Docker'],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Mission updated successfully',
    schema: {
      example: {
        _id: '673ab2c3e8f9a1234567890c',
        title: 'Développeur Full Stack React/Node.js - Mise à jour',
        description:
          'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe et travailler sur des projets innovants utilisant React et Node.js. Mission en télétravail possible.',
        duration: '12 mois',
        budget: 60000,
        skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Express', 'Docker'],
        recruiterId: '673ab2c3e8f9a1234567890b',
        createdAt: '2025-01-15T10:30:00.000Z',
        updatedAt: '2025-01-15T15:45:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation error',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'Budget must be a number',
        ],
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
    description: 'Forbidden - User is not a recruiter or not the owner',
    schema: {
      example: {
        statusCode: 403,
        message: 'You do not have permission to update this mission',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Mission does not exist',
    schema: {
      example: {
        statusCode: 404,
        message: 'Mission with ID 673ab2c3e8f9a1234567890c not found',
        error: 'Not Found',
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updateMissionDto: UpdateMissionDto
  ) {
    const recruiterId = req.user.id;
    return this.missionsService.update(id, updateMissionDto, recruiterId);
  }

  @Delete(':id')
  @Roles('recruiter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a mission offer',
    description:
      'Allows the owner recruiter to delete their mission offer. This is a physical deletion (the mission will be permanently removed from the database). The recruiter must be the owner of the mission.',
  })
  @ApiParam({
    name: 'id',
    description: 'Mission ID',
    example: '673ab2c3e8f9a1234567890c',
  })
  @ApiResponse({
    status: 200,
    description: 'Mission deleted successfully',
    schema: {
      example: {
        _id: '673ab2c3e8f9a1234567890c',
        title: 'Développeur Full Stack React/Node.js',
        description:
          'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe et travailler sur des projets innovants utilisant React et Node.js.',
        duration: '6 mois',
        budget: 50000,
        skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Express'],
        recruiterId: '673ab2c3e8f9a1234567890b',
        createdAt: '2025-01-15T10:30:00.000Z',
        updatedAt: '2025-01-15T10:30:00.000Z',
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
    description: 'Forbidden - User is not a recruiter or not the owner',
    schema: {
      example: {
        statusCode: 403,
        message: 'You do not have permission to delete this mission',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Mission does not exist',
    schema: {
      example: {
        statusCode: 404,
        message: 'Mission with ID 673ab2c3e8f9a1234567890c not found',
        error: 'Not Found',
      },
    },
  })
  async remove(@Param('id') id: string, @Request() req: any) {
    const recruiterId = req.user.id;
    return this.missionsService.remove(id, recruiterId);
  }
}

