import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalStatusDto } from './dto/update-proposal-status.dto';

@ApiTags('proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post()
  @Roles('talent')
  async create(@Request() req: any, @Body() dto: CreateProposalDto) {
    const talentContext = {
      id: req.user.id,
      fullName: req.user.fullName ?? req.user.name ?? req.user.email,
    };
    return this.proposalsService.create(dto, talentContext);
  }

  @Get('talent')
  @Roles('talent')
  async getTalentProposals(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('archived') archived?: string
  ) {
    const filters: any = {};
    if (status && status !== 'all') {
      filters.status = status;
    }
    if (archived !== undefined) filters.archived = archived === 'true';
    return this.proposalsService.findByTalent(req.user.id, filters);
  }

  @Get('recruiter')
  @Roles('recruiter')
  async getRecruiterProposals(
    @Request() req: any,
    @Query('missionId') missionId?: string
  ) {
    return this.proposalsService.findByRecruiter(req.user.id, missionId);
  }

  @Get('recruiter/grouped')
  @Roles('recruiter')
  async getRecruiterProposalsGrouped(@Request() req: any) {
    return this.proposalsService.findByMissionGrouped(req.user.id);
  }

  @Get(':id')
  @Roles('talent', 'recruiter')
  async getProposal(@Param('id') id: string, @Request() req: any) {
    return this.proposalsService.findOne(id, req.user.id, req.user.role);
  }

  @Get('mission/:missionId/count')
  @Roles('talent', 'recruiter')
  async getMissionCount(@Param('missionId') missionId: string) {
    const count = await this.proposalsService.countByMission(missionId);
    return { missionId, count };
  }

  @Get('recruiter/unread-count')
  @Roles('recruiter')
  async getRecruiterUnreadCount(@Request() req: any) {
    const count = await this.proposalsService.getUnreadCountForRecruiter(req.user.id);
    return { count };
  }

  @Patch(':id/status')
  @Roles('recruiter')
  async updateStatus(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateProposalStatusDto
  ) {
    return this.proposalsService.updateStatus(id, req.user.id, dto);
  }

  @Patch(':id/archive')
  @Roles('talent')
  async archiveProposal(
    @Param('id') id: string,
    @Request() req: any
  ) {
    return this.proposalsService.archiveProposal(id, req.user.id);
  }

  @Delete(':id')
  @Roles('talent')
  async deleteProposal(
    @Param('id') id: string,
    @Request() req: any
  ) {
    return this.proposalsService.deleteProposal(id, req.user.id);
  }
}

