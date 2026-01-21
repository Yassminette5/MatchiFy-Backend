import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({
    description: 'Message text content',
    example: 'Hello, I am interested in this position.',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty({ message: 'Message text is required' })
  @MinLength(1, { message: 'Message text cannot be empty' })
  text: string;
}

