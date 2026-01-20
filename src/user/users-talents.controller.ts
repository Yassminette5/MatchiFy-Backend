import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserService } from './user.service';

@ApiTags('user')
@Controller('users')
export class UsersTalentsController {
  constructor(private readonly userService: UserService) {}

  @Get('talents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all talents',
    description:
      'Retourne une liste paginée de tous les talents enregistrés (role = talent). Utilisé par le frontend pour afficher les profils disponibles.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des talents récupérée avec succès',
  })
  async getAllTalents(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const parsedLimit =
      typeof limit === 'string' && !isNaN(parseInt(limit, 10))
        ? parseInt(limit, 10)
        : undefined;
    const parsedPage =
      typeof page === 'string' && !isNaN(parseInt(page, 10))
        ? parseInt(page, 10)
        : undefined;

    return this.userService.getAllTalents(parsedLimit, parsedPage);
  }
}


