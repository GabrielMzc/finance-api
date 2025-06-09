import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(registerDto: RegisterDto): Promise<User> {
    const { email } = registerDto;

    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Este email já está em uso');
    }

    const user = this.usersRepository.create(registerDto);
    return this.usersRepository.save(user);
  }

  async updateRefreshToken(
    userId: number,
    refreshToken: string | null,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    user.refreshToken = refreshToken === null ? undefined : refreshToken;
    await this.usersRepository.save(user);
  }
}
