import { ApiProperty } from '@nestjs/swagger';

export class ProfileAnalysisResponseDto {
  @ApiProperty({
    description: 'Short summary of the talent profile in 3-4 lines',
    example: 'Experienced software developer with strong expertise in React and Node.js. Demonstrates excellent problem-solving skills and a passion for creating innovative web applications.',
  })
  summary: string;

  @ApiProperty({
    description: 'Array of key strengths identified in the profile',
    example: ['Strong technical skills in React and Node.js', 'Excellent portfolio showcasing real-world projects', 'Clear communication in project descriptions'],
    type: [String],
  })
  keyStrengths: string[];

  @ApiProperty({
    description: 'Array of areas that could be improved',
    example: ['Add more detailed project descriptions', 'Include links to live projects', 'Expand skill set with testing frameworks'],
    type: [String],
  })
  areasToImprove: string[];

  @ApiProperty({
    description: 'Array of recommended tags/keywords for matching',
    example: ['Full-Stack Developer', 'React Expert', 'Node.js Specialist', 'Web Development'],
    type: [String],
  })
  recommendedTags: string[];

  @ApiProperty({
    description: 'Profile completeness and strength score (0-100)',
    example: 75,
    minimum: 0,
    maximum: 100,
  })
  profileScore: number;

  @ApiProperty({
    description: 'Timestamp of when the analysis was performed',
    example: '2025-01-15T10:30:00.000Z',
  })
  analyzedAt?: Date;
}










