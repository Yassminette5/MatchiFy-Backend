import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  Min,
  IsIn,
} from 'class-validator';

export class CreateMissionDto {
  @ApiProperty({
    description: 'Titre de la mission',
    example: 'Développeur Full Stack React/Node.js',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @ApiProperty({
    description: 'Description détaillée de la mission',
    example:
      'Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe et travailler sur des projets innovants utilisant React et Node.js.',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description: string;

  @ApiProperty({
    description: 'Durée de la mission (texte lisible)',
    example: 'Less than 1 month', // ou "1 to 3 months", "3 to 6 months", etc.
  })
  @IsString()
  @IsNotEmpty({ message: 'Duration is required' })
  duration: string;

  @ApiProperty({
    description: 'Budget alloué pour la mission',
    example: 5000,
    minimum: 0,
  })
  @IsNumber({}, { message: 'Budget must be a number' })
  @Min(0, { message: 'Budget must be positive' })
  @IsNotEmpty({ message: 'Budget is required' })
  budget: number;

  @ApiProperty({
    description: "Liste des compétences requises pour la mission",
    example: ['React', 'Node.js', 'TypeScript'],
    type: [String],
  })
  @IsArray({ message: 'Skills must be an array' })
  @IsString({ each: true, message: 'Each skill must be a string' })
  @IsNotEmpty({ message: 'Skills are required' })
  skills: string[];

  @ApiProperty({
    description: "Niveau d'expérience recherché",
    example: 'INTERMEDIATE',
    enum: ['ENTRY', 'INTERMEDIATE', 'EXPERT'],
  })
  @IsString()
  @IsIn(['ENTRY', 'INTERMEDIATE', 'EXPERT'], {
    message: 'experienceLevel must be ENTRY, INTERMEDIATE or EXPERT',
  })
  @IsNotEmpty({ message: 'Experience level is required' })
  experienceLevel: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
}