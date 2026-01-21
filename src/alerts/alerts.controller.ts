import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { AlertsService } from './alerts.service';
import { MarkReadDto } from './dto/mark-read.dto';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @Roles('talent', 'recruiter')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAlerts(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const userId = req.user.id;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.alertsService.findAllByUser(userId, pageNum, limitNum);
  }

  @Get('unread-count')
  @Roles('talent', 'recruiter')
  async getUnreadCount(@Request() req: any) {
    const userId = req.user.id;
    const count = await this.alertsService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  @Roles('talent', 'recruiter')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    return this.alertsService.markAsRead(id, userId);
  }

  @Patch('read-all')
  @Roles('talent', 'recruiter')
  async markAllAsRead(@Request() req: any) {
    const userId = req.user.id;
    return this.alertsService.markAllAsRead(userId);
  }

  @Get(':id')
  @Roles('talent', 'recruiter')
  async getAlert(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id;
    return this.alertsService.findOne(id, userId);
  }
}

