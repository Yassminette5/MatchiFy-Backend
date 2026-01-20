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
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post(':missionId')
  @Roles('talent')
  @ApiOperation({
    summary: 'Add mission to favorites',
    description: 'Adds a mission to the logged-in talent\'s favorites list.',
  })
  @ApiResponse({
    status: 201,
    description: 'Mission added to favorites successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Mission is already in favorites',
  })
  @ApiResponse({
    status: 404,
    description: 'Mission not found',
  })
  async addFavorite(
    @Param('missionId') missionId: string,
    @Request() req: any
  ) {
    const talentId = req.user.id;
    return this.favoritesService.addFavorite(missionId, talentId);
  }

  @Delete(':missionId')
  @Roles('talent')
  @ApiOperation({
    summary: 'Remove mission from favorites',
    description: 'Removes a mission from the logged-in talent\'s favorites list.',
  })
  @ApiResponse({
    status: 200,
    description: 'Mission removed from favorites successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Favorite not found',
  })
  async removeFavorite(
    @Param('missionId') missionId: string,
    @Request() req: any
  ) {
    const talentId = req.user.id;
    await this.favoritesService.removeFavorite(missionId, talentId);
    return { message: 'Mission removed from favorites successfully' };
  }

  @Get()
  @Roles('talent')
  @ApiOperation({
    summary: 'Get favorite missions',
    description: 'Returns all missions favorited by the logged-in talent.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of favorite missions',
  })
  async getFavorites(@Request() req: any) {
    const talentId = req.user.id;
    return this.favoritesService.getFavorites(talentId);
  }
}


