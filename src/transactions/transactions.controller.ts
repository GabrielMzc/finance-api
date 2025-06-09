import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Transaction, TransactionType } from './entities/transaction.entity';

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar uma nova transação' })
  @ApiResponse({
    status: 201,
    description: 'Transação criada com sucesso',
    type: Transaction,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos na requisição' })
  @ApiResponse({ status: 404, description: 'Conta não encontrada' })
  create(
    @Request() req,
    @Body() createTransactionDto: CreateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.create(
      Number(req.user.id),
      createTransactionDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar transações com filtros' })
  @ApiResponse({
    status: 200,
    description: 'Lista de transações retornada',
    type: [Transaction],
  })
  findAll(
    @Request() req,
    @Query() queryDto: QueryTransactionsDto,
  ): Promise<Transaction[]> {
    return this.transactionsService.findAll(Number(req.user.id), queryDto);
  }

  @Get('period/:period')
  @ApiOperation({ summary: 'Buscar transações por período predefinido' })
  @ApiParam({
    name: 'period',
    enum: ['current-month', 'last-month', 'current-year', 'last-30-days'],
    description: 'Período predefinido',
  })
  @ApiResponse({
    status: 200,
    description: 'Transações do período solicitado',
    type: [Transaction],
  })
  getByPeriod(
    @Request() req,
    @Param('period') period: string,
  ): Promise<Transaction[]> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date();

    switch (period) {
      case 'current-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'current-year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'last-30-days':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date();
    }

    return this.transactionsService.findByPeriod(
      Number(req.user.id),
      startDate,
      endDate,
    );
  }

  @Get('summary')
  @ApiOperation({ summary: 'Obter resumo financeiro por período' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Resumo financeiro retornado' })
  async getSummary(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const end = endDate ? new Date(endDate) : new Date();

    const transactions = await this.transactionsService.findByPeriod(
      Number(req.user.id),
      start,
      end,
    );

    // Calcular totais
    let totalIncome = 0;
    let totalExpense = 0;

    const categorySummary = {};

    transactions.forEach((transaction) => {
      const amount = Math.abs(Number(transaction.amount));

      if (transaction.type === TransactionType.INCOME) {
        totalIncome += amount;
      } else if (transaction.type === TransactionType.EXPENSE) {
        totalExpense += amount;

        const categoryName = transaction.category?.name || 'Sem categoria';
        categorySummary[categoryName] =
          (categorySummary[categoryName] || 0) + amount;
      }
    });

    // Ordenar categorias por valor
    const categoriesByExpense = Object.entries(categorySummary)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => (b.amount as number) - (a.amount as number));

    return {
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
      totals: {
        income: totalIncome,
        expense: totalExpense,
        balance: totalIncome - totalExpense,
      },
      categoriesByExpense,
      transactionCount: transactions.length,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar uma transação específica' })
  @ApiParam({ name: 'id', description: 'ID da transação' })
  @ApiResponse({
    status: 200,
    description: 'Transação encontrada',
    type: Transaction,
  })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  findOne(@Param('id') id: string, @Request() req): Promise<Transaction> {
    return this.transactionsService.findOne(+id, Number(req.user.id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar uma transação' })
  @ApiParam({ name: 'id', description: 'ID da transação' })
  @ApiResponse({
    status: 200,
    description: 'Transação atualizada',
    type: Transaction,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos na requisição' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.update(
      +id,
      Number(req.user.id),
      updateTransactionDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover uma transação' })
  @ApiParam({ name: 'id', description: 'ID da transação' })
  @ApiResponse({ status: 204, description: 'Transação removida' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  async remove(@Param('id') id: string, @Request() req): Promise<void> {
    return this.transactionsService.remove(+id, Number(req.user.id));
  }
}
