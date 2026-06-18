import { IsString, IsNumber, IsEnum, IsBoolean, IsArray, ValidateNested, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AppState } from '../schemas/location-point.schema';

export class LocationPointDto {
  @IsString()
  clientPointId: string;

  @IsNumber()
  sequenceNo: number;

  @IsString()
  capturedAt: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
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
