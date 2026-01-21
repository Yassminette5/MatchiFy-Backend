import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsArray, Min, IsEnum, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum OfferCategory {
  DEVELOPMENT = 'Development',
  MARKETING = 'Marketing',
  TEACHING_ONLINE = 'Teaching Online',
  VIDEO_EDITING = 'Video Editing',
  COACHING = 'Coaching',
}

export class CreateOfferDto {
  @ApiProperty({
    description: 'Category of the service offer',
    example: 'Development',
    enum: OfferCategory,
  })
  @IsEnum(OfferCategory, { message: 'Category must be one of: Development, Marketing, Teaching Online, Video Editing, Coaching' })
  @IsNotEmpty({ message: 'Category is required' })
  category: string;

  @ApiProperty({
    description: 'Title of the service offer',
    example: 'Full Stack Web Development Services',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @ApiProperty({
    description: 'Keywords/tags for the service offer',
    example: ['React', 'Node.js', 'TypeScript', 'MongoDB'],
    type: [String],
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(k => k.trim()).filter(k => k.length > 0);
    }
    return Array.isArray(value) ? value : [];
  })
  @IsArray({ message: 'Keywords must be an array' })
  @IsString({ each: true, message: 'Each keyword must be a string' })
  @IsNotEmpty({ message: 'Keywords are required' })
  keywords: string[];

  @ApiProperty({
    description: 'Price for the service',
    example: 5000,
    minimum: 0,
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return Number.parseFloat(value);
    }
    return value;
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price must be positive' })
  @IsNotEmpty({ message: 'Price is required' })
  price: number;

  @ApiProperty({
    description: 'Detailed description of the service offer',
    example: 'I offer professional full stack web development services using modern technologies...',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description: string;

  @ApiProperty({
    description: 'List of capabilities/skills offered',
    example: ['Build responsive websites', 'API development', 'Database design'],
    type: [String],
    required: false,
  })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      return value.split(',').map(c => c.trim()).filter(c => c.length > 0);
    }
    return Array.isArray(value) ? value : undefined;
  })
  @IsArray({ message: 'Capabilities must be an array' })
  @IsString({ each: true, message: 'Each capability must be a string' })
  @IsOptional()
  capabilities?: string[];
}
