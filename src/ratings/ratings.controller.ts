import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('ratings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @Roles('recruiter')
  @ApiOperation({
    summary: 'Créer ou mettre à jour un rating pour un talent',
    description:
      'Permet à un recruteur d’évaluer un talent pour une mission donnée (ou de mettre à jour son rating existant).',
  })
  @ApiResponse({
    status: 201,
    description: 'Rating créé ou mis à jour avec succès',
  })
  async createOrUpdate(
    @Request() req: any,
    @Body() dto: CreateRatingDto,
  ) {
    const recruiterId = req.user.id;
    const rating = await this.ratingsService.createOrUpdate(recruiterId, dto);
    return rating;
  }

  @Get('my')
  @Roles('recruiter')
  @ApiOperation({
    summary: 'Récupérer le rating du recruteur courant pour un talent',
  })
  @ApiResponse({
    status: 200,
    description: 'Rating trouvé (ou null s’il n’existe pas)',
  })
  async getMyRating(
    @Request() req: any,
    @Query('talentId') talentId: string,
    @Query('missionId') missionId?: string,
  ) {
    const recruiterId = req.user.id;
    return this.ratingsService.findMyRating(recruiterId, talentId, missionId);
  }

  @Get('talent/:talentId')
  @Roles('recruiter', 'talent')
  @ApiOperation({
    summary: 'Lister les ratings pour un talent',
    description:
      'Retourne la moyenne, le nombre total de ratings et la liste détaillée des feedbacks pour un talent.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des ratings pour le talent',
  })
  async getForTalent(@Param('talentId') talentId: string) {
    return this.ratingsService.findForTalent(talentId);
  }

  @Delete(':ratingId')
  @Roles('recruiter')
  @ApiOperation({
    summary: 'Supprimer un rating',
    description:
      'Supprime un rating créé par le recruteur courant. Vérifie que le rating existe et appartient bien au recruteur.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rating supprimé avec succès',
  })
  @ApiResponse({
    status: 403,
    description: "Le rating n'appartient pas au recruteur courant",
  })
  @ApiResponse({
    status: 404,
    description: 'Rating introuvable',
  })
  async deleteRating(
    @Request() req: any,
    @Param('ratingId') ratingId: string,
  ) {
    const recruiterId = req.user.id;
    const deleted = await this.ratingsService.deleteRating(
      ratingId,
      recruiterId,
    );
    return deleted;
  }
}


