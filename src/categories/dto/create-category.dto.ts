import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '../entities/category.entity';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Alimentação' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '#4CAF50', required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({
    enum: CategoryType,
    example: CategoryType.EXPENSE,
    description: 'Tipo de categoria: despesa, receita ou ambos',
  })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty({ example: 'food', required: false })
  @IsOptional()
  @IsString()
  icon?: string;
}
