import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum AppState {
  FOREGROUND = 'FOREGROUND',
  BACKGROUND = 'BACKGROUND',
}

export enum PointQuality {
  GOOD = 'GOOD',
  POOR = 'POOR',
  ANOMALY = 'ANOMALY',
}

class GeoJSONPoint {
  @Prop({ required: true, enum: ['Point'] })
  type: 'Point';

  @Prop({ required: true, type: [Number] })
  coordinates: [number, number];
}

@Schema({ collection: 'location_points', timestamps: true })
export class LocationPoint extends Document {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true, index: true })
  employeeId: string;

  @Prop({ required: true, index: true })
  attendanceId: string;

  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true })
  clientPointId: string;

  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop({ required: true, index: true })
  sequenceNo: number;

  @Prop({ required: true })
  capturedAt: Date;

  @Prop({ required: true })
  receivedAt: Date;

  @Prop({ required: true, type: GeoJSONPoint, index: '2dsphere' })
  location: GeoJSONPoint;

  @Prop({ required: true })
  accuracyM: number;

  @Prop({ required: true })
  speedMps: number;

  @Prop({ required: true })
  heading: number;

  @Prop({ required: true })
  altitude: number;

  @Prop({ required: true })
  batteryPercent: number;

  @Prop({ required: true })
  networkType: string;

  @Prop({ required: true, enum: AppState })
  appState: AppState;

  @Prop({ required: true })
  isMocked: boolean;

  @Prop({ required: true, default: 'LOCATION_POINT' })
  eventType: string;

  @Prop({ required: true, enum: PointQuality })
  quality: PointQuality;
}

export const LocationPointSchema = SchemaFactory.createForClass(LocationPoint);

LocationPointSchema.index({ companyId: 1, employeeId: 1, capturedAt: 1 });
LocationPointSchema.index({ attendanceId: 1, capturedAt: 1 });
LocationPointSchema.index({ companyId: 1, capturedAt: 1 });
LocationPointSchema.index(
  { attendanceId: 1, deviceId: 1, sequenceNo: 1 },
  { unique: true },
);
LocationPointSchema.index({ clientPointId: 1 }, { unique: true });
