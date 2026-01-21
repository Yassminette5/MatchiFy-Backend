import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateContractDto {
  @ApiProperty({
    description: 'Mission ID',
    example: '673ab2c3e8f9a1234567890c',
  })
  @IsString()
  @IsNotEmpty()
  missionId: string;

  @ApiProperty({
    description: 'Talent ID',
    example: '673ab2c3e8f9a1234567890d',
  })
  @IsString()
  @IsNotEmpty()
  talentId: string;

  @ApiProperty({
    description: 'Contract title',
    example: 'Contrat de prestation - Développeur Full Stack',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Project Scope & Deliverables',
    example: 'Development of a mobile app...',
  })
  @IsString()
  @IsNotEmpty()
  scope: string;

  @ApiProperty({
    description: 'Compensation & Payment Terms',
    example: '5000€ fixed price',
  })
  @IsString()
  @IsNotEmpty()
  budget: string;

  @ApiProperty({
    description: 'Start date',
    example: '2025-02-01',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'End date',
    example: '2025-08-01',
  })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Payment details (legacy/optional)',
    example: '50000€ - Paiement mensuel',
  })
  @IsOptional()
  @IsString()
  paymentDetails?: string;

  @ApiProperty({
    description: 'Recruiter signature (base64 encoded image)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
  })
  @IsString()
  @IsNotEmpty()
  recruiterSignature: string;
}

