import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SkillsSearchQueryDto {
  @ApiProperty({
    description: 'Search query (skill name)',
    example: 'react',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty({ message: 'Query parameter is required' })
  query: string;
}

