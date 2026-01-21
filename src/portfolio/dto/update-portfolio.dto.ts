import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';
import { MediaItemDto } from './media-item.dto';

export class UpdatePortfolioDto {
  @ApiPropertyOptional({
    description: 'Title of the project',
    example: 'E-commerce Mobile App - Updated',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Role in the project (e.g., Lead Developer, Photographer)',
    example: 'Lead Developer',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'Array of skill names used in the project. Can be sent as JSON string or comma-separated string in multipart/form-data. Maximum 10 skills allowed. Skills that don\'t exist will be automatically created with source "USER".',
    example: ['React Native', 'Node.js', 'MongoDB'],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : value.split(',').map(s => s.trim()).filter(s => s);
      } catch {
        return value.split(',').map(s => s.trim()).filter(s => s);
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  skills?: string[]; // Array of skill names (not IDs)

  @ApiPropertyOptional({
    description: 'Project description (no length limit)',
    example: 'A full-stack e-commerce mobile application with real-time inventory management and advanced analytics.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'URL to the project (e.g., GitHub repository, website)',
    example: 'https://github.com/username/project',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Please provide a valid URL for project link' })
  projectLink?: string;

  @ApiPropertyOptional({
    description: 'Array of media items. Can be sent as JSON string in multipart/form-data. Files uploaded will be automatically added to this array.',
    type: [MediaItemDto],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value || [];
  })
  @IsArray()
  media?: MediaItemDto[];
}

