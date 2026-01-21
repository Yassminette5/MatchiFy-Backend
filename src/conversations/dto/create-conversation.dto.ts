import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateConversationDto {
  @ApiPropertyOptional({
    description: 'Mission ID (optional, links conversation to a mission)',
    example: '673ab2c3e8f9a1234567890c',
  })
  @IsOptional()
  @IsString()
  missionId?: string;

  @ApiPropertyOptional({
    description: 'Talent ID (required if creating from recruiter side)',
    example: '673ab2c3e8f9a1234567890b',
  })
  @IsOptional()
  @IsString()
  talentId?: string;

  @ApiPropertyOptional({
    description: 'Recruiter ID (required if creating from talent side)',
    example: '673ab2c3e8f9a1234567890a',
  })
  @IsOptional()
  @IsString()
  recruiterId?: string;
}

