import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  const mockUser = {
    id: 1,
    name: 'Usuário Teste',
    email: 'usuario@teste.com',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuthResponse = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: {
      id: mockUser.id,
      name: mockUser.name,
      email: mockUser.email,
    },
  };

  const mockAuthService = {
    login: jest.fn().mockResolvedValue(mockAuthResponse),
    register: jest.fn().mockResolvedValue(mockAuthResponse),
    refreshToken: jest.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }),
    logout: jest
      .fn()
      .mockResolvedValue({ message: 'Logout realizado com sucesso' }),
    getProfile: jest.fn().mockResolvedValue(mockUser),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should login a user and return tokens', async () => {
      const loginDto: LoginDto = {
        email: 'usuario@teste.com',
        password: 'Senha@123',
      };

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      const registerDto: RegisterDto = {
        name: 'Usuário Teste',
        email: 'usuario@teste.com',
        password: 'Senha@123',
      };

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('refreshToken', () => {
    it('should refresh the access token', async () => {
      const refreshTokenDto = { refreshToken: 'old-refresh-token' };
      const expected = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      const result = await controller.refreshToken(refreshTokenDto);

      expect(authService.refreshToken).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('logout', () => {
    it('should logout a user', async () => {
      const req = { user: { id: 1 } };
      const expected = { message: 'Logout realizado com sucesso' };

      const result = await controller.logout(req);

      expect(authService.logout).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('getProfile', () => {
    it('should return the user profile', async () => {
      const req = { user: { id: 1 } };

      const result = await controller.getProfile(req);

      expect(authService.getProfile).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUser);
    });
  });
});
