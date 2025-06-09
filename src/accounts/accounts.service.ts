import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { TransactionsService } from '../transactions/transactions.service';

/**
 * Serviço responsável por gerenciar operações relacionadas às contas financeiras
 */
@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
    @Inject(forwardRef(() => TransactionsService))
    private readonly transactionsService: TransactionsService,
  ) {}

  /**
   * Cria uma nova conta financeira
   *
   * @param userId - ID do usuário proprietário da conta
   * @param createAccountDto - Dados para criação da conta
   * @returns A conta criada
   */
  async create(
    userId: number,
    createAccountDto: CreateAccountDto,
  ): Promise<Account> {
    const { initialBalance, ...accountData } = createAccountDto;

    const account = this.accountsRepository.create({
      ...accountData,
      balance: initialBalance || 0,
      userId,
    });

    return this.accountsRepository.save(account);
  }

  /**
   * Busca todas as contas de um usuário
   *
   * @param userId - ID do usuário proprietário
   * @returns Lista de contas do usuário
   */
  async findAll(userId: number): Promise<Account[]> {
    return this.accountsRepository.find({
      where: { userId },
      order: { name: 'ASC' },
    });
  }

  /**
   * Busca uma conta específica pelo ID
   *
   * @param id - ID da conta a ser buscada
   * @param userId - ID do usuário proprietário
   * @returns A conta encontrada
   * @throws NotFoundException - Se a conta não for encontrada
   */
  async findOne(id: number, userId: number): Promise<Account> {
    const account = await this.accountsRepository.findOne({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException(`Conta com ID ${id} não encontrada`);
    }

    return account;
  }

  /**
   * Atualiza os dados de uma conta existente
   *
   * @param id - ID da conta a ser atualizada
   * @param userId - ID do usuário proprietário
   * @param updateAccountDto - Dados para atualização da conta
   * @returns A conta atualizada
   * @throws NotFoundException - Se a conta não for encontrada
   */
  async update(
    id: number,
    userId: number,
    updateAccountDto: UpdateAccountDto,
  ): Promise<Account> {
    const account = await this.findOne(id, userId);

    if (updateAccountDto.initialBalance !== undefined) {
      delete updateAccountDto.initialBalance;
    }

    Object.assign(account, updateAccountDto);

    return this.accountsRepository.save(account);
  }

  /**
   * Remove uma conta existente
   *
   * @param id - ID da conta a ser removida
   * @param userId - ID do usuário proprietário
   * @throws NotFoundException - Se a conta não for encontrada
   * @throws ForbiddenException - Se a conta possuir transações
   */
  async remove(id: number, userId: number): Promise<void> {
    const account = await this.findOne(id, userId);

    const hasTransactions =
      await this.transactionsService.hasTransactionsForAccount(id);

    if (hasTransactions) {
      throw new ForbiddenException(
        'Não é possível excluir uma conta que possui transações. Desative-a em vez de excluí-la.',
      );
    }

    await this.accountsRepository.remove(account);
  }

  /**
   * Obtém um resumo das contas do usuário
   *
   * @param userId - ID do usuário proprietário
   * @returns Resumo com saldo total e quantidade de contas
   */
  async getSummary(
    userId: number,
  ): Promise<{ totalBalance: number; accountCount: number }> {
    const accounts = await this.findAll(userId);

    const totalBalance = accounts.reduce(
      (sum, account) => sum + Number(account.balance),
      0,
    );

    return {
      totalBalance,
      accountCount: accounts.length,
    };
  }

  /**
   * Atualiza o saldo de uma conta
   *
   * @param accountId - ID da conta a ter o saldo atualizado
   * @param amount - Valor a ser adicionado (positivo) ou subtraído (negativo)
   * @returns A conta com saldo atualizado
   * @throws NotFoundException - Se a conta não for encontrada
   */
  async updateBalance(accountId: number, amount: number): Promise<Account> {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Conta com ID ${accountId} não encontrada`);
    }

    account.balance = Number(account.balance) + amount;

    return this.accountsRepository.save(account);
  }
}
