import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ description: 'Rating from 1 to 5', example: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Review message', example: 'Great work!' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
