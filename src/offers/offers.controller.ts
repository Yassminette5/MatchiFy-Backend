import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { GetOffersQueryDto } from './dto/get-offers-query.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { diskStorage } from 'multer';
import { extname } from 'node:path';

@ApiTags('offers')
@Controller('offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @Roles('talent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new service offer',
    description:
      'Allows authenticated talents to create a new service offer. Supports file uploads for banner image (required), gallery images (optional, max 10), and introduction video (optional).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['category', 'title', 'keywords', 'price', 'description', 'banner'],
      properties: {
        category: {
          type: 'string',
          enum: ['Development', 'Marketing', 'Teaching Online', 'Video Editing', 'Coaching'],
          description: 'Service category',
        },
        title: {
          type: 'string',
          description: 'Title of the service offer',
          example: 'Full Stack Web Development Services',
        },
        keywords: {
          type: 'string',
          description: 'Comma-separated keywords',
          example: 'React,Node.js,TypeScript,MongoDB',
        },
        price: {
          type: 'number',
          description: 'Price for the service',
          example: 5000,
        },
        description: {
          type: 'string',
          description: 'Detailed description of the service',
        },
        capabilities: {
          type: 'string',
          description: 'Comma-separated capabilities (optional)',
          example: 'Build responsive websites,API development,Database design',
        },
        banner: {
          type: 'string',
          format: 'binary',
          description: 'Banner image (required)',
        },
        gallery: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Gallery images (optional, max 10)',
        },
        video: {
          type: 'string',
          format: 'binary',
          description: 'Introduction video (optional)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Offer created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation error or missing banner image',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a talent',
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'banner', maxCount: 1 },
        { name: 'gallery', maxCount: 10 },
        { name: 'video', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            if (file.fieldname === 'banner') {
              cb(null, './uploads/offers/banners');
            } else if (file.fieldname === 'gallery') {
              cb(null, './uploads/offers/gallery');
            } else if (file.fieldname === 'video') {
              cb(null, './uploads/offers/videos');
            }
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            const prefix = file.fieldname === 'gallery' ? 'gallery' : file.fieldname;
            cb(null, `${prefix}-${uniqueSuffix}${ext}`);
          },
        }),
        limits: {
          fileSize: 50 * 1024 * 1024, // 50MB max
        },
      },
    ),
  )
  async create(
    @Request() req: any,
    @Body() createOfferDto: CreateOfferDto,
    @UploadedFiles() files: {
      banner?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    const talentId = req.user.id;

    // Debug: Log received data
    console.log('🔍 Received createOfferDto:', JSON.stringify(createOfferDto, null, 2));
    console.log('📦 Files:', {
      banner: files?.banner?.length || 0,
      gallery: files?.gallery?.length || 0,
      video: files?.video?.length || 0,
    });

    // Validate banner image is provided
    if (!files?.banner || files.banner.length === 0) {
      throw new BadRequestException('Banner image is required');
    }

    // Parse keywords if string
    if (typeof createOfferDto.keywords === 'string') {
      createOfferDto.keywords = (createOfferDto.keywords as any)
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0);
    }

    // Parse capabilities if string
    if (createOfferDto.capabilities && typeof createOfferDto.capabilities === 'string') {
      createOfferDto.capabilities = (createOfferDto.capabilities as any)
        .split(',')
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0);
    }

    // Parse price if string
    if (typeof createOfferDto.price === 'string') {
      console.log('💰 Parsing price from string:', createOfferDto.price);
      createOfferDto.price = Number.parseFloat(createOfferDto.price as any);
      console.log('💰 Parsed price:', createOfferDto.price);
    }

    const bannerPath = files.banner[0].path;
    const galleryPaths = files.gallery?.map((file) => file.path) || [];
    const videoPath = files.video?.[0]?.path;

    console.log('📂 File paths:');
    console.log('  Banner:', bannerPath);
    console.log('  Gallery:', galleryPaths);
    console.log('  Video:', videoPath);

    return this.offersService.create(
      createOfferDto,
      talentId,
      bannerPath,
      galleryPaths,
      videoPath,
    );
  }

  @Get()
  @Roles('recruiter', 'talent')
  @ApiOperation({
    summary: 'Get all service offers',
    description:
      'Retrieves all service offers with optional filtering by category and search term. Results are sorted by date (newest first).',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['Development', 'Marketing', 'Teaching Online', 'Video Editing', 'Coaching'],
    description: 'Filter by category',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term to filter by title or keywords',
  })
  @ApiResponse({
    status: 200,
    description: 'List of service offers retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async findAll(@Query() query: GetOffersQueryDto) {
    return this.offersService.findAll(query);
  }

  @Get(':id')
  @Roles('recruiter', 'talent')
  @ApiOperation({
    summary: 'Get a single service offer by ID',
    description: 'Retrieves a specific service offer by its ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Offer ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Service offer retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Offer does not exist',
  })
  async findOne(@Param('id') id: string) {
    return this.offersService.findOne(id);
  }

  @Put(':id')
  @Roles('talent')
  @ApiOperation({
    summary: 'Update a service offer',
    description:
      'Allows the owner talent to update their service offer. All fields are optional - only provided fields will be updated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Offer ID',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['Development', 'Marketing', 'Teaching Online', 'Video Editing', 'Coaching'],
        },
        title: { type: 'string' },
        keywords: { type: 'string' },
        price: { type: 'number' },
        description: { type: 'string' },
        capabilities: { type: 'string' },
        banner: {
          type: 'string',
          format: 'binary',
        },
        gallery: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        video: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Offer updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not the owner',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Offer does not exist',
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'banner', maxCount: 1 },
      { name: 'gallery', maxCount: 10 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updateOfferDto: UpdateOfferDto,
    @UploadedFiles() files: {
      banner?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
  ) {
    const talentId = req.user.id;

    // Parse keywords if string
    if (updateOfferDto.keywords && typeof updateOfferDto.keywords === 'string') {
      updateOfferDto.keywords = (updateOfferDto.keywords as any)
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0);
    }

    // Parse capabilities if string
    if (updateOfferDto.capabilities && typeof updateOfferDto.capabilities === 'string') {
      updateOfferDto.capabilities = (updateOfferDto.capabilities as any)
        .split(',')
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0);
    }

    // Parse price if string
    if (updateOfferDto.price && typeof updateOfferDto.price === 'string') {
      updateOfferDto.price = Number.parseFloat(updateOfferDto.price as any);
    }

    const bannerPath = files?.banner?.[0]?.path;
    const galleryPaths = files?.gallery?.map((file) => file.path);
    const videoPath = files?.video?.[0]?.path;

    return this.offersService.update(
      id,
      updateOfferDto,
      talentId,
      bannerPath,
      galleryPaths,
      videoPath,
    );
  }

  @Delete(':id')
  @Roles('talent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a service offer',
    description:
      'Allows the owner talent to delete their service offer. This is a physical deletion (the offer will be permanently removed from the database).',
  })
  @ApiParam({
    name: 'id',
    description: 'Offer ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Offer deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not the owner',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Offer does not exist',
  })
  async remove(@Param('id') id: string, @Request() req: any) {
    const talentId = req.user.id;
    return this.offersService.remove(id, talentId);
  }

  @Post(':id/reviews')
  @Roles('recruiter')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a review to a service offer',
    description: 'Allows authenticated recruiters to add a rating and review to an offer.',
  })
  @ApiParam({
    name: 'id',
    description: 'Offer ID',
  })
  @ApiBody({ type: CreateReviewDto })
  @ApiResponse({
    status: 201,
    description: 'Review added successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Offer does not exist',
  })
  async addReview(
    @Param('id') id: string,
    @Body() createReviewDto: CreateReviewDto,
    @Request() req: any,
  ) {
    return this.offersService.addReview(
      id,
      req.user.id,
      createReviewDto.rating,
      createReviewDto.message,
    );
  }
}
