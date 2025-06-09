import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionsService } from './transactions.service';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { AccountsService } from '../accounts/accounts.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let repository: Repository<Transaction>;
  let _accountsService: AccountsService; // Renomeado com prefixo underscore

  const mockTransactionsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
    count: jest.fn(),
    remove: jest.fn(),
  };

  const mockAccountsService = {
    findOne: jest.fn(),
    updateBalance: jest.fn(),
  };

  beforeEach(async () => {
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
    _accountsService = module.get<AccountsService>(AccountsService); // Atualizado aqui também

    // Limpar todos os mocks antes de cada teste
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findRecent', () => {
    it('should return recent transactions for a user', async () => {
      // Arrange
      const userId = 1;
      const limit = 50;
      const mockTransactions = [
        {
          id: 1,
          description: 'Supermercado',
          amount: -150.0,
          type: TransactionType.EXPENSE,
          date: new Date('2023-05-01'),
          createdAt: new Date('2023-05-01T14:30:00'),
          userId,
        },
        {
          id: 2,
          description: 'Salário',
          amount: 3000.0,
          type: TransactionType.INCOME,
          date: new Date('2023-05-05'),
          createdAt: new Date('2023-05-05T10:00:00'),
          userId,
        },
      ] as Transaction[];

      mockTransactionsRepository.find.mockResolvedValue(mockTransactions);

      // Act
      const result = await service.findRecent(userId, limit);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { date: 'DESC', createdAt: 'DESC' },
        take: limit,
        relations: ['category', 'account'],
      });

      expect(result).toEqual(mockTransactions);
      expect(result).toHaveLength(2);
    });

    it('should use default limit of 100 when not specified', async () => {
      // Arrange
      const userId = 1;
      const defaultLimit = 100;
      mockTransactionsRepository.find.mockResolvedValue([]);

      // Act
      await service.findRecent(userId);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { date: 'DESC', createdAt: 'DESC' },
        take: defaultLimit,
        relations: ['category', 'account'],
      });
    });

    it('should return empty array when no transactions found', async () => {
      // Arrange
      const userId = 999; // Usuário sem transações
      mockTransactionsRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.findRecent(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });
});
