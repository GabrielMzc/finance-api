import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // limite de 100 requisições por IP
    standardHeaders: true,
    legacyHeaders: false,
    message:
      'Muitas requisições deste IP, por favor tente novamente após 15 minutos',
  });

  use(req: Request, res: Response, next: NextFunction) {
    this.limiter(req, res, next);
  }
}
