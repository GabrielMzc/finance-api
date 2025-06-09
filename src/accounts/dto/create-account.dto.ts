import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsHexColor,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from '../entities/account.entity';

export class CreateAccountDto {
  @ApiProperty({ example: 'Conta Nubank' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.CHECKING })
  @IsNotEmpty()
  @IsEnum(AccountType)
  type: AccountType;

  @ApiProperty({ example: 1000.5, required: false })
  @IsOptional()
  @IsNumber()
  initialBalance?: number;

  @ApiProperty({ example: 'Nubank', required: false })
  @IsOptional()
  @IsString()
  institution?: string;

  @ApiProperty({ example: '123456', required: false })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiProperty({ example: '#7159c1', required: false })
  @IsOptional()
  @IsHexColor()
  color?: string;
}
