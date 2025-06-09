import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from '../accounts.controller';
import { AccountsService } from '../accounts.service';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { Account, AccountType } from '../entities/account.entity';
import { User } from '../../users/entities/user.entity';

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    getSummary: jest.Mock;
  };

  const mockUserObject: User = {
    id: 1,
    name: 'Teste',
    email: 'teste@example.com',
    password: 'hashed-password',
    isActive: true,
    refreshToken: '',
    accounts: [],
    categories: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    hashPassword: jest.fn(),
    validatePassword: jest.fn(),
  };

  const mockUser = { id: 1, name: 'Teste', email: 'teste@example.com' };

  const mockAccount: Account = {
    id: 1,
    name: 'Conta Teste',
    type: AccountType.CHECKING,
    balance: 1000,
    institution: 'Banco Teste',
    accountNumber: '12345',
    color: '#3498db',
    isActive: true,
    userId: 1,
    user: mockUserObject,
    transactions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getSummary: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        {
          provide: AccountsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new account', async () => {
      // Arrange
      const createDto: CreateAccountDto = {
        name: 'Nova Conta',
        type: AccountType.CHECKING,
        initialBalance: 500,
      };

      const req = { user: mockUser };
      service.create.mockResolvedValue(mockAccount);

      // Act
      const result = await controller.create(req, createDto);

      // Assert
      expect(service.create).toHaveBeenCalledWith(1, createDto);
      expect(result).toEqual(mockAccount);
    });
  });

  describe('findAll', () => {
    it('should return an array of accounts', async () => {
      // Arrange
      const req = { user: mockUser };
      const accounts = [
        mockAccount,
        { ...mockAccount, id: 2, name: 'Conta 2' },
      ];
      service.findAll.mockResolvedValue(accounts);

      // Act
      const result = await controller.findAll(req);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(1);
      expect(result).toEqual(accounts);
      expect(result.length).toBe(2);
    });
  });

  describe('getSummary', () => {
    it('should return account summary', async () => {
      // Arrange
      const req = { user: mockUser };
      const summary = { totalBalance: 1500, accountCount: 2 };
      service.getSummary.mockResolvedValue(summary);

      // Act
      const result = await controller.getSummary(req);

      // Assert
      expect(service.getSummary).toHaveBeenCalledWith(1);
      expect(result).toEqual(summary);
    });
  });

  describe('findOne', () => {
    it('should return a single account', async () => {
      // Arrange
      const req = { user: mockUser };
      const id = '1';
      service.findOne.mockResolvedValue(mockAccount);

      // Act
      const result = await controller.findOne(id, req);

      // Assert
      expect(service.findOne).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual(mockAccount);
    });
  });

  describe('update', () => {
    it('should update an account', async () => {
      // Arrange
      const req = { user: mockUser };
      const id = '1';
      const updateDto: UpdateAccountDto = {
        name: 'Conta Atualizada',
        institution: 'Novo Banco',
      };

      const updatedAccount = {
        ...mockAccount,
        name: updateDto.name,
        institution: updateDto.institution,
      };

      service.update.mockResolvedValue(updatedAccount);

      // Act
      const result = await controller.update(id, req, updateDto);

      // Assert
      expect(service.update).toHaveBeenCalledWith(1, 1, updateDto);
      expect(result).toEqual(updatedAccount);
    });
  });

  describe('remove', () => {
    it('should remove an account', async () => {
      // Arrange
      const req = { user: mockUser };
      const id = '1';
      service.remove.mockResolvedValue(undefined);

      // Act
      const result = await controller.remove(id, req);

      // Assert
      expect(service.remove).toHaveBeenCalledWith(1, 1);
      expect(result).toBeUndefined();
    });
  });
});
