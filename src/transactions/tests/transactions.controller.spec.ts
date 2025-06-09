import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from '../transactions.controller';
import { TransactionsService } from '../transactions.service';
import { AutoCategorizationService } from '../../smart-analytics/services/auto-categorization.service';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { QueryTransactionsDto } from '../dto/query-transactions.dto';
import { Transaction, TransactionType } from '../entities/transaction.entity';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let transactionsService: TransactionsService;
  let autoCategorizationService: AutoCategorizationService;

  const mockUser = { id: '1' };
  const mockRequest = { user: mockUser };

  const mockTransaction: Transaction = {
    id: 1,
    description: 'Test Transaction',
    amount: 100,
    date: new Date('2023-06-15'),
    type: TransactionType.INCOME,
    isPaid: true,
    accountId: 1,
    account: {
      id: 1,
      name: 'Checking Account',
      balance: 1000,
      type: 'CHECKING',
      userId: 1,
    },
    destinationAccountId: null,
    destinationAccount: null,
    userId: 1,
    categoryId: 2,
    category: {
      id: 2,
      name: 'Salary',
      type: 'INCOME',
      icon: 'money',
      userId: 1,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Transaction;

  const mockTransactionsService = {
    create: jest.fn().mockResolvedValue(mockTransaction),
    findAll: jest.fn().mockResolvedValue([mockTransaction]),
    findOne: jest.fn().mockResolvedValue(mockTransaction),
    update: jest
      .fn()
      .mockResolvedValue({ ...mockTransaction, description: 'Updated' }),
    remove: jest.fn().mockResolvedValue(undefined),
    findByPeriod: jest.fn().mockResolvedValue([mockTransaction]),
  };

  const mockAutoCategorizationService = {
    suggestCategory: jest.fn().mockResolvedValue({
      categoryId: 2,
      confidence: 0.8,
      categoryName: 'Salary',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: mockTransactionsService },
        {
          provide: AutoCategorizationService,
          useValue: mockAutoCategorizationService,
        },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
    transactionsService = module.get<TransactionsService>(TransactionsService);
    autoCategorizationService = module.get<AutoCategorizationService>(
      AutoCategorizationService,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new transaction', async () => {
      // Arrange
      const createDto: CreateTransactionDto = {
        description: 'New Transaction',
        amount: 100,
        date: new Date(),
        type: TransactionType.INCOME,
        accountId: 1,
        categoryId: 2,
        isPaid: true,
      };

      // Act
      const result = await controller.create(mockRequest, createDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.create).toHaveBeenCalledWith(1, createDto);
      expect(result).toEqual(mockTransaction);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(autoCategorizationService.suggestCategory).not.toHaveBeenCalled();
    });

    it('should suggest category when categoryId is not provided', async () => {
      // Arrange
      const createDto: CreateTransactionDto = {
        description: 'No Category',
        amount: 100,
        date: new Date(),
        type: TransactionType.INCOME,
        accountId: 1,
        isPaid: true,
      };

      // Act
      await controller.create(mockRequest, createDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(autoCategorizationService.suggestCategory).toHaveBeenCalledWith(
        'No Category',
        100,
        1,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.create).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ categoryId: 2 }),
      );
    });

    it('should not assign category if confidence is low', async () => {
      // Arrange
      mockAutoCategorizationService.suggestCategory.mockResolvedValueOnce({
        categoryId: 2,
        confidence: 0.3, // Below 0.5 threshold
        categoryName: 'Salary',
      });

      const createDto: CreateTransactionDto = {
        description: 'Low Confidence',
        amount: 100,
        date: new Date(),
        type: TransactionType.INCOME,
        accountId: 1,
        isPaid: true,
      };

      // Act
      await controller.create(mockRequest, createDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.create).toHaveBeenCalledWith(
        1,
        expect.not.objectContaining({ categoryId: expect.any(Number) }),
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of transactions', async () => {
      // Arrange
      const queryDto = new QueryTransactionsDto();

      // Act
      const result = await controller.findAll(mockRequest, queryDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.findAll).toHaveBeenCalledWith(1, queryDto);
      expect(result).toEqual([mockTransaction]);
    });
  });

  describe('getByPeriod', () => {
    it('should return transactions for current month', async () => {
      // Act
      const result = await controller.getByPeriod(mockRequest, 'current-month');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.findByPeriod).toHaveBeenCalledWith(
        1,
        expect.any(Date),
        expect.any(Date),
      );
      expect(result).toEqual([mockTransaction]);
    });

    it('should return transactions for last month', async () => {
      // Act
      const result = await controller.getByPeriod(mockRequest, 'last-month');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.findByPeriod).toHaveBeenCalledWith(
        1,
        expect.any(Date),
        expect.any(Date),
      );
      expect(result).toEqual([mockTransaction]);
    });

    it('should return transactions for current year', async () => {
      // Act
      const result = await controller.getByPeriod(mockRequest, 'current-year');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.findByPeriod).toHaveBeenCalledWith(
        1,
        expect.any(Date),
        expect.any(Date),
      );
      expect(result).toEqual([mockTransaction]);
    });

    it('should return transactions for last 30 days', async () => {
      // Act
      const result = await controller.getByPeriod(mockRequest, 'last-30-days');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.findByPeriod).toHaveBeenCalledWith(
        1,
        expect.any(Date),
        expect.any(Date),
      );
      expect(result).toEqual([mockTransaction]);
    });

    it('should use default period for invalid period', async () => {
      // Act
      const result = await controller.getByPeriod(
        mockRequest,
        'invalid-period',
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.findByPeriod).toHaveBeenCalledWith(
        1,
        expect.any(Date),
        expect.any(Date),
      );
      expect(result).toEqual([mockTransaction]);
    });
  });

  describe('getSummary', () => {
    it('should return financial summary for specified period', async () => {
      // Arrange
      const incomeTransaction = {
        ...mockTransaction,
        type: TransactionType.INCOME,
        amount: 1000,
      };
      const expenseTransaction = {
        ...mockTransaction,
        type: TransactionType.EXPENSE,
        amount: -500,
        category: {
          id: 3,
          name: 'Food',
          type: 'EXPENSE',
          icon: 'food',
          userId: 1,
        },
      };

      mockTransactionsService.findByPeriod.mockResolvedValueOnce([
        incomeTransaction,
        expenseTransaction,
      ]);

      // Act
      const result = await controller.getSummary(
        mockRequest,
        '2023-01-01',
        '2023-01-31',
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.findByPeriod).toHaveBeenCalledWith(
        1,
        expect.any(Date),
        expect.any(Date),
      );
      expect(result).toHaveProperty('totals');
      expect(result.totals).toEqual({
        income: 1000,
        expense: 500,
        balance: 500,
      });
      expect(result.categoriesByExpense).toHaveLength(1);
      expect(result.categoriesByExpense[0]).toEqual({
        name: 'Food',
        amount: 500,
      });
    });

    it('should use default dates when not provided', async () => {
      // Act
      await controller.getSummary(mockRequest);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.findByPeriod).toHaveBeenCalledWith(
        1,
        expect.any(Date),
        expect.any(Date),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single transaction', async () => {
      // Act
      const result = await controller.findOne('1', mockRequest);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.findOne).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual(mockTransaction);
    });
  });

  describe('update', () => {
    it('should update a transaction', async () => {
      // Arrange
      const updateDto: UpdateTransactionDto = {
        description: 'Updated Transaction',
      };

      // Act
      const result = await controller.update('1', mockRequest, updateDto);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.update).toHaveBeenCalledWith(1, 1, updateDto);
      expect(result).toEqual(
        expect.objectContaining({ description: 'Updated' }),
      );
    });
  });

  describe('remove', () => {
    it('should remove a transaction', async () => {
      // Act
      const result = await controller.remove('1', mockRequest);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(transactionsService.remove).toHaveBeenCalledWith(1, 1);
      expect(result).toBeUndefined();
    });
  });
});
