import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  PDF = 'pdf',
  EXTERNAL_LINK = 'external_link',
}

export class MediaItemDto {
  @ApiProperty({
    description: 'Type of media item',
    enum: MediaType,
    example: MediaType.IMAGE,
  })
  @IsEnum(MediaType)
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({
    description: 'File path or URL for the media item',
    example: 'uploads/portfolio/portfolio-image-1234567890.jpg',
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({
    description: 'Optional title/label for the media item',
    example: 'Main Screenshot',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'External link URL (for external_link type)',
    example: 'https://example.com/demo',
  })
  @IsOptional()
  @IsString()
  externalLink?: string;
}


