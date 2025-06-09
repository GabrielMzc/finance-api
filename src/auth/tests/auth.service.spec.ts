import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { CategoriesService } from '../../categories/categories.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';

describe('AuthService', () => {
  // Definindo os tipos corretos para os mocks
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    updateRefreshToken: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
  };
  let categoriesService: {
    createDefaultCategories: jest.Mock;
  };
  let _configService: {
    get: jest.Mock;
  };

  const mockUser = {
    id: 1,
    name: 'Usuário Teste',
    email: 'usuario@teste.com',
    password: 'senha-hashed',
    refreshToken: 'old-refresh-token',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    validatePassword: jest.fn(),
    hashPassword: jest.fn(),
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateRefreshToken: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const mockCategoriesService = {
      createDefaultCategories: jest.fn().mockResolvedValue(undefined),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CategoriesService, useValue: mockCategoriesService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    _configService = module.get(ConfigService);
    categoriesService = module.get(CategoriesService);

    jest.spyOn(service, 'validateUser');
    jest.spyOn(service, 'login');
    jest.spyOn(service, 'register');
    jest.spyOn(service, 'refreshToken');
    jest.spyOn(service, 'logout');
    jest.spyOn(service, 'getProfile');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return null when user not found', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(null);

      // Act
      const result = await service.validateUser(
        'unknown@email.com',
        'password',
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      // Arrange
      usersService.findByEmail.mockResolvedValue(mockUser);
      mockUser.validatePassword.mockResolvedValue(false);

      // Act
      const result = await service.validateUser(
        'usuario@teste.com',
        'wrong-password',
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should throw when database error occurs', async () => {
      // Arrange
      usersService.findByEmail.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.validateUser('usuario@teste.com', 'password'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('login', () => {
    it('should return tokens and user data when login is successful', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'usuario@teste.com',
        password: 'Senha@123',
      };

      const authenticatedUser = {
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
        accounts: [],
        categories: [],
      };

      // Mock validateUser method
      jest.spyOn(service, 'validateUser').mockResolvedValue(authenticatedUser);

      // Mock JWT and refresh token generation
      jwtService.signAsync.mockResolvedValueOnce('new-access-token');
      jwtService.signAsync.mockResolvedValueOnce('new-refresh-token');
      usersService.updateRefreshToken.mockResolvedValue(undefined);

      // Act
      const result = await service.login(loginDto);

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.validateUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        'new-refresh-token',
      );
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
        },
      });
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      // Arrange
      const loginDto: LoginDto = {
        email: 'usuario@teste.com',
        password: 'wrong-password',
      };

      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        name: 'Novo Usuário',
        email: 'novo@teste.com',
        password: 'Senha@123',
      };

      const createdUser = {
        ...mockUser,
        name: registerDto.name,
        email: registerDto.email,
      };

      usersService.create.mockResolvedValue(createdUser);
      jwtService.signAsync.mockResolvedValueOnce('new-access-token');
      jwtService.signAsync.mockResolvedValueOnce('new-refresh-token');
      usersService.updateRefreshToken.mockResolvedValue(undefined);

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(usersService.create).toHaveBeenCalledWith(registerDto);
      expect(categoriesService.createDefaultCategories).toHaveBeenCalledWith(
        createdUser.id,
      );
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
        },
      });
    });

    it('should throw BadRequestException when email already exists', async () => {
      // Arrange
      const registerDto: RegisterDto = {
        name: 'Novo Usuário',
        email: 'existente@teste.com',
        password: 'Senha@123',
      };

      usersService.create.mockRejectedValue({ code: '23505' }); // PostgreSQL unique violation

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should generate new tokens when refresh token is valid', async () => {
      // Arrange
      const oldRefreshToken = 'valid-refresh-token';
      const payload = { sub: 1, email: 'usuario@teste.com' };

      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findById.mockResolvedValue({
        ...mockUser,
        refreshToken: oldRefreshToken,
      });
      jwtService.signAsync.mockResolvedValueOnce('new-access-token');
      jwtService.signAsync.mockResolvedValueOnce('new-refresh-token');
      usersService.updateRefreshToken.mockResolvedValue(undefined);

      // Act
      const result = await service.refreshToken(oldRefreshToken);

      // Assert
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        oldRefreshToken,
        expect.any(Object),
      );
      expect(usersService.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      // Arrange
      const invalidToken = 'invalid-token';
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(service.refreshToken(invalidToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Arrange
      const refreshToken = 'valid-token';
      const payload = { sub: 999 }; // Non-existent user ID

      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when stored token does not match', async () => {
      // Arrange
      const refreshToken = 'valid-token';
      const payload = { sub: 1 };

      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findById.mockResolvedValue({
        ...mockUser,
        refreshToken: 'different-token', // Token does not match
      });

      // Act & Assert
      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should clear refresh token when logout is successful', async () => {
      // Arrange
      usersService.updateRefreshToken.mockResolvedValue(undefined);

      // Act
      const result = await service.logout(1);

      // Assert
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith(1, null);
      expect(result).toEqual({ message: 'Logout realizado com sucesso' });
    });

    it('should throw InternalServerErrorException when update fails', async () => {
      // Arrange
      usersService.updateRefreshToken.mockRejectedValue(
        new Error('Update failed'),
      );

      // Act & Assert
      await expect(service.logout(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile without sensitive fields', async () => {
      // Arrange
      usersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.getProfile(1);

      // Assert
      expect(usersService.findById).toHaveBeenCalledWith(1);
      expect(result).toMatchObject({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      usersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getProfile(999)).rejects.toThrow(NotFoundException);
    });
  });
});
