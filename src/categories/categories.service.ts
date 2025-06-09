import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, CategoryType } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { TransactionsService } from '../transactions/transactions.service';

/**
 * Serviço responsável por gerenciar operações relacionadas às categorias
 */
@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    private readonly transactionsService: TransactionsService,
  ) {}

  /**
   * Cria uma nova categoria
   *
   * @param userId - ID do usuário proprietário
   * @param createCategoryDto - Dados para criação da categoria
   * @returns A categoria criada
   */
  async create(
    userId: number,
    createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    const category = this.categoriesRepository.create({
      ...createCategoryDto,
      userId,
    });

    return this.categoriesRepository.save(category);
  }

  /**
   * Busca todas as categorias de um usuário
   *
   * @param userId - ID do usuário proprietário
   * @param type - Filtro opcional por tipo de categoria
   * @returns Lista de categorias do usuário
   */
  async findAll(userId: number, type?: CategoryType): Promise<Category[]> {
    const where: any = { userId };

    if (type) {
      where.type = [type, CategoryType.BOTH];
    }

    return this.categoriesRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }

  /**
   * Busca uma categoria específica pelo ID
   *
   * @param id - ID da categoria
   * @param userId - ID do usuário proprietário
   * @returns A categoria encontrada
   * @throws NotFoundException - Se a categoria não for encontrada
   */
  async findOne(id: number, userId: number): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id, userId },
    });

    if (!category) {
      throw new NotFoundException(`Categoria com ID ${id} não encontrada`);
    }

    return category;
  }

  /**
   * Atualiza uma categoria existente
   *
   * @param id - ID da categoria
   * @param userId - ID do usuário proprietário
   * @param updateCategoryDto - Dados para atualização
   * @returns A categoria atualizada
   * @throws NotFoundException - Se a categoria não for encontrada
   */
  async update(
    id: number,
    userId: number,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id, userId);

    Object.assign(category, updateCategoryDto);

    return this.categoriesRepository.save(category);
  }

  /**
   * Remove uma categoria
   *
   * @param id - ID da categoria
   * @param userId - ID do usuário proprietário
   * @throws NotFoundException - Se a categoria não for encontrada
   * @throws ForbiddenException - Se a categoria possuir transações associadas
   */
  async remove(id: number, userId: number): Promise<void> {
    const category = await this.findOne(id, userId);

    const hasTransactions = await this.hasTransactionsForCategory(id);
    if (hasTransactions) {
      throw new ForbiddenException(
        'Não é possível excluir uma categoria que possui transações. Desative-a em vez de excluí-la.',
      );
    }

    await this.categoriesRepository.remove(category);
  }

  /**
   * Verifica se uma categoria possui transações associadas
   *
   * @param categoryId - ID da categoria
   * @returns True se existirem transações, false caso contrário
   */
  private async hasTransactionsForCategory(
    categoryId: number,
  ): Promise<boolean> {
    const count = await this.categoriesRepository
      .createQueryBuilder('category')
      .leftJoin('category.transactions', 'transaction')
      .where('category.id = :categoryId', { categoryId })
      .andWhere('transaction.id IS NOT NULL')
      .getCount();

    return count > 0;
  }

  /**
   * Cria categorias padrão para um novo usuário
   *
   * @param userId - ID do usuário
   */
  async createDefaultCategories(userId: number): Promise<void> {
    const defaultExpenseCategories = [
      {
        name: 'Alimentação',
        color: '#4CAF50',
        icon: 'restaurant',
        type: CategoryType.EXPENSE,
      },
      {
        name: 'Transporte',
        color: '#2196F3',
        icon: 'directions_car',
        type: CategoryType.EXPENSE,
      },
      {
        name: 'Moradia',
        color: '#FF9800',
        icon: 'home',
        type: CategoryType.EXPENSE,
      },
      {
        name: 'Saúde',
        color: '#F44336',
        icon: 'local_hospital',
        type: CategoryType.EXPENSE,
      },
      {
        name: 'Educação',
        color: '#9C27B0',
        icon: 'school',
        type: CategoryType.EXPENSE,
      },
      {
        name: 'Lazer',
        color: '#00BCD4',
        icon: 'sports_esports',
        type: CategoryType.EXPENSE,
      },
    ];

    const defaultIncomeCategories = [
      {
        name: 'Salário',
        color: '#4CAF50',
        icon: 'payments',
        type: CategoryType.INCOME,
      },
      {
        name: 'Freelance',
        color: '#2196F3',
        icon: 'work',
        type: CategoryType.INCOME,
      },
      {
        name: 'Investimentos',
        color: '#FF9800',
        icon: 'trending_up',
        type: CategoryType.INCOME,
      },
    ];

    const allCategories = [
      ...defaultExpenseCategories,
      ...defaultIncomeCategories,
    ];

    const categoryEntities = allCategories.map((cat) =>
      this.categoriesRepository.create({
        ...cat,
        userId,
      }),
    );

    await this.categoriesRepository.save(categoryEntities);
  }
}
