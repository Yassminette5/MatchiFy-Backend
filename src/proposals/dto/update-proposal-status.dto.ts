import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProposalStatus } from '../schemas/proposal.schema';

export class UpdateProposalStatusDto {
  @ApiProperty({
    enum: ProposalStatus,
    description: 'New status for the proposal',
    example: ProposalStatus.ACCEPTED,
  })
  @IsEnum(ProposalStatus)
  status: ProposalStatus;

  @ApiProperty({
    description: 'Reason for rejection (required if status is REFUSED)',
    required: false,
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

