import { ApiProperty } from '@nestjs/swagger';

export class RadarDataDto {
  @ApiProperty({
    description: 'Skills match score (0-100) - How well talent skills match mission requirements',
    example: 85,
    minimum: 0,
    maximum: 100,
  })
  skillsMatch: number;

  @ApiProperty({
    description: 'Experience fit score (0-100) - How well talent experience aligns with mission needs',
    example: 75,
    minimum: 0,
    maximum: 100,
  })
  experienceFit: number;

  @ApiProperty({
    description: 'Project relevance score (0-100) - Relevance of talent portfolio projects to mission',
    example: 80,
    minimum: 0,
    maximum: 100,
  })
  projectRelevance: number;

  @ApiProperty({
    description: 'Mission requirements fit score (0-100) - How well talent meets ALL specific mission requirements',
    example: 82,
    minimum: 0,
    maximum: 100,
  })
  missionRequirementsFit: number;

  @ApiProperty({
    description: 'Soft skills fit score (0-100) - How well talent soft skills align with mission needs',
    example: 78,
    minimum: 0,
    maximum: 100,
  })
  softSkillsFit: number;

  // Legacy fields for backward compatibility
  @ApiProperty({
    description: 'Talent strength alignment score (0-100) - DEPRECATED: use softSkillsFit',
    example: 78,
    minimum: 0,
    maximum: 100,
    required: false,
  })
  talentStrengthAlignment?: number;

  @ApiProperty({
    description: 'Overall coherence score (0-100) - DEPRECATED: use missionRequirementsFit',
    example: 82,
    minimum: 0,
    maximum: 100,
    required: false,
  })
  overallCoherence?: number;
}

export class MissionFitResponseDto {
  @ApiProperty({
    description: 'Overall match score between talent and mission (0-100). Calculated using a strict bottleneck formula where weak categories heavily reduce the final score. A talent must perform well in ALL categories to achieve a high score.',
    example: 82,
    minimum: 0,
    maximum: 100,
  })
  score: number;

  @ApiProperty({
    description: 'Radar chart data with 5 axes',
    type: RadarDataDto,
  })
  radar: RadarDataDto;

  @ApiProperty({
    description: 'Short summary of the mission fit analysis (2-3 lines)',
    example: 'This mission aligns well with your React and Node.js expertise. Your portfolio projects demonstrate strong full-stack capabilities that match the requirements. Consider highlighting your experience with TypeScript to strengthen your application.',
  })
  shortSummary: string;
}

