import {
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppState } from '../schemas/location-point.schema';

export class LocationPointDto {
  @IsString()
  clientPointId: string;

  @IsNumber()
  sequenceNo: number;

  @IsString()
  capturedAt: string;

  // Intentionally no @Min/@Max range checks here: out-of-range points must be
  // rejected per-point by GeoTrackingService (counted in `rejected`), not by
  // failing DTO validation for the whole batch — see spec section 13
  // ("Mark as anomaly, but do not necessarily reject").
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsNumber()
  accuracyM: number;

  @IsNumber()
  speedMps: number;

  @IsNumber()
  heading: number;

  @IsNumber()
  batteryPercent: number;

  @IsString()
  networkType: string;

  @IsEnum(AppState)
  appState: AppState;

  @IsBoolean()
  isMocked: boolean;
}

export class BatchLocationPointsDto {
  @IsString()
  deviceId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationPointDto)
  points: LocationPointDto[];
}

export interface BatchLocationPointsResult {
  accepted: number;
  duplicates: number;
  rejected: number;
  lastAcceptedSequenceNo: number;
  lastUpdatedAt: Date | null;
}
