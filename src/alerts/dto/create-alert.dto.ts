import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AlertType } from '../schemas/alert.schema';

export class CreateAlertDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsEnum(AlertType)
  type: AlertType;

  @IsNotEmpty()
  @IsString()
  missionId: string;

  @IsNotEmpty()
  @IsString()
  proposalId: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  talentId?: string;

  @IsOptional()
  @IsString()
  talentName?: string;

  @IsOptional()
  @IsString()
  talentProfileImage?: string;

  @IsOptional()
  @IsString()
  recruiterId?: string;

  @IsOptional()
  @IsString()
  recruiterName?: string;

  @IsOptional()
  @IsString()
  recruiterProfileImage?: string;

  @IsOptional()
  @IsString()
  missionTitle?: string;
}

