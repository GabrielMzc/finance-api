import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/users/entities/user.entity';

type AuthenticatedUser = Omit<
  User,
  'password' | 'refreshToken' | 'validatePassword' | 'hashPassword'
>;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

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

  async refreshToken(refreshToken: string) {
    try {
      // Verificar se o refresh token é válido
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

  async logout(userId: number) {
    try {
      await this.usersService.updateRefreshToken(userId, null);
      return { message: 'Logout realizado com sucesso' };
    } catch {
      throw new InternalServerErrorException('Erro ao realizar logout');
    }
  }

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
}
