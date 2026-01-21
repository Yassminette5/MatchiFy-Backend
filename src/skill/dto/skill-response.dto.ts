import { ApiProperty } from '@nestjs/swagger';

export class SkillResponseDto {
  @ApiProperty({
    description: 'Skill ID (MongoDB ObjectId)',
    example: '673ab2c3e8f9a1234567890a',
  })
  _id: string;

  @ApiProperty({
    description: 'Skill name',
    example: 'React Native',
  })
  name: string;

  @ApiProperty({
    description: 'Source of the skill',
    example: 'ESCO',
    enum: ['ESCO', 'USER'],
  })
  source: string;

  @ApiProperty({
    description: 'Talent ID who created this skill (only for USER source)',
    example: '673ab2c3e8f9a1234567890b',
    required: false,
  })
  createdBy?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}

