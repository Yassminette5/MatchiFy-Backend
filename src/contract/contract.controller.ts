import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { SignContractDto } from './dto/sign-contract.dto';

@ApiTags('contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  @Roles('recruiter')
  @ApiOperation({ summary: 'Create and send a contract' })
  async create(
    @Request() req: any,
    @Body() createContractDto: CreateContractDto
  ) {
    return this.contractService.create(createContractDto, req.user.id);
  }

  @Get(':id')
  @Roles('recruiter', 'talent')
  @ApiOperation({ summary: 'Get a contract by ID' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.contractService.findOne(id, req.user.id, req.user.role);
  }

  @Get('conversation/:conversationId')
  @Roles('recruiter', 'talent')
  @ApiOperation({ summary: 'Get all contracts for a conversation' })
  async findByConversation(
    @Param('conversationId') conversationId: string,
    @Request() req: any
  ) {
    return this.contractService.findByConversation(
      conversationId,
      req.user.id,
      req.user.role
    );
  }

  @Patch(':id/sign')
  @Roles('talent')
  @ApiOperation({ summary: 'Sign a contract' })
  async signContract(
    @Param('id') id: string,
    @Request() req: any,
    @Body() signContractDto: SignContractDto
  ) {
    return this.contractService.signContract(id, req.user.id, signContractDto);
  }

  @Patch(':id/decline')
  @Roles('talent')
  @ApiOperation({ summary: 'Decline a contract' })
  async declineContract(@Param('id') id: string, @Request() req: any) {
    return this.contractService.declineContract(id, req.user.id);
  }
}

