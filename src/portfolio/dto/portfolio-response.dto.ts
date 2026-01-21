import { ApiProperty } from '@nestjs/swagger';
import { MediaItemDto } from './media-item.dto';

export class PortfolioResponseDto {
  @ApiProperty({
    description: 'Portfolio project ID',
    example: '673ab2c3e8f9a1234567890d',
  })
  _id: string;

  @ApiProperty({
    description: 'Talent user ID who owns this project',
    example: '673ab2c3e8f9a1234567890c',
  })
  talentId: string;

  @ApiProperty({
    description: 'Project title',
    example: 'E-commerce Mobile App',
  })
  title: string;

  @ApiProperty({
    description: 'Role in the project',
    example: 'Lead Developer',
    required: false,
  })
  role?: string;

  @ApiProperty({
    description: 'Array of media items (images, videos, PDFs, external links)',
    type: [MediaItemDto],
    example: [
      { type: 'image', url: 'uploads/portfolio/portfolio-image-123.jpg', title: 'Main Screenshot' },
      { type: 'video', url: 'uploads/portfolio/portfolio-video-456.mp4', title: 'Demo Video' },
      { type: 'external_link', externalLink: 'https://example.com/demo', title: 'Live Demo' },
    ],
  })
  media: MediaItemDto[];

  @ApiProperty({
    description: 'List of skills used in the project',
    example: ['React Native', 'Node.js', 'MongoDB'],
    type: [String],
  })
  skills: string[];

  @ApiProperty({
    description: 'Project description (full text, no length limit)',
    example: 'A full-stack e-commerce mobile application with real-time inventory management, advanced analytics, and seamless payment integration.',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'URL to the project (e.g., GitHub repository, website)',
    example: 'https://github.com/username/project',
    required: false,
  })
  projectLink?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}

