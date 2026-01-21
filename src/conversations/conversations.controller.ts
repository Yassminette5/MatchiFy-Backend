import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { ConversationsService } from './conversations.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @Roles('talent', 'recruiter')
  async getConversations(@Request() req: any) {
    return this.conversationsService.findAll(req.user.id, req.user.role);
  }

  @Get('unread-count')
  @Roles('talent', 'recruiter')
  async getUnreadCount(@Request() req: any) {
    const count = await this.conversationsService.getUnreadCount(req.user.id);
    return { count };
  }

  @Get('conversations-with-unread')
  @Roles('talent', 'recruiter')
  async getConversationsWithUnread(@Request() req: any) {
    const count = await this.conversationsService.getConversationsWithUnreadCount(req.user.id);
    return { count };
  }

  @Get(':id')
  @Roles('talent', 'recruiter')
  async getConversation(@Param('id') id: string, @Request() req: any) {
    return this.conversationsService.findOne(id, req.user.id, req.user.role);
  }

  @Get(':id/messages')
  @Roles('talent', 'recruiter')
  async getMessages(@Param('id') id: string, @Request() req: any) {
    return this.conversationsService.getMessages(id, req.user.id, req.user.role);
  }

  @Get(':id/unread-count')
  @Roles('talent', 'recruiter')
  async getConversationUnreadCount(@Param('id') id: string, @Request() req: any) {
    const count = await this.conversationsService.getConversationUnreadCount(id, req.user.id, req.user.role);
    return { count };
  }

  @Post()
  @Roles('talent', 'recruiter')
  async createConversation(
    @Body() dto: CreateConversationDto,
    @Request() req: any
  ) {
    return this.conversationsService.findOrCreate(
      dto,
      req.user.id,
      req.user.role
    );
  }

  @Post(':id/messages')
  @Roles('talent', 'recruiter')
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @Request() req: any
  ) {
    return this.conversationsService.sendMessage(
      id,
      dto,
      req.user.id,
      req.user.role
    );
  }

  @Post(':id/mark-read')
  @Roles('talent', 'recruiter')
  async markConversationAsRead(
    @Param('id') id: string,
    @Request() req: any
  ) {
    return this.conversationsService.markConversationAsRead(
      id,
      req.user.id,
      req.user.role
    );
  }

  @Delete(':id')
  @Roles('talent', 'recruiter')
  async deleteConversation(
    @Param('id') id: string,
    @Request() req: any
  ) {
    return this.conversationsService.deleteConversation(
      id,
      req.user.id,
      req.user.role
    );
  }
}

