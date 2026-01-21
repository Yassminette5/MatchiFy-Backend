import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RecruiterFavoritesService } from './recruiter-favorites.service';

@ApiTags('recruiter-favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recruiter-favorites')
export class RecruiterFavoritesController {
  constructor(private readonly recruiterFavoritesService: RecruiterFavoritesService) {}

  @Post('talent/:talentId')
  @Roles('recruiter')
  @ApiOperation({
    summary: 'Add talent to favorites',
    description: 'Adds a talent to the logged-in recruiter\'s favorites list.',
  })
  @ApiResponse({
    status: 201,
    description: 'Talent added to favorites successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Talent is already in favorites or invalid talent',
  })
  @ApiResponse({
    status: 404,
    description: 'Talent not found',
  })
  async addTalentFavorite(
    @Param('talentId') talentId: string,
    @Request() req: any
  ) {
    const recruiterId = req.user.id;
    return this.recruiterFavoritesService.addTalentFavorite(talentId, recruiterId);
  }

  @Delete('talent/:talentId')
  @Roles('recruiter')
  @ApiOperation({
    summary: 'Remove talent from favorites',
    description: 'Removes a talent from the logged-in recruiter\'s favorites list.',
  })
  @ApiResponse({
    status: 200,
    description: 'Talent removed from favorites successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Favorite not found',
  })
  async removeTalentFavorite(
    @Param('talentId') talentId: string,
    @Request() req: any
  ) {
    const recruiterId = req.user.id;
    await this.recruiterFavoritesService.removeTalentFavorite(talentId, recruiterId);
    return { message: 'Talent removed from favorites successfully' };
  }

  @Get('talents')
  @Roles('recruiter')
  @ApiOperation({
    summary: 'Get favorite talents',
    description: 'Returns all talents favorited by the logged-in recruiter.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of favorite talents',
  })
  async getFavoriteTalents(@Request() req: any) {
    const recruiterId = req.user.id;
    return this.recruiterFavoritesService.getFavoriteTalents(recruiterId);
  }
}

