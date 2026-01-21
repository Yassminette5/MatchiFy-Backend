import { IsOptional, IsString } from 'class-validator';

export class MarkReadDto {
  @IsOptional()
  @IsString()
  alertId?: string; // If provided, mark single alert. If not, mark all
}

