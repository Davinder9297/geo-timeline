import { Injectable } from '@nestjs/common';
import { TimelineCalculatorService } from '../timeline-calculator.service';

export abstract class TimelineRebuildQueue {
  abstract enqueueRebuild(attendanceId: string): Promise<void>;
}

@Injectable()
export class InlineTimelineRebuildQueue implements TimelineRebuildQueue {
  constructor(
    private readonly timelineCalculatorService: TimelineCalculatorService,
  ) {}

  async enqueueRebuild(attendanceId: string): Promise<void> {
    await this.timelineCalculatorService.calculateAndUpsertSummary(
      attendanceId,
    );
  }
}
