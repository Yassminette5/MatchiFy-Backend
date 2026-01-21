import { ApiProperty } from '@nestjs/swagger';

export class ValidationErrorDto {
  @ApiProperty({
    description: 'Error message',
    example: 'Validation failed',
  })
  message: string;

  @ApiProperty({
    description: 'List of missing required fields',
    example: ['title', 'content', 'recruiterSignature'],
    type: [String],
  })
  missingFields: string[];

  @ApiProperty({
    description: 'Detailed field errors',
    example: {
      title: 'Title is required',
      content: 'Content is required',
      recruiterSignature: 'Recruiter signature is required',
    },
  })
  fieldErrors: Record<string, string>;
}

