import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TransactionsService } from '../transactions.service';
import { Transaction, TransactionType } from '../entities/transaction.entity';
import { AccountsService } from '../../accounts/accounts.service';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { QueryTransactionsDto } from '../dto/query-transactions.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let repository: Repository<Transaction>;
  let accountsService: AccountsService;
  let queryBuilder: Partial<SelectQueryBuilder<Transaction>>;

  const mockTransaction = {
    id: 1,
    description: 'Test transaction',
    amount: 100,
    type: TransactionType.INCOME,
    date: new Date(),
    accountId: 1,
    userId: 1,
    isPaid: true,
    categoryId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Transaction;

  const mockTransactionsRepository = {
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest
      .fn()
      .mockImplementation((transaction) =>
        Promise.resolve({ id: 1, ...transaction }),
      ),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  };

  const mockAccountsService = {
    findOne: jest.fn().mockResolvedValue({ id: 1, balance: 1000 }),
    updateBalance: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockTransaction]),
      getRawMany: jest.fn().mockResolvedValue([{ userId: 1 }, { userId: 2 }]),
    };

    mockTransactionsRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionsRepository,
        },
        {
          provide: AccountsService,
          useValue: mockAccountsService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    repository = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    accountsService = module.get<AccountsService>(AccountsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateTransactionDto = {
      description: 'New transaction',
      amount: 100,
      type: TransactionType.INCOME,
      date: new Date(),
      accountId: 1,
      isPaid: true,
      categoryId: 1,
    };

    it('should create a new income transaction', async () => {
      // Act
      const result = await service.create(1, createDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        amount: 100,
        userId: 1,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.save).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(accountsService.updateBalance).toHaveBeenCalledWith(1, 100);
      expect(result.id).toBeDefined();
    });

    it('should create a new expense transaction with negative amount', async () => {
      // Arrange
      const expenseDto = { ...createDto, type: TransactionType.EXPENSE };

      // Act
      await service.create(1, expenseDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.create).toHaveBeenCalledWith({
        ...expenseDto,
        amount: -100,
        userId: 1,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(accountsService.updateBalance).toHaveBeenCalledWith(1, -100);
    });

    it('should create a transfer transaction', async () => {
      // Arrange
      const transferDto = {
        ...createDto,
        type: TransactionType.TRANSFER,
        destinationAccountId: 2,
      };

      // Act
      await service.create(1, transferDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(accountsService.findOne).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(accountsService.updateBalance).toHaveBeenCalledWith(1, -100);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(accountsService.updateBalance).toHaveBeenCalledWith(2, 100);
    });

    it('should throw BadRequestException when transfer has same origin and destination', async () => {
      // Arrange
      const invalidTransferDto = {
        ...createDto,
        type: TransactionType.TRANSFER,
        accountId: 1,
        destinationAccountId: 1,
      };

      // Act & Assert
      await expect(service.create(1, invalidTransferDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not update account balance when transaction is not paid', async () => {
      // Arrange
      const unpaidDto = { ...createDto, isPaid: false };

      // Act
      await service.create(1, unpaidDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(accountsService.updateBalance).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return transactions based on filters', async () => {
      // Arrange
      const queryDto: QueryTransactionsDto = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        type: TransactionType.EXPENSE,
        accountId: 1,
        categoryId: 2,
        search: 'groceries',
      };

      // Act
      await service.findAll(1, queryDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.where).toHaveBeenCalled();
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.description ILIKE :search',
        {
          search: '%groceries%',
        },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'transaction.date',
        'DESC',
      );
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });

    it('should find transactions without filters', async () => {
      // Arrange
      const emptyQueryDto = new QueryTransactionsDto();

      // Act
      await service.findAll(1, emptyQueryDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.where).toHaveBeenCalled();
      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a transaction if it exists', async () => {
      // Arrange
      mockTransactionsRepository.findOne.mockResolvedValue(mockTransaction);

      // Act
      const result = await service.findOne(1, 1);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 },
        relations: ['account', 'destinationAccount', 'category'],
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      // Arrange
      mockTransactionsRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateTransactionDto = {
      description: 'Updated transaction',
      amount: 150,
    };

    beforeEach(() => {
      mockTransactionsRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        id: 1,
        amount: 100,
        type: TransactionType.INCOME,
        isPaid: true,
      });
    });

    it('should update a transaction', async () => {
      // Act
      await service.update(1, 1, updateDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(accountsService.updateBalance).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.save).toHaveBeenCalled();
    });

    it('should handle changes in transaction type', async () => {
      // Arrange
      const typeChangeDto: UpdateTransactionDto = {
        ...updateDto,
        type: TransactionType.EXPENSE,
      };

      // Act
      await service.update(1, 1, typeChangeDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: -150,
        }),
      );
    });

    it('should handle account changes', async () => {
      // Arrange
      const accountChangeDto: UpdateTransactionDto = {
        accountId: 2,
      };

      // Act
      await service.update(1, 1, accountChangeDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(accountsService.findOne).toHaveBeenCalledWith(2, 1);
    });

    it('should handle transfer destination changes', async () => {
      // Arrange
      mockTransactionsRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        type: TransactionType.TRANSFER,
        destinationAccountId: 2,
      });

      const transferChangeDto: UpdateTransactionDto = {
        destinationAccountId: 3,
      };

      // Act
      await service.update(1, 1, transferChangeDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(accountsService.findOne).toHaveBeenCalledWith(3, 1);
    });
  });

  describe('remove', () => {
    it('should remove a transaction and reverse account balance', async () => {
      // Arrange
      mockTransactionsRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        isPaid: true,
      });

      // Act
      await service.remove(1, 1);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(accountsService.updateBalance).toHaveBeenCalledWith(1, -100);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.remove).toHaveBeenCalled();
    });

    it('should not reverse balance for unpaid transactions', async () => {
      // Arrange
      mockTransactionsRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        isPaid: false,
      });

      // Act
      await service.remove(1, 1);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(accountsService.updateBalance).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.remove).toHaveBeenCalled();
    });
  });

  describe('hasTransactionsForAccount', () => {
    it('should return true if account has transactions', async () => {
      // Arrange
      mockTransactionsRepository.count.mockResolvedValue(5);

      // Act
      const result = await service.hasTransactionsForAccount(1);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.count).toHaveBeenCalledWith({
        where: [{ accountId: 1 }, { destinationAccountId: 1 }],
      });
      expect(result).toBeTruthy();
    });

    it('should return false if account has no transactions', async () => {
      // Arrange
      mockTransactionsRepository.count.mockResolvedValue(0);

      // Act
      const result = await service.hasTransactionsForAccount(1);

      // Assert
      expect(result).toBeFalsy();
    });
  });

  describe('findByCategoryAndPeriod', () => {
    it('should find transactions by category and period', async () => {
      // Arrange
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      mockTransactionsRepository.find.mockResolvedValue([mockTransaction]);

      // Act
      const result = await service.findByCategoryAndPeriod(
        1,
        2,
        startDate,
        endDate,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.find).toHaveBeenCalledWith({
        where: {
          userId: 1,
          categoryId: 2,
          date: expect.any(Object),
          isPaid: true,
        },
        order: {
          date: 'ASC',
        },
      });
      expect(result).toEqual([mockTransaction]);
    });
  });

  describe('findByPeriod', () => {
    it('should find all transactions within a period', async () => {
      // Arrange
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      mockTransactionsRepository.find.mockResolvedValue([mockTransaction]);

      // Act
      const result = await service.findByPeriod(1, startDate, endDate);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.find).toHaveBeenCalledWith({
        where: {
          userId: 1,
          date: expect.any(Object),
          isPaid: true,
        },
        relations: ['category'],
        order: {
          date: 'ASC',
        },
      });
      expect(result).toEqual([mockTransaction]);
    });
  });

  describe('findRecent', () => {
    it('should return recent transactions for a user', async () => {
      // Arrange
      const userId = 1;
      const limit = 50;
      mockTransactionsRepository.find.mockResolvedValue([mockTransaction]);

      // Act
      const result = await service.findRecent(userId, limit);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { date: 'DESC', createdAt: 'DESC' },
        take: limit,
        relations: ['category', 'account'],
      });
      expect(result).toEqual([mockTransaction]);
    });

    it('should use default limit of 100 when not specified', async () => {
      // Act
      await service.findRecent(1);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });
  });

  describe('findCategorized', () => {
    it('should return categorized transactions for ML training', async () => {
      // Act
      const result = await service.findCategorized(2000);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'transaction.categoryId IS NOT NULL',
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'transaction.date',
        'DESC',
      );
      expect(queryBuilder.take).toHaveBeenCalledWith(2000);
      expect(result).toEqual([mockTransaction]);
    });

    it('should use default limit when not specified', async () => {
      // Act
      await service.findCategorized();

      // Assert
      expect(queryBuilder.take).toHaveBeenCalledWith(5000);
    });
  });

  describe('getDistinctUsers', () => {
    it('should return distinct user IDs with transactions', async () => {
      // Act
      const result = await service.getDistinctUsers();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.select).toHaveBeenCalledWith(
        'DISTINCT transaction.userId',
        'userId',
      );
      expect(result).toEqual([1, 2]);
    });
  });
});
