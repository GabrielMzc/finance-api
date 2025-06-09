import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from '../categories.controller';
import { CategoriesService } from '../categories.service';
import { Category, CategoryType } from '../entities/category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: CategoriesService;

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
    user: {} as any,
    transactions: [],
  } as Category;

  const mockCreateCategoryDto: CreateCategoryDto = {
    name: 'Nova Categoria',
    color: '#FF5733',
    type: CategoryType.EXPENSE,
    icon: 'new_icon',
  };

  const mockUpdateCategoryDto: UpdateCategoryDto = {
    name: 'Categoria Atualizada',
    isActive: false,
  };

  const mockRequest = {
    user: { id: '1' },
  };

  beforeEach(async () => {
    const mockCategoriesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new category', async () => {
      jest.spyOn(service, 'create').mockResolvedValue(mockCategory);

      const result = await controller.create(
        mockRequest,
        mockCreateCategoryDto,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.create).toHaveBeenCalledWith(1, mockCreateCategoryDto);

      expect(result).toEqual(mockCategory);
    });
  });

  describe('findAll', () => {
    it('should return all categories for a user', async () => {
      const categories = [mockCategory];
      jest.spyOn(service, 'findAll').mockResolvedValue(categories);

      const result = await controller.findAll(mockRequest, undefined);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findAll).toHaveBeenCalledWith(1, undefined);

      expect(result).toEqual(categories);
    });

    it('should filter categories by type', async () => {
      const categories = [mockCategory];
      jest.spyOn(service, 'findAll').mockResolvedValue(categories);

      const result = await controller.findAll(
        mockRequest,
        CategoryType.EXPENSE,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findAll).toHaveBeenCalledWith(1, CategoryType.EXPENSE);

      expect(result).toEqual(categories);
    });
  });

  describe('findOne', () => {
    it('should find a category by id', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockCategory);

      const result = await controller.findOne('1', mockRequest);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findOne).toHaveBeenCalledWith(1, 1);

      expect(result).toEqual(mockCategory);
    });

    it('should pass through NotFoundException from service', async () => {
      jest
        .spyOn(service, 'findOne')
        .mockRejectedValue(new NotFoundException('Categoria não encontrada'));

      await expect(controller.findOne('999', mockRequest)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const updatedCategory = { ...mockCategory, ...mockUpdateCategoryDto };

      jest.spyOn(service, 'update').mockResolvedValue(updatedCategory);

      const result = await controller.update(
        '1',
        mockRequest,
        mockUpdateCategoryDto,
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.update).toHaveBeenCalledWith(1, 1, mockUpdateCategoryDto);

      expect(result).toEqual(updatedCategory);
    });
  });

  describe('remove', () => {
    it('should remove a category', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(undefined);

      await controller.remove('1', mockRequest);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.remove).toHaveBeenCalledWith(1, 1);
    });

    it('should pass through ForbiddenException from service', async () => {
      jest
        .spyOn(service, 'remove')
        .mockRejectedValue(
          new ForbiddenException(
            'Não é possível excluir uma categoria que possui transações',
          ),
        );

      await expect(controller.remove('1', mockRequest)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
