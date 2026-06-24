import { Injectable, Logger } from '@nestjs/common';
import { TimelineCalculatorService } from '../timeline-calculator.service';

export abstract class TimelineRebuildQueue {
  abstract enqueueRebuild(attendanceId: string): Promise<void>;
}

/**
 * Debounces rebuilds per attendanceId and never blocks the caller.
 *
 * calculateAndUpsertSummary reprocesses every location point for the whole
 * day from scratch on each call. Triggering it synchronously on every
 * ~30s location batch (needed to keep dashboard stats live) means cost
 * grows with total points-so-far on every single batch — across a full
 * day that's effectively O(n^2) in the day's point count, done inline in
 * the request path. Debouncing collapses bursts of batches into one
 * trailing recompute per window, and firing it without awaiting keeps the
 * batch endpoint's response latency independent of summary size.
 *
 * This is not a substitute for a real incremental recompute (only
 * reprocessing the tail of new points) or an out-of-process queue
 * (BullMQ/SQS) — both are larger follow-ups if recompute cost still
 * matters under heavier load.
 */
@Injectable()
export class InlineTimelineRebuildQueue implements TimelineRebuildQueue {
  private readonly logger = new Logger(InlineTimelineRebuildQueue.name);
  private readonly debounceMs = 15000;
  private readonly lastRunAt = new Map<string, number>();
  private readonly pendingTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly timelineCalculatorService: TimelineCalculatorService,
  ) {}

  async enqueueRebuild(attendanceId: string): Promise<void> {
    if (this.pendingTimers.has(attendanceId)) {
      // A trailing run is already scheduled for this attendance; the new
      // points will be picked up when it fires.
      return;
    }

    const lastRun = this.lastRunAt.get(attendanceId) ?? 0;
    const elapsed = Date.now() - lastRun;

    if (elapsed >= this.debounceMs) {
      this.runNow(attendanceId);
      return;
    }

    const delay = this.debounceMs - elapsed;
    const timer = setTimeout(() => {
      this.pendingTimers.delete(attendanceId);
      this.runNow(attendanceId);
    }, delay);
    this.pendingTimers.set(attendanceId, timer);
  }

  private runNow(attendanceId: string): void {
    this.lastRunAt.set(attendanceId, Date.now());
    this.timelineCalculatorService
      .calculateAndUpsertSummary(attendanceId)
      .catch((err) => {
        this.logger.error(
          `Timeline rebuild failed for attendance ${attendanceId}: ${err.message}`,
          err.stack,
        );
      });
  }
}
