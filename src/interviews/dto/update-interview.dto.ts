import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
} from 'class-validator';
import { InterviewStatus } from '../schemas/interview.schema';

export class UpdateInterviewDto {
  @ApiPropertyOptional({
    description: "Nouvelle date/heure de l'interview (ISO 8601)",
    example: '2026-01-11T09:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: 'Nouveau lien Meet ou outil de visioconférence',
    example: 'https://meet.google.com/xyz-1234-abc',
  })
  @IsString()
  @IsOptional()
  meetLink?: string;

  @ApiPropertyOptional({
    description: 'Met à jour le statut de l\'interview',
    enum: ['SCHEDULED', 'CANCELLED', 'COMPLETED'],
  })
  @IsString()
  @IsIn(['SCHEDULED', 'CANCELLED', 'COMPLETED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Notes mises à jour',
    example: 'Décalé de 30 minutes à la demande du talent.',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}


