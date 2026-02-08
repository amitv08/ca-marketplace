/**
 * Bull Queue Configuration
 * Sets up Redis-backed job queues for reports, aggregation, and segments
 */

import Bull, { Queue, QueueOptions } from 'bull';

/**
 * Default queue options
 * Includes retry strategy, job removal policies, and connection config
 */
const defaultQueueOptions: QueueOptions = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null, // Required for Bull
    enableReadyCheck: false,
  },
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5 second delay
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500, // Keep last 500 failed jobs for debugging
  },
  settings: {
    stalledInterval: 30000, // Check for stalled jobs every 30 seconds
    maxStalledCount: 2, // Mark as failed after 2 stalls
  },
};

/**
 * Queue instances
 */
export const queues = {
  reports: null as Queue | null,
  aggregation: null as Queue | null,
  segments: null as Queue | null,
  escrow: null as Queue | null,
};

/**
 * Initialize all queues
 * Must be called during app startup
 */
export async function initializeQueues(): Promise<void> {
  console.log('Initializing Bull queues...');

  // Reports queue - for scheduled and on-demand report generation
  queues.reports = new Bull('reports', {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 2, // Reports can be regenerated manually
      timeout: 120000, // 2 minute timeout for report generation
    },
  });

  // Aggregation queue - for daily metric rollups
  queues.aggregation = new Bull('aggregation', {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 5, // Critical job, retry more times
      timeout: 300000, // 5 minute timeout for large aggregations
    },
  });

  // Segments queue - for user segment refresh
  queues.segments = new Bull('segments', {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 3,
      timeout: 180000, // 3 minute timeout
    },
  });

  // Escrow queue - for automatic escrow release
  queues.escrow = new Bull('escrow', {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 5, // Critical financial operation, retry more times
      timeout: 300000, // 5 minute timeout for payment processing
    },
  });

  // Set up event listeners for each queue
  Object.entries(queues).forEach(([name, queue]) => {
    if (!queue) return;

    queue.on('error', (error) => {
      console.error(`Queue ${name} error:`, error);
    });

    queue.on('failed', (job, error) => {
      console.error(`Job ${job.id} in queue ${name} failed:`, error.message);
    });

    queue.on('completed', (job) => {
      console.log(`Job ${job.id} in queue ${name} completed successfully`);
    });

    queue.on('stalled', (job) => {
      console.warn(`Job ${job.id} in queue ${name} stalled`);
    });
  });

  console.log('Bull queues initialized successfully');
}

/**
 * Get a queue by name
 *
 * @param name - Queue name
 * @returns Queue instance
 */
export function getQueue(name: keyof typeof queues): Queue {
  const queue = queues[name];
  if (!queue) {
    throw new Error(`Queue ${name} not initialized. Call initializeQueues() first.`);
  }
  return queue;
}

/**
 * Gracefully close all queues
 * Should be called during app shutdown
 */
export async function closeQueues(): Promise<void> {
  console.log('Closing Bull queues...');

  const closePromises = Object.entries(queues).map(async ([name, queue]) => {
    if (queue) {
      await queue.close();
      console.log(`Queue ${name} closed`);
    }
  });

  await Promise.all(closePromises);
  console.log('All queues closed successfully');
}

/**
 * Clean up completed and failed jobs
 * Recommended to run periodically
 *
 * @param maxAge - Maximum age in milliseconds (default 7 days)
 */
export async function cleanupQueues(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  console.log('Cleaning up old jobs...');

  const cleanupPromises = Object.entries(queues).map(async ([name, queue]) => {
    if (!queue) return;

    const [completedCount, failedCount] = await Promise.all([
      queue.clean(maxAge, 'completed'),
      queue.clean(maxAge, 'failed'),
    ]);

    console.log(`Queue ${name}: Removed ${completedCount} completed and ${failedCount} failed jobs`);
  });

  await Promise.all(cleanupPromises);
  console.log('Queue cleanup complete');
}

/**
 * Get queue statistics
 * Useful for monitoring and debugging
 *
 * @param queueName - Queue name
 * @returns Queue statistics
 */
export async function getQueueStats(queueName: keyof typeof queues) {
  const queue = getQueue(queueName);

  const [
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  ] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getPausedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Pause all queues
 * Useful for maintenance
 */
export async function pauseAllQueues(): Promise<void> {
  console.log('Pausing all queues...');

  const pausePromises = Object.entries(queues).map(async ([name, queue]) => {
    if (queue) {
      await queue.pause();
      console.log(`Queue ${name} paused`);
    }
  });

  await Promise.all(pausePromises);
}

/**
 * Resume all queues
 */
export async function resumeAllQueues(): Promise<void> {
  console.log('Resuming all queues...');

  const resumePromises = Object.entries(queues).map(async ([name, queue]) => {
    if (queue) {
      await queue.resume();
      console.log(`Queue ${name} resumed`);
    }
  });

  await Promise.all(resumePromises);
}

/**
 * Remove all jobs from all queues
 * WARNING: Use with caution
 */
export async function obliterateQueues(): Promise<void> {
  console.warn('OBLITERATING all queues - this will remove ALL jobs!');

  const obliteratePromises = Object.entries(queues).map(async ([name, queue]) => {
    if (queue) {
      await queue.obliterate({ force: true });
      console.log(`Queue ${name} obliterated`);
    }
  });

  await Promise.all(obliteratePromises);
}
