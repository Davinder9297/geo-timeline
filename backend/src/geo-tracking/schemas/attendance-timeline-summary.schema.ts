import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

class ProcessedPoint {
  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop({ required: true })
  capturedAt: Date;

  @Prop({ required: true })
  sessionId: string;
}

class Anomaly {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  startAt: Date;

  @Prop({ required: true })
  endAt: Date;

  @Prop({ required: true })
  durationSeconds: number;
}

@Schema({ collection: 'attendance_timeline_summaries', timestamps: true })
export class AttendanceTimelineSummary extends Document {
  @Prop({ required: true, index: true })
  companyId: string;

  @Prop({ required: true, index: true })
  employeeId: string;

  @Prop({ required: true, unique: true, index: true })
  attendanceId: string;

  @Prop({ required: true })
  attendanceDate: string;

  @Prop({ required: true })
  rawDistanceMeters: number;

  @Prop({ required: true })
  processedDistanceMeters: number;

  @Prop({ required: true })
  workingSeconds: number;

  @Prop({ required: true })
  breakSeconds: number;

  @Prop({ required: true })
  movingSeconds: number;

  @Prop({ required: true })
  holdSeconds: number;

  @Prop({ required: true })
  dataGapSeconds: number;

  @Prop({ required: true, min: 0, max: 100 })
  gpsQualityScore: number;

  @Prop({ required: true })
  encodedRawPolyline: string;

  @Prop({ required: true })
  encodedProcessedPolyline: string;

  // De-noised points backing encodedProcessedPolyline (quality-filtered +
  // jitter-filtered + Douglas-Peucker simplified), kept per-session and
  // timestamped so the dashboard can render a clean, per-session-colored
  // route instead of falling back to raw/noisy points.
  @Prop({ type: [Object], default: [] })
  processedPoints: ProcessedPoint[];

  @Prop({ type: [Object], default: [] })
  timelineEvents: any[];

  @Prop({ type: [Object], default: [] })
  anomalies: Anomaly[];

  @Prop({ required: true })
  lastComputedAt: Date;
}

export const AttendanceTimelineSummarySchema = SchemaFactory.createForClass(
  AttendanceTimelineSummary,
);

AttendanceTimelineSummarySchema.index({
  companyId: 1,
  employeeId: 1,
  attendanceDate: 1,
});
