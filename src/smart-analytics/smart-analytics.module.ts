import { Module, forwardRef } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { CategoriesModule } from '../categories/categories.module';
import { AccountsModule } from '../accounts/accounts.module';
import { SmartAnalyticsService } from './smart-analytics.service';
import { SmartAnalyticsController } from './smart-analytics.controller';
import { AutoCategorizationService } from './services/auto-categorization.service';
import { SpendingPredictionService } from './services/spending-prediction.service';
import { AnomalyDetectionService } from './services/anomaly-detection.service';

@Module({
  imports: [
    forwardRef(() => TransactionsModule),
    forwardRef(() => CategoriesModule),
    forwardRef(() => AccountsModule),
  ],
  controllers: [SmartAnalyticsController],
  providers: [
    SmartAnalyticsService,
    AutoCategorizationService,
    SpendingPredictionService,
    AnomalyDetectionService,
  ],
  exports: [
    SmartAnalyticsService,
    AutoCategorizationService,
    SpendingPredictionService,
    AnomalyDetectionService,
  ],
})
export class SmartAnalyticsModule {}
