import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, MinLength } from 'class-validator';

export class CreateProposalDto {
  @ApiProperty({
    description: 'Mission ID targeted by the proposal',
    example: '673ab2c3e8f9a1234567890c',
  })
  @IsString()
  @IsNotEmpty()
  missionId: string;

  @ApiProperty({
    description: 'Cover letter / message sent with the proposal',
    example: 'I have 5 years of experience building scalable iOS apps...',
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    description: 'Detailed proposal content (required, minimum 200 characters)',
    example: 'I am excited to propose my services for this mission. With over 5 years of experience in full-stack development, I have successfully delivered numerous projects using React, Node.js, and MongoDB. My approach focuses on clean code, scalability, and user experience. I would be delighted to discuss how my expertise can contribute to your project...',
    minLength: 200,
  })
  @IsString()
  @IsNotEmpty({ message: 'Proposal content is required' })
  @MinLength(200, { message: 'Proposal content must be at least 200 characters long' })
  proposalContent: string;

  @ApiProperty({
    description: 'Optional budget proposed by the talent',
    example: 50000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  proposedBudget?: number;

  @ApiProperty({
    description: 'Optional estimation for the engagement duration',
    example: '12 weeks',
    required: false,
  })
  @IsOptional()
  @IsString()
  estimatedDuration?: string;
}

