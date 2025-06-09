import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  OnModuleInit,
} from '@nestjs/common';
import { TransactionsService } from '../../transactions/transactions.service';
import { CategoriesService } from '../../categories/categories.service';
import { CategoryType } from '../../categories/entities/category.entity';

// Exportar as interfaces para uso externo
export interface MonthlyAggregate {
  month: string; // Formato: YYYY-MM
  amount: number;
}

export interface CategoryPrediction {
  categoryId: number;
  categoryName: string;
  currentMonthActual: number;
  nextMonthPrediction: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
}

@Injectable()
export class SpendingPredictionService implements OnModuleInit {
  private readonly logger = new Logger(SpendingPredictionService.name);

  constructor(
    @Inject(forwardRef(() => TransactionsService))
    private transactionsService: TransactionsService,

    @Inject(forwardRef(() => CategoriesService))
    private categoriesService: CategoriesService,
  ) {}

  /**
   * Hook do ciclo de vida que é executado após a inicialização do módulo
   */
  onModuleInit() {
    this.logger.log('Serviço de previsão de gastos inicializado');
  }

  /**
   * Gera previsões de gastos para o próximo mês por categoria
   */
  async predictNextMonthSpending(
    userId: number,
  ): Promise<CategoryPrediction[]> {
    try {
      // Buscar categorias do usuário (apenas despesas)
      const categories = await this.categoriesService.findAll(
        userId,
        CategoryType.EXPENSE,
      );

      // Obter transações dos últimos 12 meses
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);

      // Buscar todas as transações do período
      const transactions = await this.transactionsService.findByPeriod(
        userId,
        startDate,
        endDate,
      );

      if (!transactions.length) {
        return [];
      }

      // Array para armazenar as previsões
      const predictions: CategoryPrediction[] = [];

      // Para cada categoria, calcular a previsão
      for (const category of categories) {
        // Filtrar transações desta categoria
        const categoryTransactions = transactions.filter(
          (t) => t.categoryId === category.id,
        );

        if (categoryTransactions.length > 0) {
          // Agrupar por mês
          const monthlyAggregates = this.aggregateByMonth(categoryTransactions);

          // Calcular a previsão usando média móvel ponderada
          const prediction =
            this.calculateWeightedMovingAverage(monthlyAggregates);

          // Calcular valor atual do mês corrente
          const currentMonth = this.getCurrentMonthString();
          const currentMonthData = monthlyAggregates.find(
            (m) => m.month === currentMonth,
          );
          const currentMonthAmount = currentMonthData
            ? Math.abs(currentMonthData.amount)
            : 0;

          // Determinar tendência
          const trend = this.determineTrend(prediction, currentMonthAmount);

          // Adicionar à lista de previsões
          predictions.push({
            categoryId: category.id,
            categoryName: category.name,
            currentMonthActual: currentMonthAmount,
            nextMonthPrediction: prediction.amount,
            trend: trend,
            confidence: prediction.confidence,
          });
        }
      }

      // Ordenar previsões por valor (maior primeiro)
      return predictions.sort(
        (a, b) => b.nextMonthPrediction - a.nextMonthPrediction,
      );
    } catch (error) {
      this.logger.error(`Erro ao prever gastos: ${error.message}`);
      return [];
    }
  }

  /**
   * Agrupa transações por mês e soma os valores
   */
  private aggregateByMonth(transactions: any[]): MonthlyAggregate[] {
    const monthlyMap: Record<string, number> = {};

    // Agrupar transações por mês
    for (const transaction of transactions) {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = 0;
      }

      monthlyMap[monthKey] += transaction.amount;
    }

    // Converter mapa para array de objetos
    return Object.entries(monthlyMap).map(([month, amount]) => ({
      month,
      amount: Math.abs(amount), // Converter para valor positivo para facilitar cálculos
    }));
  }

  /**
   * Calcula a média móvel ponderada dando mais peso aos meses mais recentes
   */
  private calculateWeightedMovingAverage(monthlyData: MonthlyAggregate[]): {
    amount: number;
    confidence: number;
  } {
    // Se não houver dados suficientes, retornar estimativa de baixa confiança
    if (monthlyData.length < 3) {
      // Calcular média simples
      const sum = monthlyData.reduce((total, item) => total + item.amount, 0);
      return {
        amount: monthlyData.length > 0 ? sum / monthlyData.length : 0,
        confidence: 0.3, // Baixa confiança
      };
    }

    // Ordenar por mês (mais antigo primeiro)
    const sortedData = [...monthlyData].sort((a, b) =>
      a.month.localeCompare(b.month),
    );

    // Aplicar pesos (meses mais recentes têm mais peso)
    let weightedSum = 0;
    let weightSum = 0;

    for (let i = 0; i < sortedData.length; i++) {
      // Peso aumenta linearmente com o índice (mais recente = maior peso)
      const weight = i + 1;
      weightedSum += sortedData[i].amount * weight;
      weightSum += weight;
    }

    // Calcular média ponderada
    const weightedAverage = weightedSum / weightSum;

    // Calcular desvio padrão para estimar confiança
    const variance =
      sortedData.reduce((total, item) => {
        return total + Math.pow(item.amount - weightedAverage, 2);
      }, 0) / sortedData.length;

    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / weightedAverage;

    // Converter coeficiente de variação para nível de confiança (menor variação = maior confiança)
    let confidence = 1 - Math.min(coefficientOfVariation, 1);

    // Ajustar confiança com base no número de meses de dados
    confidence = confidence * Math.min(sortedData.length / 12, 1);

    return {
      amount: weightedAverage,
      confidence,
    };
  }

  /**
   * Retorna o mês atual no formato "YYYY-MM"
   */
  private getCurrentMonthString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Determina a tendência comparando a previsão com o valor atual
   */
  private determineTrend(
    prediction: { amount: number; confidence: number },
    currentAmount: number,
  ): 'increasing' | 'decreasing' | 'stable' {
    // Calcular a diferença percentual
    const percentChange =
      currentAmount > 0
        ? ((prediction.amount - currentAmount) / currentAmount) * 100
        : 0;

    // Definir um limite para considerar variação significativa (5%)
    const threshold = 5;

    if (percentChange > threshold) {
      return 'increasing';
    } else if (percentChange < -threshold) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * Obtém dados históricos agregados por mês para uma categoria específica
   * (útil para visualizações de tendência)
   */
  async getCategoryTrend(
    userId: number,
    categoryId: number,
    months: number = 12,
  ): Promise<MonthlyAggregate[]> {
    try {
      // Calcular período
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Buscar transações do período
      const transactions = await this.transactionsService.findByPeriod(
        userId,
        startDate,
        endDate,
      );

      // Filtrar por categoria
      const categoryTransactions = transactions.filter(
        (t) => t.categoryId === categoryId,
      );

      // Agregar por mês
      let monthlyData = this.aggregateByMonth(categoryTransactions);

      // Garantir que todos os meses estejam representados (preencher meses vazios)
      monthlyData = this.fillMissingMonths(monthlyData, startDate, endDate);

      // Ordenar por mês
      return monthlyData.sort((a, b) => a.month.localeCompare(b.month));
    } catch (error) {
      this.logger.error(`Erro ao obter tendência: ${error.message}`);
      return [];
    }
  }

  /**
   * Preenche meses ausentes com valor zero
   */
  private fillMissingMonths(
    data: MonthlyAggregate[],
    startDate: Date,
    endDate: Date,
  ): MonthlyAggregate[] {
    const result = [...data];
    const existingMonths = new Set(data.map((item) => item.month));

    // Criar mapa de todos os meses no intervalo
    const current = new Date(startDate);
    while (current <= endDate) {
      const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;

      if (!existingMonths.has(monthKey)) {
        result.push({
          month: monthKey,
          amount: 0,
        });
      }

      current.setMonth(current.getMonth() + 1);
    }

    return result;
  }
}
