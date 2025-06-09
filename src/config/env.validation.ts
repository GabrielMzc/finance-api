import { plainToClass } from 'class-transformer';
import { IsString, IsNumber, IsBoolean, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  DB_HOST: string;

  @IsNumber()
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_DATABASE: string;

  @IsBoolean()
  DB_SYNC: boolean;

  @IsBoolean()
  DB_LOGGING: boolean;

  @IsString()
  JWT_SECRET: string;

  @IsNumber()
  JWT_EXPIRATION_TIME: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, {
    ...config,
    DB_PORT: Number(config.DB_PORT),
    DB_SYNC: config.DB_SYNC === 'true',
    DB_LOGGING: config.DB_LOGGING === 'true',
    JWT_EXPIRATION_TIME: Number(config.JWT_EXPIRATION_TIME),
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
