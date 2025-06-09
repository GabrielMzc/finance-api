import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from '../categories.service';
import { Category, CategoryType } from '../entities/category.entity';
import { TransactionsService } from '../../transactions/transactions.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoriesRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let _transactionsService: {
    findByCategoryAndPeriod: jest.Mock;
  };

  const mockCategory = {
    id: 1,
    name: 'Alimentação',
    color: '#4CAF50',
    icon: 'restaurant',
    type: CategoryType.EXPENSE,
    isActive: true,
    userId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateCategoryDto: CreateCategoryDto = {
    name: 'Nova Categoria',
    type: CategoryType.EXPENSE,
    color: '#FF5733',
    icon: 'new_icon',
  };

  const mockUpdateCategoryDto: UpdateCategoryDto = {
    name: 'Categoria Atualizada',
    isActive: false,
  };

  const mockUser = { id: 1 };

  beforeEach(async () => {
    const mockQueryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };

    // Setup dos mocks
    const mockCategoriesRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const mockTransactionsService = {
      findByCategoryAndPeriod: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: mockCategoriesRepository,
        },
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    categoriesRepository = module.get(getRepositoryToken(Category));
    _transactionsService = module.get(TransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new category', async () => {
      // Arrange
      const userId = mockUser.id;

      categoriesRepository.create.mockReturnValue(mockCategory);
      categoriesRepository.save.mockResolvedValue(mockCategory);

      // Act
      const result = await service.create(userId, mockCreateCategoryDto);

      // Assert
      expect(categoriesRepository.create).toHaveBeenCalledWith({
        ...mockCreateCategoryDto,
        userId,
      });
      expect(categoriesRepository.save).toHaveBeenCalledWith(mockCategory);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('findAll', () => {
    it('should return all categories for a user', async () => {
      // Arrange
      const userId = mockUser.id;
      const categories = [mockCategory];

      categoriesRepository.find.mockResolvedValue(categories);

      // Act
      const result = await service.findAll(userId);

      // Assert
      expect(categoriesRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { name: 'ASC' },
      });
      expect(result).toEqual(categories);
    });

    it('should filter categories by type', async () => {
      // Arrange
      const userId = mockUser.id;
      const type = CategoryType.EXPENSE;
      const categories = [mockCategory];

      categoriesRepository.find.mockResolvedValue(categories);

      // Act
      const result = await service.findAll(userId, type);

      // Assert
      expect(categoriesRepository.find).toHaveBeenCalledWith({
        where: { userId, type: [type, CategoryType.BOTH] },
        order: { name: 'ASC' },
      });
      expect(result).toEqual(categories);
    });
  });

  describe('findOne', () => {
    it('should find a category by id', async () => {
      // Arrange
      const userId = mockUser.id;
      const categoryId = mockCategory.id;

      categoriesRepository.findOne.mockResolvedValue(mockCategory);

      // Act
      const result = await service.findOne(categoryId, userId);

      // Assert
      expect(categoriesRepository.findOne).toHaveBeenCalledWith({
        where: { id: categoryId, userId },
      });
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException when category not found', async () => {
      // Arrange
      const userId = mockUser.id;
      const categoryId = 999; // Non-existent ID

      categoriesRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(categoryId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      // Arrange
      const userId = mockUser.id;
      const categoryId = mockCategory.id;
      const updatedCategory = { ...mockCategory, ...mockUpdateCategoryDto };

      categoriesRepository.findOne.mockResolvedValue(mockCategory);
      categoriesRepository.save.mockResolvedValue(updatedCategory);

      // Act
      const result = await service.update(
        categoryId,
        userId,
        mockUpdateCategoryDto,
      );

      // Assert
      expect(categoriesRepository.findOne).toHaveBeenCalledWith({
        where: { id: categoryId, userId },
      });
      expect(categoriesRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockCategory,
          ...mockUpdateCategoryDto,
        }),
      );
      expect(result).toEqual(updatedCategory);
    });
  });

  describe('remove', () => {
    it('should remove a category without transactions', async () => {
      // Arrange
      const userId = mockUser.id;
      const categoryId = mockCategory.id;
      const queryBuilder = categoriesRepository.createQueryBuilder();

      categoriesRepository.findOne.mockResolvedValue(mockCategory);
      queryBuilder.getCount.mockResolvedValue(0);
      categoriesRepository.remove.mockResolvedValue(undefined);

      // Act
      await service.remove(categoryId, userId);

      // Assert
      expect(categoriesRepository.findOne).toHaveBeenCalledWith({
        where: { id: categoryId, userId },
      });
      expect(categoriesRepository.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'category.id = :categoryId',
        { categoryId },
      );
      expect(categoriesRepository.remove).toHaveBeenCalledWith(mockCategory);
    });

    it('should throw ForbiddenException when category has transactions', async () => {
      // Arrange
      const userId = mockUser.id;
      const categoryId = mockCategory.id;
      const queryBuilder = categoriesRepository.createQueryBuilder();

      categoriesRepository.findOne.mockResolvedValue(mockCategory);
      queryBuilder.getCount.mockResolvedValue(1); // Com transações

      // Act & Assert
      await expect(service.remove(categoryId, userId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(categoriesRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('createDefaultCategories', () => {
    it('should create default categories for a new user', async () => {
      // Arrange
      const userId = mockUser.id;
      const mockCreatedCategories = [
        { name: 'Alimentação', type: CategoryType.EXPENSE },
        { name: 'Transporte', type: CategoryType.EXPENSE },
        { name: 'Salário', type: CategoryType.INCOME },
        // ... outros
      ];

      categoriesRepository.create.mockImplementation((data) => data);
      categoriesRepository.save.mockResolvedValue(mockCreatedCategories);

      // Act
      await service.createDefaultCategories(userId);

      // Assert
      expect(categoriesRepository.create).toHaveBeenCalledTimes(9); // 6 despesas + 3 receitas
      expect(categoriesRepository.save).toHaveBeenCalled();

      // Verificar se create foi chamado com userId correto
      const createCalls = categoriesRepository.create.mock.calls;
      createCalls.forEach((call) => {
        expect(call[0].userId).toBe(userId);
      });
    });
  });
});
