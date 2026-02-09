/**
 * Job Scheduler Service
 * Manages Bull queues and scheduled jobs for reports, aggregations, and segments
 */

import { Job } from 'bull';
import { getQueue, initializeQueues as initQueues, closeQueues } from '../config/queues';
import { AggregationService } from './aggregation.service';

import { runEscrowAutoRelease } from '../jobs/escrow-auto-release.job';

/**
 * Job data interfaces
 */
export interface ReportJobData {
  reportId: string;
  reportType: string;
  format: string;
  filters?: any;
}

export interface AggregationJobData {
  date?: string; // ISO date string
  backfill?: {
    startDate: string;
    endDate: string;
  };
}

export interface SegmentJobData {
  segmentId?: string; // If null, refresh all segments
}

export interface EscrowJobData {
  manual?: boolean; // If true, triggered manually by admin
}

/**
 * Job status interface
 */
export interface JobStatus {
  id: string;
  name: string;
  data: any;
  progress: number;
  state: string;
  attempts: number;
  failedReason?: string;
  finishedOn?: number;
  processedOn?: number;
}

export class JobSchedulerService {
  /**
   * Initialize all queues and set up processors
   * Must be called during app startup
   */
  static async initializeQueues(): Promise<void> {
    await initQueues();
    await this.setupProcessors();
    await this.scheduleDailyAggregation();
    
    await this.scheduleEscrowAutoRelease();
    console.log('Job Scheduler initialized with escrow auto-release');
  }

  /**
   * Set up job processors for all queues
   */
  private static async setupProcessors(): Promise<void> {
    const reportsQueue = getQueue('reports');
    const aggregationQueue = getQueue('aggregation');
    const segmentsQueue = getQueue('segments');

    // Reports processor
    reportsQueue.process('generate-report', 3, async (job: Job<ReportJobData>) => {
      return await this.processReportJob(job);
    });

    // Aggregation processor
    aggregationQueue.process('daily-aggregation', 1, async (job: Job<AggregationJobData>) => {
      return await this.processAggregationJob(job);
    });

    // Segments processor
    segmentsQueue.process('refresh-segments', 2, async (job: Job<SegmentJobData>) => {
      return await this.processSegmentJob(job);
    });

    // Escrow auto-release processor
    const escrowQueue = getQueue('escrow');
    escrowQueue.process('auto-release', 1, async (job: Job<EscrowJobData>) => {
      return await this.processEscrowAutoRelease(job);
    });

    console.log('Job processors configured with escrow auto-release');
  }

  /**
   * Schedule daily aggregation job
   * Runs every day at midnight
   */
  static async scheduleDailyAggregation(): Promise<void> {
    const aggregationQueue = getQueue('aggregation');

    // Remove existing cron jobs to avoid duplicates
    const repeatableJobs = await aggregationQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === 'daily-aggregation') {
        await aggregationQueue.removeRepeatableByKey(job.key);
      }
    }

    // Schedule new job at midnight every day
    await aggregationQueue.add(
      'daily-aggregation',
      {},
      {
        repeat: {
          cron: '0 0 * * *', // Midnight every day
          tz: 'UTC',
        },
        jobId: 'daily-aggregation-cron',
      }
    );

    console.log('Daily aggregation job scheduled (midnight UTC)');
  }

  /**
   * Schedule escrow auto-release job
   * Runs daily at 2 AM UTC
   */
  static async scheduleEscrowAutoRelease(): Promise<void> {
    try {
      const escrowQueue = getQueue('escrow');
      const repeatableJobs = await escrowQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === 'auto-release') {
          await escrowQueue.removeRepeatableByKey(job.key);
        }
      }
      await escrowQueue.add(
        'auto-release',
        {},
        {
          repeat: {
            cron: '0 2 * * *',
            tz: 'UTC',
          },
          jobId: 'escrow-auto-release-cron',
        }
      );
      console.log('Escrow auto-release job scheduled (2 AM UTC)');
    } catch (error) {
      console.error('Failed to schedule escrow auto-release:', error);
    }
  }

  /**
   * Schedule a report generation job
   *
   * @param reportId - Scheduled report ID
   * @param cronExpression - Cron schedule (e.g., "0 0 1 * *" for monthly)
   * @returns Job instance
   */
  static async scheduleReportJob(
    reportId: string,
    cronExpression: string
  ): Promise<Job<ReportJobData>> {
    const reportsQueue = getQueue('reports');

    const job = await reportsQueue.add(
      'generate-report',
      { reportId } as ReportJobData,
      {
        repeat: {
          cron: cronExpression,
          tz: 'UTC',
        },
        jobId: `report-${reportId}`,
      }
    );

    console.log(`Report job ${reportId} scheduled with cron: ${cronExpression}`);
    return job;
  }

  /**
   * Cancel a scheduled report job
   *
   * @param reportId - Scheduled report ID
   */
  static async cancelReportJob(reportId: string): Promise<void> {
    const reportsQueue = getQueue('reports');
    const repeatableJobs = await reportsQueue.getRepeatableJobs();

    for (const job of repeatableJobs) {
      if (job.id === `report-${reportId}`) {
        await reportsQueue.removeRepeatableByKey(job.key);
        console.log(`Report job ${reportId} cancelled`);
      }
    }
  }

  /**
   * Generate a report immediately (on-demand)
   *
   * @param reportData - Report generation data
   * @returns Job instance
   */
  static async generateReportNow(reportData: ReportJobData): Promise<Job<ReportJobData>> {
    const reportsQueue = getQueue('reports');

    const job = await reportsQueue.add('generate-report', reportData, {
      priority: 1, // Higher priority for on-demand reports
    });

    console.log(`On-demand report job ${job.id} queued`);
    return job;
  }

  /**
   * Schedule segment refresh job
   * Runs hourly by default
   *
   * @param cronExpression - Cron schedule (default hourly)
   */
  static async scheduleSegmentRefresh(cronExpression: string = '0 * * * *'): Promise<void> {
    const segmentsQueue = getQueue('segments');

    // Remove existing cron jobs
    const repeatableJobs = await segmentsQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === 'refresh-segments') {
        await segmentsQueue.removeRepeatableByKey(job.key);
      }
    }

    // Schedule new job
    await segmentsQueue.add(
      'refresh-segments',
      {},
      {
        repeat: {
          cron: cronExpression,
          tz: 'UTC',
        },
        jobId: 'segment-refresh-cron',
      }
    );

    console.log(`Segment refresh job scheduled with cron: ${cronExpression}`);
  }

  /**
   * Process report generation job
   */
  private static async processReportJob(job: Job<ReportJobData>): Promise<any> {
    const { reportId } = job.data;

    console.log(`Processing report job ${job.id} for report ${reportId}`);
    await job.progress(10);

    // Import ReportingService dynamically to avoid circular dependencies
    const { ReportingService } = await import('./reporting.service');

    await job.progress(30);

    // Generate report
    const result = await ReportingService.executeScheduledReport(reportId);

    await job.progress(90);

    console.log(`Report job ${job.id} completed: ${result.fileUrl}`);
    await job.progress(100);

    return result;
  }

  /**
   * Process aggregation job
   */
  private static async processAggregationJob(job: Job<AggregationJobData>): Promise<any> {
    console.log(`Processing aggregation job ${job.id}`);
    await job.progress(10);

    const { date, backfill } = job.data;

    if (backfill) {
      // Backfill mode
      const startDate = new Date(backfill.startDate);
      const endDate = new Date(backfill.endDate);

      console.log(`Backfilling metrics from ${backfill.startDate} to ${backfill.endDate}`);
      await job.progress(20);

      const count = await AggregationService.backfillMetrics(startDate, endDate);

      await job.progress(90);
      console.log(`Backfilled ${count} days of metrics`);
      await job.progress(100);

      return { backfilled: count };
    } else {
      // Normal daily aggregation
      const targetDate = date ? new Date(date) : undefined;

      await job.progress(30);
      const result = await AggregationService.aggregateDailyMetrics(targetDate);

      await job.progress(90);
      console.log(`Aggregated metrics for ${result.date.toISOString()}`);
      await job.progress(100);

      return result;
    }
  }

  /**
   * Process segment refresh job
   */
  private static async processSegmentJob(job: Job<SegmentJobData>): Promise<any> {
    console.log(`Processing segment job ${job.id}`);
    await job.progress(10);

    const { segmentId } = job.data;

    // Import SegmentationService dynamically
    const { SegmentationService } = await import('./segmentation.service');

    if (segmentId) {
      // Refresh single segment
      await job.progress(30);
      await SegmentationService.refreshSegmentCache(segmentId);
      await job.progress(90);
      console.log(`Refreshed segment ${segmentId}`);
    } else {
      // Refresh all segments
      await job.progress(20);
      const count = await SegmentationService.refreshAllSegments();
      await job.progress(90);
      console.log(`Refreshed ${count} segments`);
    }

    await job.progress(100);
    return { segmentId };
  }

  /**
   * Process escrow auto-release job
   */
  private static async processEscrowAutoRelease(job: Job<EscrowJobData>): Promise<any> {
    console.log(`Processing escrow auto-release job ${job.id}`);
    await job.progress(10);
    try {
      const releasedCount = await runEscrowAutoRelease();
      await job.progress(90);
      console.log(`Auto-released ${releasedCount} escrow payments`);
      await job.progress(100);
      return { releasedCount, success: true };
    } catch (error: any) {
      console.error('Escrow auto-release job failed:', error);
      throw error;
    }
  }

  /**
   * Get job status by ID
   *
   * @param jobId - Job ID
   * @returns Job status
   */
  static async getJobStatus(jobId: string): Promise<JobStatus | null> {
    // Try all queues
    for (const queueName of ['reports', 'aggregation', 'segments'] as const) {
      const queue = getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (job) {
        const state = await job.getState();
        return {
          id: job.id as string,
          name: job.name,
          data: job.data,
          progress: job.progress() as number,
          state,
          attempts: job.attemptsMade,
          failedReason: job.failedReason,
          finishedOn: job.finishedOn || undefined,
          processedOn: job.processedOn || undefined,
        };
      }
    }

    return null;
  }

  /**
   * Get all jobs in a queue
   *
   * @param queueName - Queue name
   * @param state - Job state filter
   * @param limit - Max number of jobs to return
   * @returns Array of job statuses
   */
  static async getQueueJobs(
    queueName: 'reports' | 'aggregation' | 'segments',
    state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' = 'active',
    limit: number = 50
  ): Promise<JobStatus[]> {
    const queue = getQueue(queueName);
    const jobs = await queue.getJobs([state], 0, limit - 1);

    const statuses = await Promise.all(
      jobs.map(async (job) => {
        const jobState = await job.getState();
        return {
          id: job.id as string,
          name: job.name,
          data: job.data,
          progress: job.progress() as number,
          state: jobState,
          attempts: job.attemptsMade,
          failedReason: job.failedReason,
          finishedOn: job.finishedOn || undefined,
          processedOn: job.processedOn || undefined,
        };
      })
    );

    return statuses;
  }

  /**
   * Retry a failed job
   *
   * @param jobId - Job ID
   * @returns Success status
   */
  static async retryJob(jobId: string): Promise<boolean> {
    for (const queueName of ['reports', 'aggregation', 'segments'] as const) {
      const queue = getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (job) {
        await job.retry();
        console.log(`Job ${jobId} queued for retry`);
        return true;
      }
    }

    return false;
  }

  /**
   * Remove a job from queue
   *
   * @param jobId - Job ID
   * @returns Success status
   */
  static async removeJob(jobId: string): Promise<boolean> {
    for (const queueName of ['reports', 'aggregation', 'segments'] as const) {
      const queue = getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (job) {
        await job.remove();
        console.log(`Job ${jobId} removed`);
        return true;
      }
    }

    return false;
  }

  /**
   * Gracefully shutdown job scheduler
   */
  static async shutdown(): Promise<void> {
    console.log('Shutting down job scheduler...');
    await closeQueues();
    console.log('Job scheduler shut down successfully');
  }
}
