import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { User } from '../entities/user.entity';
import { RegisterDto } from '../../auth/dto/register.dto';

describe('UsersService', () => {
  let service: UsersService;
  let repository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const mockUser = {
    id: 1,
    name: 'Usuário Teste',
    email: 'usuario@teste.com',
    password: 'senha-hashed',
    refreshToken: 'refresh-token',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should return a user when found by email', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('usuario@teste.com');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'usuario@teste.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by email', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('inexistente@teste.com');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'inexistente@teste.com' },
      });
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user when found by id', async () => {
      repository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(1);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by id', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 999 },
      });
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const registerDto: RegisterDto = {
        name: 'Novo Usuário',
        email: 'novo@teste.com',
        password: 'Senha@123',
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue({
        ...registerDto,
        id: 2,
      });
      repository.save.mockResolvedValue({
        id: 2,
        ...registerDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(registerDto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(repository.create).toHaveBeenCalledWith(registerDto);
      expect(repository.save).toHaveBeenCalled();
      expect(result.email).toEqual(registerDto.email);
      expect(result.name).toEqual(registerDto.name);
      expect(result.id).toBeDefined();
    });

    it('should throw ConflictException when email already exists', async () => {
      const registerDto: RegisterDto = {
        name: 'Usuário Existente',
        email: 'usuario@teste.com',
        password: 'Senha@123',
      };

      repository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateRefreshToken', () => {
    it('should update refresh token successfully', async () => {
      const userId = 1;
      const newRefreshToken = 'new-refresh-token';

      repository.findOne.mockResolvedValue({
        ...mockUser,
        refreshToken: 'old-refresh-token',
      });
      repository.save.mockResolvedValue({
        ...mockUser,
        refreshToken: newRefreshToken,
      });

      await service.updateRefreshToken(userId, newRefreshToken);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: userId,
          refreshToken: newRefreshToken,
        }),
      );
    });

    it('should clear refresh token when null is provided', async () => {
      const userId = 1;

      repository.findOne.mockResolvedValue({
        ...mockUser,
        refreshToken: 'old-refresh-token',
      });
      repository.save.mockResolvedValue({
        ...mockUser,
        refreshToken: undefined,
      });

      await service.updateRefreshToken(userId, null);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: userId,
          refreshToken: undefined,
        }),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 999;
      const newRefreshToken = 'new-refresh-token';

      repository.findOne.mockResolvedValue(null);

      await expect(
        service.updateRefreshToken(userId, newRefreshToken),
      ).rejects.toThrow(NotFoundException);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
