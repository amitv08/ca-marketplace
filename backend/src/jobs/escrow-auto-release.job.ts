import EscrowService from '../services/escrow.service';
import { LoggerService } from '../services/logger.service';

/**
 * Cron job to automatically release escrow payments
 * Runs daily at 2 AM to check for payments ready for auto-release
 */
export async function runEscrowAutoRelease(): Promise<number> {
  try {
    LoggerService.info('🔄 Starting escrow auto-release job');

    const releasedCount = await EscrowService.processAutoReleases();

    LoggerService.info('✅ Escrow auto-release job completed', {
      releasedCount,
      timestamp: new Date().toISOString(),
    });

    return releasedCount;
  } catch (error: any) {
    LoggerService.error('❌ Escrow auto-release job failed', error, {
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Manual trigger for testing or admin override
 */
export async function manualTriggerAutoRelease(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const count = await runEscrowAutoRelease();
    return {
      success: true,
      count,
    };
  } catch (error: any) {
    return {
      success: false,
      count: 0,
      error: error.message,
    };
  }
}
