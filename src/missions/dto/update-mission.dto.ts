import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  IsIn,
} from 'class-validator';

export class UpdateMissionDto {
  @ApiPropertyOptional({
    description: 'Title of the mission offer',
    example: 'Développeur Full Stack React/Node.js - Mise à jour',
    minLength: 3,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the mission',
    example:
      'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe et travailler sur des projets innovants utilisant React et Node.js. Mission en télétravail possible.',
    minLength: 10,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Duration of the mission',
    example: '3 à 6 mois',
  })
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({
    description: 'Budget allocated for the mission',
    example: 60000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Budget must be a number' })
  @Min(0, { message: 'Budget must be positive' })
  budget?: number;

  @ApiPropertyOptional({
    description: 'List of required skills',
    example: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Express', 'Docker'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Skills must be an array' })
  @IsString({ each: true, message: 'Each skill must be a string' })
  skills?: string[];

  @ApiPropertyOptional({
    description: "Niveau d'expérience recherché",
    example: 'INTERMEDIATE',
    enum: ['ENTRY', 'INTERMEDIATE', 'EXPERT'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['ENTRY', 'INTERMEDIATE', 'EXPERT'], {
    message: 'experienceLevel must be ENTRY, INTERMEDIATE or EXPERT',
  })
  experienceLevel?: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
}