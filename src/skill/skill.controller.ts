import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SkillService } from './skill.service';
import { SkillsSearchQueryDto } from './dto/skills-search.dto';
import { SkillResponseDto } from './dto/skill-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('skills')
@Controller('skills')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  @Get()
  @ApiOperation({
    summary: 'Search skills',
    description:
      'Returns a list of skills matching the search query using case-insensitive partial matching. Returns both ESCO and user-created skills. Requires authentication.',
  })
  @ApiQuery({
    name: 'query',
    type: String,
    description: 'Search query (skill name)',
    example: 'react',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Skills retrieved successfully',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/SkillResponseDto' },
      example: [
        {
          _id: '673ab2c3e8f9a1234567890a',
          name: 'React Native',
          source: 'ESCO',
          createdAt: '2025-01-15T10:30:00.000Z',
          updatedAt: '2025-01-15T10:30:00.000Z',
        },
        {
          _id: '673ab2c3e8f9a1234567890b',
          name: 'React.js',
          source: 'ESCO',
          createdAt: '2025-01-15T10:30:00.000Z',
          updatedAt: '2025-01-15T10:30:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid query parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async search(@Query() queryDto: SkillsSearchQueryDto) {
    const skills = await this.skillService.search(queryDto.query);
    return skills;
  }

  @Get('by-ids')
  @ApiOperation({
    summary: 'Get skills by IDs',
    description:
      'Returns a list of skills matching the provided skill IDs. Used to load skill details when displaying user profiles or portfolio projects.',
  })
  @ApiQuery({
    name: 'ids',
    type: String,
    description: 'Comma-separated list of skill IDs (MongoDB ObjectIds)',
    example: '673ab2c3e8f9a1234567890a,673ab2c3e8f9a1234567890b',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Skills retrieved successfully',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/SkillResponseDto' },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid query parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async getByIds(@Query('ids') ids: string) {
    const skillIds = ids.split(',').map((id) => id.trim()).filter((id) => id);
    const skills = await this.skillService.findByIds(skillIds);
    return skills;
  }
}

