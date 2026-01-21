import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsBoolean,
} from 'class-validator';

export class CreateInterviewDto {
  @ApiProperty({
    description: 'ID de la proposal utilisée pour créer cette interview',
    example: '673ab2c3e8f9a1234567890c',
  })
  @IsString()
  @IsNotEmpty()
  proposalId: string;

  @ApiProperty({
    description: "Date et heure de l'interview (ISO 8601)",
    example: '2026-01-10T14:30:00.000Z',
  })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({
    description:
      'Lien Google Meet (ou autre outil de visioconférence). Optionnel si autoGenerateMeetLink = true.',
    example: 'https://meet.google.com/abc-defg-hij',
  })
  @IsString()
  @IsOptional()
  meetLink?: string;

  @ApiProperty({
    description: 'Notes optionnelles pour le talent ou le recruteur',
    required: false,
    example: 'Préparer un exemple de projet récent en React.',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Si true, le backend tentera de générer automatiquement un lien Meet via Google Calendar API.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  autoGenerateMeetLink?: boolean;
}


