import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';

/**
 * Serviço responsável por gerenciar operações relacionadas aos usuários
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Busca um usuário pelo email
   *
   * @param email - Email do usuário a ser buscado
   * @returns O usuário encontrado ou null se não existir
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  /**
   * Busca um usuário pelo ID
   *
   * @param id - ID do usuário a ser buscado
   * @returns O usuário encontrado ou null se não existir
   */
  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /**
   * Cria um novo usuário no sistema
   *
   * @param registerDto - Dados de registro do usuário
   * @returns O usuário criado
   * @throws ConflictException - Quando o email já está em uso
   */
  async create(registerDto: RegisterDto): Promise<User> {
    const { email } = registerDto;

    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Este email já está em uso');
    }

    const user = this.usersRepository.create(registerDto);
    return this.usersRepository.save(user);
  }

  /**
   * Atualiza o token de refresh de um usuário
   *
   * @param userId - ID do usuário a ser atualizado
   * @param refreshToken - Novo token de refresh ou null para remover
   * @throws NotFoundException - Quando o usuário não é encontrado
   */
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
