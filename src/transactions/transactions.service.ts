import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { AccountsService } from '../accounts/accounts.service';

/**
 * Serviço responsável por gerenciar todas as operações relacionadas a transações financeiras
 */
@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,

    @Inject(forwardRef(() => AccountsService))
    private accountsService: AccountsService,
  ) {}

  /**
   * Cria uma nova transação financeira
   *
   * @param userId - ID do usuário que está criando a transação
   * @param createTransactionDto - Dados da transação a ser criada
   * @returns A transação criada e salva
   * @throws BadRequestException - Quando origem e destino são iguais em transferências
   * @throws NotFoundException - Quando as contas não são encontradas
   */
  async create(
    userId: number,
    createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    const { amount, type, accountId, destinationAccountId } =
      createTransactionDto;

    await this.accountsService.findOne(accountId, userId);

    if (type === TransactionType.TRANSFER && destinationAccountId) {
      await this.accountsService.findOne(destinationAccountId, userId);

      if (accountId === destinationAccountId) {
        throw new BadRequestException(
          'A conta de origem e destino não podem ser as mesmas',
        );
      }
    }

    const transaction = this.transactionsRepository.create({
      ...createTransactionDto,
      amount: type === TransactionType.EXPENSE ? -Math.abs(amount) : amount,
      userId,
    });

    const savedTransaction =
      await this.transactionsRepository.save(transaction);

    if (savedTransaction.isPaid) {
      await this.updateAccountBalance(savedTransaction);
    }

    return savedTransaction;
  }

  /**
   * Busca transações com diversos filtros
   *
   * @param userId - ID do usuário proprietário das transações
   * @param queryDto - Parâmetros de filtro para a busca
   * @returns Lista de transações que correspondem aos critérios
   */
  async findAll(
    userId: number,
    queryDto: QueryTransactionsDto,
  ): Promise<Transaction[]> {
    const { startDate, endDate, type, accountId, categoryId, search } =
      queryDto;

    const where: FindOptionsWhere<Transaction> = { userId };

    if (startDate && endDate) {
      where.date = Between(new Date(startDate), new Date(endDate));
    }

    if (type) {
      where.type = type;
    }

    if (accountId) {
      where.accountId = accountId;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    let query = this.transactionsRepository
      .createQueryBuilder('transaction')
      .where(where)
      .leftJoinAndSelect('transaction.account', 'account')
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect(
        'transaction.destinationAccount',
        'destinationAccount',
      );

    if (search) {
      query = query.andWhere('transaction.description ILIKE :search', {
        search: `%${search}%`,
      });
    }

    query = query
      .orderBy('transaction.date', 'DESC')
      .addOrderBy('transaction.createdAt', 'DESC');

    return query.getMany();
  }

  /**
   * Busca uma transação específica pelo ID
   *
   * @param id - ID da transação
   * @param userId - ID do usuário proprietário
   * @returns A transação encontrada
   * @throws NotFoundException - Se a transação não for encontrada
   */
  async findOne(id: number, userId: number): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id, userId },
      relations: ['account', 'destinationAccount', 'category'],
    });

    if (!transaction) {
      throw new NotFoundException(`Transação com ID ${id} não encontrada`);
    }

    return transaction;
  }

  /**
   * Atualiza uma transação existente
   *
   * @param id - ID da transação a ser atualizada
   * @param userId - ID do usuário proprietário
   * @param updateTransactionDto - Dados para atualização
   * @returns A transação atualizada
   * @throws NotFoundException - Se a transação não for encontrada
   * @throws BadRequestException - Para validações de regras de negócio
   */
  async update(
    id: number,
    userId: number,
    updateTransactionDto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const transaction = await this.findOne(id, userId);
    const oldTransaction = { ...transaction };
    const oldIsPaid = transaction.isPaid;

    if (
      updateTransactionDto.accountId &&
      updateTransactionDto.accountId !== transaction.accountId
    ) {
      await this.accountsService.findOne(
        updateTransactionDto.accountId,
        userId,
      );
    }

    if (
      transaction.type === TransactionType.TRANSFER &&
      updateTransactionDto.destinationAccountId &&
      updateTransactionDto.destinationAccountId !==
        transaction.destinationAccountId
    ) {
      await this.accountsService.findOne(
        updateTransactionDto.destinationAccountId,
        userId,
      );

      if (
        updateTransactionDto.accountId ===
        updateTransactionDto.destinationAccountId
      ) {
        throw new BadRequestException(
          'A conta de origem e destino não podem ser as mesmas',
        );
      }
    }

    if (
      updateTransactionDto.type &&
      updateTransactionDto.type !== transaction.type
    ) {
      if (updateTransactionDto.type === TransactionType.EXPENSE) {
        updateTransactionDto.amount = -Math.abs(
          updateTransactionDto.amount || transaction.amount,
        );
      } else if (transaction.type === TransactionType.EXPENSE) {
        updateTransactionDto.amount = Math.abs(
          updateTransactionDto.amount || transaction.amount,
        );
      }
    }

    Object.assign(transaction, updateTransactionDto);

    if (oldIsPaid) {
      await this.reverseAccountBalance(oldTransaction);
    }

    const updatedTransaction =
      await this.transactionsRepository.save(transaction);

    if (updatedTransaction.isPaid) {
      await this.updateAccountBalance(updatedTransaction);
    }

    return updatedTransaction;
  }

  /**
   * Remove uma transação
   *
   * @param id - ID da transação a ser removida
   * @param userId - ID do usuário proprietário
   * @throws NotFoundException - Se a transação não for encontrada
   */
  async remove(id: number, userId: number): Promise<void> {
    const transaction = await this.findOne(id, userId);

    if (transaction.isPaid) {
      await this.reverseAccountBalance(transaction);
    }

    await this.transactionsRepository.remove(transaction);
  }

  /**
   * Verifica se uma conta possui transações associadas
   *
   * @param accountId - ID da conta a verificar
   * @returns True se existirem transações, false caso contrário
   */
  async hasTransactionsForAccount(accountId: number): Promise<boolean> {
    const count = await this.transactionsRepository.count({
      where: [{ accountId }, { destinationAccountId: accountId }],
    });

    return count > 0;
  }

  /**
   * Busca transações de uma categoria específica em um período
   *
   * @param userId - ID do usuário proprietário
   * @param categoryId - ID da categoria a filtrar
   * @param startDate - Data inicial do período
   * @param endDate - Data final do período
   * @returns Lista de transações correspondentes
   */
  async findByCategoryAndPeriod(
    userId: number,
    categoryId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<Transaction[]> {
    return this.transactionsRepository.find({
      where: {
        userId,
        categoryId,
        date: Between(startDate, endDate),
        isPaid: true,
      },
      order: {
        date: 'ASC',
      },
    });
  }

  /**
   * Busca todas as transações de um usuário em um período
   *
   * @param userId - ID do usuário proprietário
   * @param startDate - Data inicial do período
   * @param endDate - Data final do período
   * @returns Lista de transações correspondentes
   */
  async findByPeriod(
    userId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<Transaction[]> {
    return this.transactionsRepository.find({
      where: {
        userId,
        date: Between(startDate, endDate),
        isPaid: true,
      },
      relations: ['category'],
      order: {
        date: 'ASC',
      },
    });
  }

  /**
   * Busca as transações mais recentes de um usuário
   *
   * @param userId - ID do usuário proprietário
   * @param limit - Número máximo de transações a retornar
   * @returns Lista de transações ordenadas por data (mais recentes primeiro)
   */
  async findRecent(
    userId: number,
    limit: number = 100,
  ): Promise<Transaction[]> {
    return this.transactionsRepository.find({
      where: { userId },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: limit,
      relations: ['category', 'account'],
    });
  }

  /**
   * Busca transações categorizadas para treinamento do modelo
   *
   * @param limit Número máximo de transações a retornar
   * @returns Lista de transações categorizadas
   */
  async findCategorized(limit: number = 5000): Promise<Transaction[]> {
    return this.transactionsRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.category', 'category')
      .where('transaction.categoryId IS NOT NULL')
      .orderBy('transaction.date', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Atualiza os saldos das contas afetadas por uma transação
   *
   * @param transaction - A transação que afeta os saldos
   * @throws InternalServerErrorException - Em caso de falha na atualização
   */
  private async updateAccountBalance(transaction: Transaction): Promise<void> {
    try {
      if (
        transaction.type === TransactionType.TRANSFER &&
        transaction.destinationAccountId
      ) {
        await Promise.all([
          this.accountsService.updateBalance(
            transaction.accountId,
            -Math.abs(transaction.amount),
          ),
          this.accountsService.updateBalance(
            transaction.destinationAccountId,
            Math.abs(transaction.amount),
          ),
        ]);
      } else {
        await this.accountsService.updateBalance(
          transaction.accountId,
          transaction.amount,
        );
      }
    } catch {
      throw new InternalServerErrorException(
        'Erro ao atualizar saldo da conta',
      );
    }
  }

  /**
   * Reverte os efeitos de uma transação nos saldos das contas
   *
   * @param transaction - A transação cujos efeitos serão revertidos
   * @throws InternalServerErrorException - Em caso de falha na reversão
   */
  private async reverseAccountBalance(transaction: Transaction): Promise<void> {
    try {
      if (
        transaction.type === TransactionType.TRANSFER &&
        transaction.destinationAccountId
      ) {
        await Promise.all([
          this.accountsService.updateBalance(
            transaction.accountId,
            Math.abs(transaction.amount),
          ),
          this.accountsService.updateBalance(
            transaction.destinationAccountId,
            -Math.abs(transaction.amount),
          ),
        ]);
      } else {
        await this.accountsService.updateBalance(
          transaction.accountId,
          -transaction.amount,
        );
      }
    } catch {
      throw new InternalServerErrorException('Erro ao reverter saldo da conta');
    }
  }

  /**
   * Retorna uma lista de IDs de usuários distintos que possuem transações
   *
   * @returns Array de IDs de usuários
   */
  async getDistinctUsers(): Promise<number[]> {
    const result = await this.transactionsRepository
      .createQueryBuilder('transaction')
      .select('DISTINCT transaction.userId', 'userId')
      .getRawMany();

    return result.map((item) => Number(item.userId));
  }
}
