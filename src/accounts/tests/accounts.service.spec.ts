import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AccountsService } from '../accounts.service';
import { Account, AccountType } from '../entities/account.entity';
import { TransactionsService } from '../../transactions/transactions.service';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';

describe('AccountsService', () => {
  let service: AccountsService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let transactionsService: {
    hasTransactionsForAccount: jest.Mock;
  };

  const mockAccount = {
    id: 1,
    name: 'Conta Teste',
    type: AccountType.CHECKING,
    balance: 1000,
    institution: 'Banco Teste',
    accountNumber: '12345',
    color: '#3498db',
    isActive: true,
    userId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    transactionsService = {
      hasTransactionsForAccount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: getRepositoryToken(Account),
          useValue: repository,
        },
        {
          provide: TransactionsService,
          useValue: transactionsService,
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new account successfully', async () => {
      const userId = 1;
      const createAccountDto: CreateAccountDto = {
        name: 'Nova Conta',
        type: AccountType.CHECKING,
        initialBalance: 500,
        institution: 'Banco Novo',
        accountNumber: '54321',
        color: '#FF5733',
      };

      const expectedAccount = {
        ...createAccountDto,
        balance: createAccountDto.initialBalance,
        userId,
        id: 2,
      };

      repository.create.mockReturnValue(expectedAccount);
      repository.save.mockResolvedValue(expectedAccount);

      const result = await service.create(userId, createAccountDto);

      expect(repository.create).toHaveBeenCalledWith({
        name: createAccountDto.name,
        type: createAccountDto.type,
        balance: createAccountDto.initialBalance,
        institution: createAccountDto.institution,
        accountNumber: createAccountDto.accountNumber,
        color: createAccountDto.color,
        userId,
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(expectedAccount);
    });

    it('should create account with zero balance when initialBalance is not provided', async () => {
      const userId = 1;
      const createAccountDto: CreateAccountDto = {
        name: 'Conta Sem Saldo',
        type: AccountType.SAVINGS,
      };

      const expectedAccount = {
        ...createAccountDto,
        balance: 0,
        userId,
        id: 3,
      };

      repository.create.mockReturnValue(expectedAccount);
      repository.save.mockResolvedValue(expectedAccount);

      const result = await service.create(userId, createAccountDto);

      expect(repository.create).toHaveBeenCalledWith({
        name: createAccountDto.name,
        type: createAccountDto.type,
        balance: 0,
        userId,
      });
      expect(result.balance).toBe(0);
    });
  });

  describe('findAll', () => {
    it('should return all accounts for a user', async () => {
      const userId = 1;
      const accounts = [
        mockAccount,
        { ...mockAccount, id: 2, name: 'Conta Secundária' },
      ];

      repository.find.mockResolvedValue(accounts);

      const result = await service.findAll(userId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { name: 'ASC' },
      });
      expect(result).toEqual(accounts);
      expect(result.length).toBe(2);
    });

    it('should return empty array when user has no accounts', async () => {
      const userId = 999;
      repository.find.mockResolvedValue([]);

      const result = await service.findAll(userId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { name: 'ASC' },
      });
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return an account when found', async () => {
      // Arrange
      const userId = 1;
      const accountId = 1;
      repository.findOne.mockResolvedValue(mockAccount);

      // Act
      const result = await service.findOne(accountId, userId);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: accountId, userId },
      });
      expect(result).toEqual(mockAccount);
    });

    it('should throw NotFoundException when account not found', async () => {
      // Arrange
      const userId = 1;
      const accountId = 999;
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(accountId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: accountId, userId },
      });
    });
  });

  describe('update', () => {
    it('should update an account successfully', async () => {
      // Arrange
      const userId = 1;
      const accountId = 1;
      const updateAccountDto: UpdateAccountDto = {
        name: 'Conta Atualizada',
        institution: 'Novo Banco',
      };

      const existingAccount = { ...mockAccount };
      const updatedAccount = {
        ...existingAccount,
        ...updateAccountDto,
      };

      repository.findOne.mockResolvedValue(existingAccount);
      repository.save.mockResolvedValue(updatedAccount);

      // Act
      const result = await service.update(accountId, userId, updateAccountDto);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: accountId, userId },
      });
      expect(repository.save).toHaveBeenCalledWith({
        ...existingAccount,
        ...updateAccountDto,
      });
      expect(result).toEqual(updatedAccount);
    });

    it('should ignore initialBalance when updating', async () => {
      // Arrange
      const userId = 1;
      const accountId = 1;
      const updateAccountDto: UpdateAccountDto = {
        name: 'Conta Atualizada',
        initialBalance: 2000, // Não deveria atualizar o saldo
      };

      const existingAccount = { ...mockAccount };
      const updatedAccount = {
        ...existingAccount,
        name: updateAccountDto.name,
        // Não deve conter initialBalance
      };

      repository.findOne.mockResolvedValue(existingAccount);
      repository.save.mockResolvedValue(updatedAccount);

      // Act
      const result = await service.update(accountId, userId, updateAccountDto);

      // Assert
      expect(repository.save).toHaveBeenCalledWith({
        ...existingAccount,
        name: updateAccountDto.name,
        // Não deve conter initialBalance
      });
      expect(result).toEqual(updatedAccount);
      // Verificar que o saldo não foi atualizado
      expect(result.balance).toBe(existingAccount.balance);
    });

    it('should throw NotFoundException when account not found', async () => {
      // Arrange
      const userId = 1;
      const accountId = 999;
      const updateAccountDto: UpdateAccountDto = {
        name: 'Conta Atualizada',
      };

      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(accountId, userId, updateAccountDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an account successfully when it has no transactions', async () => {
      // Arrange
      const userId = 1;
      const accountId = 1;

      repository.findOne.mockResolvedValue(mockAccount);
      transactionsService.hasTransactionsForAccount.mockResolvedValue(false);
      repository.remove.mockResolvedValue(undefined);

      // Act
      await service.remove(accountId, userId);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: accountId, userId },
      });
      expect(
        transactionsService.hasTransactionsForAccount,
      ).toHaveBeenCalledWith(accountId);
      expect(repository.remove).toHaveBeenCalledWith(mockAccount);
    });

    it('should throw ForbiddenException when account has transactions', async () => {
      // Arrange
      const userId = 1;
      const accountId = 1;

      repository.findOne.mockResolvedValue(mockAccount);
      transactionsService.hasTransactionsForAccount.mockResolvedValue(true);

      // Act & Assert
      await expect(service.remove(accountId, userId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when account not found', async () => {
      // Arrange
      const userId = 1;
      const accountId = 999;

      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(accountId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(
        transactionsService.hasTransactionsForAccount,
      ).not.toHaveBeenCalled();
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('should return correct summary of user accounts', async () => {
      // Arrange
      const userId = 1;
      const accounts = [
        { ...mockAccount, balance: 1000 },
        { ...mockAccount, id: 2, name: 'Conta 2', balance: 2000 },
        { ...mockAccount, id: 3, name: 'Conta 3', balance: 3000 },
      ];

      repository.find.mockResolvedValue(accounts);

      // Act
      const result = await service.getSummary(userId);

      // Assert
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { name: 'ASC' },
      });
      expect(result).toEqual({
        totalBalance: 6000,
        accountCount: 3,
      });
    });

    it('should return zero balance when user has no accounts', async () => {
      // Arrange
      const userId = 999;
      repository.find.mockResolvedValue([]);

      // Act
      const result = await service.getSummary(userId);

      // Assert
      expect(result).toEqual({
        totalBalance: 0,
        accountCount: 0,
      });
    });
  });

  describe('updateBalance', () => {
    it('should update account balance correctly when adding amount', async () => {
      // Arrange
      const accountId = 1;
      const amount = 500;
      const currentBalance = 1000;
      const updatedBalance = currentBalance + amount;

      const account = { ...mockAccount, balance: currentBalance };
      const updatedAccount = { ...account, balance: updatedBalance };

      repository.findOne.mockResolvedValue(account);
      repository.save.mockResolvedValue(updatedAccount);

      // Act
      const result = await service.updateBalance(accountId, amount);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: accountId },
      });
      expect(repository.save).toHaveBeenCalledWith({
        ...account,
        balance: updatedBalance,
      });
      expect(result.balance).toBe(updatedBalance);
    });

    it('should update account balance correctly when subtracting amount', async () => {
      // Arrange
      const accountId = 1;
      const amount = -300;
      const currentBalance = 1000;
      const updatedBalance = currentBalance + amount; // 700

      const account = { ...mockAccount, balance: currentBalance };
      const updatedAccount = { ...account, balance: updatedBalance };

      repository.findOne.mockResolvedValue(account);
      repository.save.mockResolvedValue(updatedAccount);

      // Act
      const result = await service.updateBalance(accountId, amount);

      // Assert
      expect(repository.save).toHaveBeenCalledWith({
        ...account,
        balance: updatedBalance,
      });
      expect(result.balance).toBe(updatedBalance);
    });

    it('should throw NotFoundException when account not found', async () => {
      // Arrange
      const accountId = 999;
      const amount = 500;

      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateBalance(accountId, amount)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
