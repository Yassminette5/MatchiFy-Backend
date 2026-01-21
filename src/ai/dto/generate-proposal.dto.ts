import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateProposalDto {
  @ApiProperty({
    description: 'Mission ID for which to generate the proposal',
    example: '673ab2c3e8f9a1234567890c',
  })
  @IsString()
  @IsNotEmpty({ message: 'Mission ID is required' })
  missionId: string;
}

export class GenerateProposalResponseDto {
  @ApiProperty({
    description: 'Generated proposal content',
    example: 'I am excited to propose my services for this mission...',
  })
  proposalContent: string;
}







