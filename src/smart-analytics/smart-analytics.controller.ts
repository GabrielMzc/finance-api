import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SmartAnalyticsService } from './smart-analytics.service';
import { AutoCategorizationService } from './services/auto-categorization.service';
import { SpendingPredictionService } from './services/spending-prediction.service';
import { AnomalyDetectionService } from './services/anomaly-detection.service';

@Controller('smart-analytics')
@UseGuards(JwtAuthGuard)
export class SmartAnalyticsController {
  constructor(
    private readonly smartAnalyticsService: SmartAnalyticsService,
    private readonly autoCategorizationService: AutoCategorizationService,
    private readonly spendingPredictionService: SpendingPredictionService,
    private readonly anomalyDetectionService: AnomalyDetectionService,
  ) {}

  // Endpoints existentes
  @Get('suggest-category')
  async suggestCategory(
    @Request() req,
    @Query('description') description: string,
    @Query('amount') amount: number,
  ) {
    const userId = Number(req.user.id);

    const suggestion = await this.autoCategorizationService.suggestCategory(
      description,
      amount,
      userId,
    );

    return suggestion;
  }

  @Post('category-feedback')
  async provideCategoryFeedback(
    @Request() req,
    @Body() feedback: { transactionId: number; categoryId: number },
  ) {
    const userId = Number(req.user.id);

    await this.autoCategorizationService.learnFromFeedback(
      feedback.transactionId,
      feedback.categoryId,
      userId,
    );

    return { message: 'Feedback processado com sucesso' };
  }

  // Novos endpoints para previsões
  @Get('spending-predictions')
  async getSpendingPredictions(@Request() req) {
    const userId = Number(req.user.id);

    const predictions =
      await this.spendingPredictionService.predictNextMonthSpending(userId);

    return {
      predictions,
      summary: {
        totalCurrentMonth: predictions.reduce(
          (sum, p) => sum + p.currentMonthActual,
          0,
        ),
        totalNextMonth: predictions.reduce(
          (sum, p) => sum + p.nextMonthPrediction,
          0,
        ),
        categories: predictions.length,
      },
    };
  }

  @Get('category-trend/:categoryId')
  async getCategoryTrend(
    @Request() req,
    @Param('categoryId') categoryId: number,
    @Query('months') months: number = 12,
  ) {
    const userId = Number(req.user.id);

    return this.spendingPredictionService.getCategoryTrend(
      userId,
      categoryId,
      months,
    );
  }

  // Endpoints para detecção de anomalias
  @Get('anomalies')
  async getAnomalies(@Request() req, @Query('limit') limit: number = 5) {
    const userId = Number(req.user.id);

    return this.anomalyDetectionService.detectAnomalies(userId, limit);
  }

  @Get('missing-recurrences')
  async getMissingRecurrences(@Request() req) {
    const userId = Number(req.user.id);

    return this.anomalyDetectionService.detectUnusualFrequency(userId);
  }

  // Dashboard com todos os insights combinados
  @Get('dashboard')
  async getDashboardInsights(@Request() req) {
    const userId = Number(req.user.id);

    // Obter insights em paralelo
    const [predictions, anomalies, missingRecurrences] = await Promise.all([
      this.spendingPredictionService.predictNextMonthSpending(userId),
      this.anomalyDetectionService.detectAnomalies(userId, 3), // Top 3 anomalias
      this.anomalyDetectionService.detectUnusualFrequency(userId),
    ]);

    // Calcular mudança percentual no gasto mensal
    const totalCurrentMonth = predictions.reduce(
      (sum, p) => sum + p.currentMonthActual,
      0,
    );
    const totalNextMonth = predictions.reduce(
      (sum, p) => sum + p.nextMonthPrediction,
      0,
    );
    const percentChange =
      totalCurrentMonth > 0
        ? ((totalNextMonth - totalCurrentMonth) / totalCurrentMonth) * 100
        : 0;

    // Retornar dashboard consolidado
    return {
      spendingInsights: {
        totalCurrentMonth,
        totalNextMonth,
        percentChange,
        trend:
          percentChange > 5
            ? 'increasing'
            : percentChange < -5
              ? 'decreasing'
              : 'stable',
        topCategories: predictions.slice(0, 5), // Top 5 categorias
      },
      anomalies,
      missingRecurrences: missingRecurrences.slice(0, 3), // Top 3 transações ausentes
      lastUpdated: new Date(),
    };
  }
}
