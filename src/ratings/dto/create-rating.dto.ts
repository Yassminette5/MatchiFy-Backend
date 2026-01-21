import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({
    description: 'ID du talent évalué',
    example: '673ab2c3e8f9a1234567890d',
  })
  @IsString()
  @IsNotEmpty()
  talentId: string;

  @ApiProperty({
    description: 'ID de la mission associée à cette évaluation (optionnel)',
    example: '673ab2c3e8f9a1234567890c',
    required: false,
  })
  @IsString()
  @IsOptional()
  missionId?: string;

  @ApiProperty({
    description: 'Score de 1 à 5',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  score: number;

  @ApiProperty({
    description: 'Indique si le talent est recommandé par le recruteur',
    example: true,
  })
  @IsBoolean()
  recommended: boolean;

  @ApiProperty({
    description: 'Commentaire libre du recruteur',
    example: 'Très bon échange, bonne communication et expertise solide en DevOps.',
    required: false,
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comment?: string;

  @ApiProperty({
    description: 'Tags optionnels pour catégoriser le feedback',
    example: ['communication', 'qualité du code'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}


