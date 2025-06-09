import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';

/**
 * Tipo que representa um usuário autenticado, omitindo campos sensíveis
 */
type AuthenticatedUser = Omit<
  User,
  'password' | 'refreshToken' | 'validatePassword' | 'hashPassword'
>;

/**
 * Serviço responsável por gerenciar autenticação e autorização de usuários
 */
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Valida as credenciais de um usuário
   *
   * @param email - Email do usuário
   * @param password - Senha do usuário
   * @returns Dados do usuário sem informações sensíveis, ou null se as credenciais forem inválidas
   * @throws InternalServerErrorException - Erro ao tentar validar o usuário
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    try {
      const user = await this.usersService.findByEmail(email);

      if (!user) {
        return null;
      }

      const isPasswordValid = await user.validatePassword(password);

      if (!isPasswordValid) {
        return null;
      }

      const { password: _, refreshToken: __, ...result } = user;
      return result as AuthenticatedUser;
    } catch {
      throw new InternalServerErrorException('Erro ao validar usuário');
    }
  }

  /**
   * Realiza o login de um usuário e gera tokens de acesso
   *
   * @param loginDto - Dados de login (email e senha)
   * @returns Tokens de acesso e dados básicos do usuário
   * @throws UnauthorizedException - Credenciais inválidas
   * @throws InternalServerErrorException - Erro no processo de login
   */
  async login(loginDto: LoginDto) {
    try {
      const { email, password } = loginDto;
      const user = await this.validateUser(email, password);

      if (!user) {
        throw new UnauthorizedException('Credenciais inválidas');
      }

      const payload = { email: user.email, sub: user.id };

      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync(payload),
        this.generateRefreshToken(user.id),
      ]);

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Erro ao realizar login');
    }
  }

  /**
   * Registra um novo usuário no sistema
   *
   * @param registerDto - Dados para registro do usuário
   * @returns Tokens de acesso e dados básicos do usuário criado
   * @throws BadRequestException - Email já registrado
   * @throws InternalServerErrorException - Erro no processo de registro
   */
  async register(registerDto: RegisterDto) {
    try {
      const user = await this.usersService.create(registerDto);

      const payload = { email: user.email, sub: user.id };

      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync(payload),
        this.generateRefreshToken(user.id),
      ]);

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };
    } catch (error) {
      if (error.code === '23505') {
        // PostgreSQL unique violation error code
        throw new BadRequestException('Este email já está registrado');
      }
      throw new InternalServerErrorException('Erro ao registrar usuário');
    }
  }

  /**
   * Atualiza tokens de acesso usando um refresh token válido
   *
   * @param refreshToken - Token de refresh atual
   * @returns Novos tokens de acesso e refresh
   * @throws UnauthorizedException - Token inválido ou expirado
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.usersService.findById(Number(payload.sub));

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Refresh token inválido');
      }

      const newPayload = { email: user.email, sub: user.id };

      const [accessToken, newRefreshToken] = await Promise.all([
        this.jwtService.signAsync(newPayload),
        this.generateRefreshToken(user.id),
      ]);

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  /**
   * Realiza o logout de um usuário, invalidando seu refresh token
   *
   * @param userId - ID do usuário que deseja fazer logout
   * @returns Mensagem de confirmação
   * @throws InternalServerErrorException - Erro ao realizar logout
   */
  async logout(userId: number) {
    try {
      await this.usersService.updateRefreshToken(userId, null);
      return { message: 'Logout realizado com sucesso' };
    } catch {
      throw new InternalServerErrorException('Erro ao realizar logout');
    }
  }

  /**
   * Gera um novo refresh token para um usuário
   *
   * @param userId - ID do usuário
   * @returns Refresh token gerado
   * @private
   */
  private async generateRefreshToken(userId: number): Promise<string> {
    const payload = { sub: userId };
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret:
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_REFRESH_EXPIRATION_TIME',
        '7d',
      ),
    });

    await this.usersService.updateRefreshToken(userId, refreshToken);

    return refreshToken;
  }

  /**
   * Obtém o perfil completo de um usuário autenticado
   *
   * @param userId - ID do usuário
   * @returns Dados do perfil do usuário sem informações sensíveis
   * @throws NotFoundException - Usuário não encontrado
   */
  async getProfile(userId: number) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const { password: _, refreshToken: __, ...result } = user;

    return result;
  }
}
