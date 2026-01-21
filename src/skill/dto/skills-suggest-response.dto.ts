import { ApiProperty } from '@nestjs/swagger';
import { SkillResponseDto } from './skill-response.dto';

export class SkillsSuggestResponseDto {
  @ApiProperty({
    description: 'List of suggested skills',
    type: [SkillResponseDto],
  })
  skills: SkillResponseDto[];

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of results per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of matching skills',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
  })
  totalPages: number;
}

