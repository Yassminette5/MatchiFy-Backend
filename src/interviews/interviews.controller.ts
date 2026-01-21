import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';

@ApiTags('interviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  @Roles('recruiter')
  @ApiOperation({
    summary: 'Créer une interview à partir d’une proposal',
    description:
      'Le recruteur crée une interview pour une proposal donnée, en précisant la date/heure et le lien Meet.',
  })
  @ApiResponse({
    status: 201,
    description: 'Interview créée avec succès',
  })
  async createFromProposal(
    @Request() req: any,
    @Body() dto: CreateInterviewDto,
  ) {
    const recruiterId = req.user.id;
    return this.interviewsService.createFromProposal(recruiterId, dto);
  }

  @Get('recruiter')
  @Roles('recruiter')
  @ApiOperation({
    summary: 'Lister les interviews du recruteur connecté',
  })
  async getForRecruiter(@Request() req: any) {
    const recruiterId = req.user.id;
    return this.interviewsService.findForRecruiter(recruiterId);
  }

  @Get('talent')
  @Roles('talent')
  @ApiOperation({
    summary: 'Lister les interviews du talent connecté',
  })
  async getForTalent(@Request() req: any) {
    const talentId = req.user.id;
    return this.interviewsService.findForTalent(talentId);
  }

  @Put(':id')
  @Roles('recruiter')
  @ApiOperation({
    summary: 'Modifier une interview (date, lien, notes, statut)',
  })
  async updateInterview(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateInterviewDto,
  ) {
    const recruiterId = req.user.id;
    return this.interviewsService.updateInterview(recruiterId, id, dto);
  }

  @Patch(':id/cancel')
  @Roles('recruiter')
  @ApiOperation({
    summary: 'Annuler une interview',
  })
  @ApiResponse({
    status: 200,
    description: 'Interview annulée avec succès',
  })
  async cancelInterview(@Request() req: any, @Param('id') id: string) {
    const recruiterId = req.user.id;
    return this.interviewsService.cancelInterview(recruiterId, id);
  }
}


