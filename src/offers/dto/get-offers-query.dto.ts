import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { OfferCategory } from './create-offer.dto';

export class GetOffersQueryDto {
  @ApiProperty({
    description: 'Filter by category',
    example: 'Development',
    enum: OfferCategory,
    required: false,
  })
  @IsOptional()
  @IsEnum(OfferCategory, { message: 'Category must be one of: Development, Marketing, Teaching Online, Video Editing, Coaching' })
  category?: string;

  @ApiProperty({
    description: 'Search term to filter by title or keywords',
    example: 'react',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
