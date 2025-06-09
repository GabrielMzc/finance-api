import { Injectable } from '@nestjs/common';
import { AutoCategorizationService } from './services/auto-categorization.service';
import { SpendingPredictionService } from './services/spending-prediction.service';
import { AnomalyDetectionService } from './services/anomaly-detection.service';

@Injectable()
export class SmartAnalyticsService {
  constructor(
    private readonly autoCategorizationService: AutoCategorizationService,
    private readonly spendingPredictionService: SpendingPredictionService,
    private readonly anomalyDetectionService: AnomalyDetectionService,
  ) {}
}
