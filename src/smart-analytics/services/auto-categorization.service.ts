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
import * as natural from 'natural';

@Injectable()
export class AutoCategorizationService implements OnModuleInit {
  private readonly logger = new Logger(AutoCategorizationService.name);
  private readonly classifier: natural.BayesClassifier;
  private readonly tokenizer: natural.WordTokenizer;
  private isModelTrained = false;

  // Mapa de palavras-chave para categorias (agora usado apenas como fallback)
  private keywordMap: Record<string, string[]> = {
    // Alimentação
    restaurante: ['alimentação', 'refeição', 'restaurante'],
    supermercado: ['alimentação', 'mercado', 'supermercado'],
    delivery: ['alimentação', 'ifood', 'delivery', 'uber eats'],

    // Transporte
    transporte: ['uber', 'taxi', '99', 'cabify', 'combustível', 'gasolina'],

    // Moradia
    moradia: ['aluguel', 'condomínio', 'água', 'luz', 'energia', 'gás'],

    // Mais categorias...
  };

  constructor(
    @Inject(forwardRef(() => TransactionsService))
    private transactionsService: TransactionsService,

    @Inject(forwardRef(() => CategoriesService))
    private categoriesService: CategoriesService,
  ) {
    // Inicialização do classificador e tokenizer
    this.classifier = new natural.BayesClassifier();
    this.tokenizer = new natural.WordTokenizer();
  }

  /**
   * Hook do ciclo de vida que é executado após a inicialização do módulo
   * Substitui o método initializeModel anterior e não precisa de setTimeout
   */
  async onModuleInit() {
    try {
      this.logger.log('Iniciando treinamento do modelo de categorização...');
      await this.trainModelWithHistoricalData();
      this.logger.log('Modelo de auto-categorização inicializado com sucesso');
    } catch (error) {
      this.logger.error(
        `Erro ao inicializar modelo de auto-categorização: ${error.message}`,
      );
    }
  }

  /**
   * Treina o classificador com dados históricos de transações
   */
  private async trainModelWithHistoricalData(): Promise<void> {
    try {
      // Abordagem alternativa: obter transações categorizadas diretamente
      const categorizedTransactions =
        await this.transactionsService.findCategorized(5000);

      if (categorizedTransactions.length > 0) {
        // Adicionar cada transação ao classificador
        for (const transaction of categorizedTransactions) {
          const features = this.extractFeatures(
            transaction.description,
            transaction.amount,
          );
          this.classifier.addDocument(
            features,
            transaction.categoryId.toString(),
          );
        }

        // Treinar o modelo após adicionar todos os documentos
        if (this.classifier.docs && this.classifier.docs.length > 0) {
          this.classifier.train();
          this.isModelTrained = true;
          this.logger.log(
            `Modelo treinado com ${this.classifier.docs.length} transações`,
          );
        } else {
          this.logger.warn('Não há dados suficientes para treinar o modelo');
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao treinar modelo: ${error.message}`);
    }
  }

  /**
   * Extrai features relevantes do texto e valor da transação
   */
  private extractFeatures(description: string, amount: number): string {
    // Normalizar texto
    const normalizedDesc = this.normalizeText(description);

    // Tokenizar a descrição
    const tokens = this.tokenizer.tokenize(normalizedDesc);

    // Adicionar informação sobre o valor (negativo para despesas, positivo para receitas)
    const amountType = amount < 0 ? 'despesa' : 'receita';
    const amountRange = this.getAmountRange(Math.abs(amount));

    // Combinar tokens e features de valor
    return [...tokens, amountType, amountRange].join(' ');
  }

  /**
   * Determina a faixa de valor da transação
   */
  private getAmountRange(amount: number): string {
    if (amount < 50) return 'valor_muito_baixo';
    if (amount < 100) return 'valor_baixo';
    if (amount < 500) return 'valor_medio';
    if (amount < 1000) return 'valor_alto';
    return 'valor_muito_alto';
  }

  /**
   * Sugere uma categoria para uma transação com base na descrição e valor
   * Agora usando o modelo ML quando disponível
   */
  async suggestCategory(
    description: string,
    amount: number,
    userId: number,
  ): Promise<{ categoryId: number; confidence: number } | null> {
    // Verificar se há descrição
    if (!description || description.trim() === '') {
      return this.fallbackCategorization(amount, userId);
    }

    try {
      // 1. Tentar classificação ML se o modelo estiver treinado
      if (this.isModelTrained) {
        const features = this.extractFeatures(description, amount);
        const classifications = this.classifier.getClassifications(features);

        // Verificar se temos uma classificação com boa confiança
        if (classifications.length > 0 && classifications[0].value > 0.3) {
          const topCategory = classifications[0];
          return {
            categoryId: parseInt(topCategory.label, 10),
            confidence: topCategory.value,
          };
        }
      }

      // 2. Se ML não funcionar ou tiver baixa confiança, verificar transações similares
      const similarTransaction = await this.findSimilarTransaction(
        this.normalizeText(description),
        userId,
      );

      if (similarTransaction) {
        return {
          categoryId: similarTransaction.categoryId,
          confidence: 0.85, // Alta confiança - padrão repetido do usuário
        };
      }

      // 3. Usar o mapa de palavras-chave como fallback
      const matchedCategory = await this.matchCategoryByKeywords(
        this.normalizeText(description),
        amount,
        userId,
      );

      if (matchedCategory) {
        return matchedCategory;
      }

      // 4. Último recurso: sugerir baseado apenas no tipo (despesa/receita)
      return this.fallbackCategorization(amount, userId);
    } catch (error) {
      this.logger.error(`Erro ao sugerir categoria: ${error.message}`);
      return this.fallbackCategorization(amount, userId);
    }
  }

  /**
   * Categorização de fallback baseada apenas no tipo (despesa/receita)
   */
  private async fallbackCategorization(amount: number, userId: number) {
    const categories = await this.categoriesService.findAll(
      userId,
      amount < 0 ? CategoryType.EXPENSE : CategoryType.INCOME,
    );

    if (categories.length > 0) {
      return {
        categoryId: categories[0].id,
        confidence: 0.3, // Baixa confiança - apenas baseado no tipo
      };
    }

    return null;
  }

  /**
   * Normaliza o texto removendo caracteres especiais e convertendo para minúsculas
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, ''); // Remove caracteres especiais
  }

  /**
   * Busca transações similares do mesmo usuário
   */
  private async findSimilarTransaction(description: string, userId: number) {
    // Buscar as últimas 100 transações do usuário
    const recentTransactions = await this.transactionsService.findRecent(
      userId,
      100,
    );

    // Verificar se há descrições muito similares
    for (const transaction of recentTransactions) {
      const normalizedTransactionDesc = this.normalizeText(
        transaction.description,
      );

      // Verificar similaridade (implementação simples)
      if (
        normalizedTransactionDesc.includes(description) ||
        description.includes(normalizedTransactionDesc)
      ) {
        return transaction;
      }
    }

    return null;
  }

  /**
   * Busca categoria baseada em palavras-chave
   */
  private async matchCategoryByKeywords(
    description: string,
    amount: number,
    userId: number,
  ) {
    // Obter todas as categorias do usuário
    const userCategories = await this.categoriesService.findAll(
      userId,
      amount < 0 ? CategoryType.EXPENSE : CategoryType.INCOME,
    );

    // Para cada categoria, verificar se há palavras-chave correspondentes
    for (const category of userCategories) {
      const keywordsForCategory = this.keywordMap[category.name.toLowerCase()];

      if (keywordsForCategory) {
        for (const keyword of keywordsForCategory) {
          if (description.includes(keyword)) {
            return {
              categoryId: category.id,
              confidence: 0.7, // Confiança média - baseada em palavras-chave
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Treina o modelo com feedback do usuário
   * Agora atualiza também o classificador Naive Bayes
   */
  async learnFromFeedback(
    transactionId: number,
    categoryId: number,
    userId: number,
  ): Promise<void> {
    try {
      // Buscar a transação para aprender com ela
      const transaction = await this.transactionsService.findOne(
        transactionId,
        userId,
      );

      if (transaction) {
        // Extrair features da transação
        const features = this.extractFeatures(
          transaction.description,
          transaction.amount,
        );

        // Adicionar ao classificador e retreinar
        this.classifier.addDocument(features, categoryId.toString());
        this.classifier.train();

        // Atualizar também o mapa de palavras-chave para fallback
        const category = await this.categoriesService.findOne(
          categoryId,
          userId,
        );
        if (category) {
          const normalizedDesc = this.normalizeText(transaction.description);

          if (!this.keywordMap[category.name.toLowerCase()]) {
            this.keywordMap[category.name.toLowerCase()] = [];
          }

          // Adicionar palavras relevantes da descrição
          const words = normalizedDesc.split(' ').filter((w) => w.length > 3);
          for (const word of words) {
            if (!this.keywordMap[category.name.toLowerCase()].includes(word)) {
              this.keywordMap[category.name.toLowerCase()].push(word);
            }
          }
        }

        this.logger.log(
          `Modelo atualizado com feedback para transação ${transactionId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Erro ao aprender com feedback: ${error.message}`);
    }
  }
}
