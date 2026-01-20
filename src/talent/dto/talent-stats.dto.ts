import { ApiProperty } from '@nestjs/swagger';

export class TalentStatsDto {
  @ApiProperty({
    description: 'Total number of proposals sent by the talent in the specified period',
    example: 15,
  })
  totalProposalsSent: number;

  @ApiProperty({
    description: 'Total number of proposals accepted by recruiters in the specified period',
    example: 8,
  })
  totalProposalsAccepted: number;

  @ApiProperty({
    description: 'Total number of proposals refused by recruiters in the specified period',
    example: 3,
  })
  totalProposalsRefused: number;
}

