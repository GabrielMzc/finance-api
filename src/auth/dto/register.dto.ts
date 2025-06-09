import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'João Silva' })
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres' })
  name: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Por favor, forneça um email válido' })
  @IsNotEmpty({ message: 'O email é obrigatório' })
  email: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'A senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número ou caractere especial',
  })
  password: string;
}
