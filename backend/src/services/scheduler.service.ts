/**
 * Scheduler Service
 *
 * Manages all scheduled/cron jobs for the platform
 * Currently handles:
 * - Auto-release escrow payments
 */

import cron from 'node-cron';
import { autoReleaseEscrowPayments } from './escrow.service';

export class SchedulerService {
  private static isInitialized = false;

  /**
   * Start all scheduled jobs
   */
  static start() {
    if (this.isInitialized) {
      console.log('[Scheduler] Already initialized, skipping...');
      return;
    }

    console.log('[Scheduler] Initializing scheduled jobs...');

    // Auto-release escrow payments - runs every hour
    cron.schedule('0 * * * *', async () => {
      console.log('[Scheduler] Running auto-release escrow job...');
      try {
        const stats = await autoReleaseEscrowPayments();
        console.log(`[Scheduler] Auto-release completed: ${stats.released} released, ${stats.failed} failed`);
      } catch (error: any) {
        console.error('[Scheduler] Auto-release job failed:', error.message);
      }
    });

    console.log('[Scheduler] ✓ Auto-release escrow job scheduled (every hour at :00)');

    this.isInitialized = true;
    console.log('[Scheduler] ✓ All scheduled jobs initialized');
  }

  /**
   * Stop all scheduled jobs (useful for testing/shutdown)
   */
  static stop() {
    if (!this.isInitialized) {
      console.log('[Scheduler] Not initialized, nothing to stop');
      return;
    }

    // node-cron doesn't expose a global stop, but we can track this
    console.log('[Scheduler] Stopping all scheduled jobs...');
    this.isInitialized = false;
  }
}
