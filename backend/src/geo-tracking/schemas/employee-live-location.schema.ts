import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum LiveLocationStatus {
  WORKING = 'WORKING',
  ON_BREAK = 'ON_BREAK',
  OFFLINE = 'OFFLINE',
  STALE = 'STALE',
  CHECKED_OUT = 'CHECKED_OUT',
}

class GeoJSONPoint {
  @Prop({ required: true, enum: ['Point'] })
  type: 'Point';

  @Prop({ required: true, type: [Number] })
  coordinates: [number, number];
}

@Schema({ collection: 'employee_live_locations', timestamps: true })
export class EmployeeLiveLocation extends Document {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true, index: true })
  employeeId: string;

  @Prop({ required: true })
  attendanceId: string;

  @Prop({ required: false })
  latestPointId?: string;

  // Optional: unknown until the employee's first GPS fix arrives, which can
  // be a while after check-in (cold GPS lock, no signal indoors, etc.). The
  // roster must still show the employee as checked in before that happens.
  @Prop({ required: false, type: GeoJSONPoint, index: '2dsphere' })
  location?: GeoJSONPoint;

  @Prop({ required: false })
  capturedAt?: Date;

  @Prop({ required: false })
  receivedAt?: Date;

  @Prop({ required: true, enum: LiveLocationStatus, index: true })
  status: LiveLocationStatus;

  @Prop({ required: true })
  isStale: boolean;

  @Prop({ required: true })
  lastUpdatedAt: Date;
}

export const EmployeeLiveLocationSchema =
  SchemaFactory.createForClass(EmployeeLiveLocation);

EmployeeLiveLocationSchema.index({ companyId: 1, status: 1 });
EmployeeLiveLocationSchema.index(
  { companyId: 1, employeeId: 1 },
  { unique: true },
);
