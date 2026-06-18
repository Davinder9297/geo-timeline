import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum AttendanceStatus {
  WORKING = 'WORKING',
  ON_BREAK = 'ON_BREAK',
  OFFLINE = 'OFFLINE',
  CHECKED_OUT = 'CHECKED_OUT',
}

export class Break {
  @Prop({ required: true })
  breakId: string;

  @Prop({ required: true })
  startAt: Date;

  @Prop()
  endAt?: Date;
}

export class Session {
  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true })
  checkInAt: Date;

  @Prop()
  checkOutAt?: Date;

  @Prop({ type: [Object], default: [] })
  breaks: Break[];
}

@Schema({ collection: 'attendance_daily', timestamps: true })
export class AttendanceDaily extends Document {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true, index: true })
  employeeId: string;

  @Prop({ required: true })
  attendanceDate: string;

  @Prop({ required: true })
  timezone: string;

  @Prop({ required: true, enum: AttendanceStatus })
  status: AttendanceStatus;

  @Prop({ required: true })
  firstCheckInAt: Date;

  @Prop()
  finalCheckOutAt?: Date;

  @Prop()
  trackingStoppedAt?: Date;

  @Prop({ type: [Object], default: [] })
  sessions: Session[];
}

export const AttendanceDailySchema = SchemaFactory.createForClass(AttendanceDaily);

AttendanceDailySchema.index({ companyId: 1, employeeId: 1, attendanceDate: 1 }, { unique: true });
