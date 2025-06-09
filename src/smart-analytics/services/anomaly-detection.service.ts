import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  OnModuleInit,
} from '@nestjs/common';
import { TransactionsService } from '../../transactions/transactions.service';
import { CategoriesService } from '../../categories/categories.service';

export interface AnomalyDetection {
  transactionId: number;
  description: string;
  amount: number;
  date: Date;
  categoryId: number | null;
  categoryName: string;
  anomalyScore: number; // 0-1, quanto maior, mais anômala
  reason: string;
}

export interface MissingRecurrence {
  description: string;
  category: string;
  lastDate: Date;
  expectedDate: Date;
  daysPastDue: number;
  averageAmount: number;
}

@Injectable()
export class AnomalyDetectionService implements OnModuleInit {
  private readonly logger = new Logger(AnomalyDetectionService.name);

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
    this.logger.log('Serviço de detecção de anomalias inicializado');
  }

  /**
   * Detecta transações anômalas para um usuário específico
   */
  async detectAnomalies(
    userId: number,
    maxResults: number = 5,
  ): Promise<AnomalyDetection[]> {
    try {
      // Buscar transações dos últimos 90 dias
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      // Buscar transações do período
      const transactions = await this.transactionsService.findByPeriod(
        userId,
        startDate,
        endDate,
      );

      if (transactions.length < 5) {
        return []; // Dados insuficientes para detecção
      }

      // Agrupar transações por categoria
      const transactionsByCategory: Record<number, any[]> = {};

      for (const transaction of transactions) {
        if (!transaction.categoryId) continue;

        if (!transactionsByCategory[transaction.categoryId]) {
          transactionsByCategory[transaction.categoryId] = [];
        }

        transactionsByCategory[transaction.categoryId].push(transaction);
      }

      // Lista para armazenar anomalias detectadas
      const anomalies: AnomalyDetection[] = [];

      // Analisar cada categoria separadamente
      for (const [categoryId, categoryTransactions] of Object.entries(
        transactionsByCategory,
      )) {
        // Precisamos de pelo menos 3 transações para detectar anomalias
        if (categoryTransactions.length < 3) continue;

        // Calcular estatísticas para a categoria
        const stats = this.calculateCategoryStats(categoryTransactions);

        // Detectar anomalias com base no Z-score
        for (const transaction of categoryTransactions) {
          const zScore = Math.abs(
            (transaction.amount - stats.mean) / stats.stdDev,
          );

          // Z-score > 2 indica potencial anomalia (95% de confiança)
          if (zScore > 2) {
            // Calcular score de anomalia (normalizado entre 0-1)
            const anomalyScore = Math.min(zScore / 4, 1); // Limite em Z=4 (99.99%)

            anomalies.push({
              transactionId: transaction.id,
              description: transaction.description,
              amount: transaction.amount,
              date: transaction.date,
              categoryId: parseInt(categoryId, 10),
              categoryName: transaction.category?.name || 'Desconhecida',
              anomalyScore,
              reason: this.getAnomalyReason(transaction, stats),
            });
          }
        }
      }

      // Buscar também transações sem categoria (potencialmente anômalas)
      const uncategorizedTransactions = transactions.filter(
        (t) => !t.categoryId,
      );
      for (const transaction of uncategorizedTransactions) {
        anomalies.push({
          transactionId: transaction.id,
          description: transaction.description,
          amount: transaction.amount,
          date: transaction.date,
          categoryId: null,
          categoryName: 'Não categorizada',
          anomalyScore: 0.7, // Score fixo para não categorizadas
          reason: 'Transação sem categoria',
        });
      }

      // Ordenar anomalias por score (mais alto primeiro)
      const sortedAnomalies = anomalies.sort(
        (a, b) => b.anomalyScore - a.anomalyScore,
      );

      // Retornar apenas o número solicitado de resultados
      return sortedAnomalies.slice(0, maxResults);
    } catch (error) {
      this.logger.error(`Erro ao detectar anomalias: ${error.message}`);
      return [];
    }
  }

  /**
   * Calcula estatísticas básicas para uma categoria
   */
  private calculateCategoryStats(transactions: any[]): {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
  } {
    // Extrair apenas os valores
    const values = transactions.map((t) => t.amount);

    // Calcular média
    const sum = values.reduce((total, val) => total + val, 0);
    const mean = sum / values.length;

    // Calcular desvio padrão
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance =
      squaredDiffs.reduce((total, val) => total + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Calcular mediana
    const sortedValues = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sortedValues.length / 2);
    const median =
      sortedValues.length % 2 === 0
        ? (sortedValues[middle - 1] + sortedValues[middle]) / 2
        : sortedValues[middle];

    // Valor mínimo e máximo
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { mean, median, stdDev, min, max };
  }

  /**
   * Gera uma explicação para a anomalia detectada
   */
  private getAnomalyReason(
    transaction: any,
    stats: {
      mean: number;
      median: number;
      stdDev: number;
      min: number;
      max: number;
    },
  ): string {
    const amount = transaction.amount;

    // Calcular diferença percentual da média
    const percentDiff = ((amount - stats.mean) / Math.abs(stats.mean)) * 100;

    if (amount > stats.mean) {
      if (amount > stats.max * 0.9) {
        return `Valor excepcionalmente alto - ${Math.abs(percentDiff).toFixed(0)}% acima da média para esta categoria`;
      } else {
        return `Valor acima do normal - ${Math.abs(percentDiff).toFixed(0)}% maior que a média para esta categoria`;
      }
    } else {
      if (amount < stats.min * 1.1) {
        return `Valor excepcionalmente baixo - ${Math.abs(percentDiff).toFixed(0)}% abaixo da média para esta categoria`;
      } else {
        return `Valor abaixo do normal - ${Math.abs(percentDiff).toFixed(0)}% menor que a média para esta categoria`;
      }
    }
  }

  /**
   * Detecta padrões interrompidos em transações recorrentes
   */
  async detectUnusualFrequency(userId: number): Promise<MissingRecurrence[]> {
    try {
      // Buscar transações dos últimos 180 dias
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 180);

      // Buscar transações do período
      const transactions = await this.transactionsService.findByPeriod(
        userId,
        startDate,
        endDate,
      );

      // Agrupar por descrição (para encontrar transações recorrentes)
      const descriptionGroups = this.groupSimilarTransactions(transactions);

      // Encontrar grupos de transações recorrentes
      const recurringGroups = this.identifyRecurringGroups(descriptionGroups);

      // Verificar padrões interrompidos
      return this.detectInterruptedPatterns(recurringGroups);
    } catch (error) {
      this.logger.error(
        `Erro ao detectar frequências incomuns: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Agrupa transações com descrições similares
   */
  private groupSimilarTransactions(transactions: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};

    // Implementação simplificada - na versão real, usar algoritmos de similaridade de texto
    for (const transaction of transactions) {
      // Normalizar descrição (remover caracteres especiais, converter para minúsculas)
      const normalizedDesc = this.normalizeDescription(transaction.description);

      // Verificar se já existe um grupo similar
      let assigned = false;
      for (const groupKey of Object.keys(groups)) {
        // Verificar similaridade (implementação simplificada)
        if (this.areDescriptionsSimilar(normalizedDesc, groupKey)) {
          groups[groupKey].push(transaction);
          assigned = true;
          break;
        }
      }

      // Se não encontrou grupo similar, criar novo
      if (!assigned) {
        groups[normalizedDesc] = [transaction];
      }
    }

    return groups;
  }

  /**
   * Normaliza descrição para comparação
   */
  private normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  /**
   * Verifica se duas descrições são similares
   */
  private areDescriptionsSimilar(desc1: string, desc2: string): boolean {
    // Implementação simplificada - na versão real, usar algoritmos como distância de Levenshtein
    return desc1.includes(desc2) || desc2.includes(desc1);
  }

  /**
   * Identifica grupos de transações recorrentes
   */
  private identifyRecurringGroups(groups: Record<string, any[]>): any[] {
    const recurringGroups: any[] = [];

    for (const [key, transactions] of Object.entries(groups)) {
      // Precisamos de pelo menos 3 transações para identificar padrão
      if (transactions.length < 3) continue;

      // Ordenar por data
      const sortedTransactions = [...transactions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      // Calcular intervalos entre transações
      const intervals: number[] = [];
      for (let i = 1; i < sortedTransactions.length; i++) {
        const prev = new Date(sortedTransactions[i - 1].date).getTime();
        const curr = new Date(sortedTransactions[i].date).getTime();

        // Diferença em dias
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        intervals.push(diffDays);
      }

      // Calcular média e desvio padrão dos intervalos
      const avgInterval =
        intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

      // Calcular desvio padrão
      const squaredDiffs = intervals.map((val) =>
        Math.pow(val - avgInterval, 2),
      );
      const variance =
        squaredDiffs.reduce((sum, val) => sum + val, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);

      // Se o desvio padrão for baixo em relação à média, temos um padrão regular
      const coefficientOfVariation = stdDev / avgInterval;

      if (coefficientOfVariation < 0.3) {
        // Menos de 30% de variação
        recurringGroups.push({
          description: key,
          transactions: sortedTransactions,
          avgInterval,
          stdDev,
          lastTransaction: sortedTransactions[sortedTransactions.length - 1],
        });
      }
    }

    return recurringGroups;
  }

  /**
   * Detecta padrões interrompidos (transações recorrentes que não ocorreram quando esperadas)
   */
  private detectInterruptedPatterns(
    recurringGroups: any[],
  ): MissingRecurrence[] {
    const results: MissingRecurrence[] = [];
    const now = new Date().getTime();

    for (const group of recurringGroups) {
      const lastTxDate = new Date(group.lastTransaction.date).getTime();
      const daysSinceLastTx = Math.round(
        (now - lastTxDate) / (1000 * 60 * 60 * 24),
      );

      // Se passou mais tempo que o intervalo médio + margem de tolerância
      if (daysSinceLastTx > group.avgInterval * 1.5) {
        const expectedDate = new Date(
          lastTxDate + group.avgInterval * 24 * 60 * 60 * 1000,
        );

        results.push({
          description: group.lastTransaction.description,
          category: group.lastTransaction.category?.name || 'Desconhecida',
          lastDate: group.lastTransaction.date,
          expectedDate,
          daysPastDue: daysSinceLastTx - group.avgInterval,
          averageAmount: Math.abs(
            group.transactions.reduce((sum, tx) => sum + tx.amount, 0) /
              group.transactions.length,
          ),
        });
      }
    }

    return results;
  }
}
