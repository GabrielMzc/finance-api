import {
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsString,
  IsOptional,
  IsDate,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @ApiProperty({ example: 150.75 })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsNotEmpty()
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 'Supermercado', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2023-05-20' })
  @IsNotEmpty()
  @Type(() => Date)
  @Transform(({ value }: { value: string | number | Date }) => new Date(value))
  @IsDate()
  date: Date;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  accountId: number;

  @ApiProperty({ example: 2, required: false })
  @IsOptional()
  @IsNumber()
  destinationAccountId?: number;

  @ApiProperty({ example: 3, required: false })
  @IsOptional()
  @IsNumber()
  categoryId?: number;
}
