import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SignContractDto {
  @ApiProperty({
    description: 'Talent signature (base64 encoded image). Required to sign the contract.',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Talent signature is required' })
  talentSignature: string;
}

