import { LoggerService } from './logger.service';
import { retry } from '../utils/retry';
import { CircuitBreakerRegistry } from '../utils/circuitBreaker';
import { FailedOperationQueue } from '../utils/fallback';
import sgMail from '@sendgrid/mail';
import { env } from '../config/env';

/**
 * Email data structure
 */
export interface EmailData {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

/**
 * Email service configuration
 */
interface EmailConfig {
  from: string;
  replyTo?: string;
}

/**
 * Email Service with retry, circuit breaker, and queue fallback
 */
export class EmailService {
  private static circuitBreaker = CircuitBreakerRegistry.getOrCreate('email', {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 120000, // 2 minutes
    errorThresholdPercentage: 50,
  });

  private static config: EmailConfig = {
    from: process.env.EMAIL_FROM || 'noreply@camarketplace.com',
    replyTo: process.env.EMAIL_REPLY_TO,
  };

  private static readonly QUEUE_NAME = 'failed-emails';

  /**
   * Send email with retry and circuit breaker
   */
  static async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      // Execute with circuit breaker
      await this.circuitBreaker.execute(async () => {
        // Execute with retry logic
        return await retry(
          async () => {
            await this.sendEmailInternal(emailData);
          },
          {
            maxRetries: 3,
            initialDelayMs: 2000,
            maxDelayMs: 30000,
            retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'],
            onRetry: (error, attempt) => {
              LoggerService.warn('Retrying email send', {
                attempt,
                to: emailData.to,
                subject: emailData.subject,
                error: error.message,
              });
            },
          }
        );
      });

      LoggerService.info('Email sent successfully', {
        to: emailData.to,
        subject: emailData.subject,
      });

      return true;
    } catch (error: any) {
      LoggerService.error('Failed to send email', error, {
        to: emailData.to,
        subject: emailData.subject,
        circuitState: this.circuitBreaker.getState(),
      });

      // Add to failed operations queue for later retry
      this.enqueueFailedEmail(emailData);

      return false;
    }
  }

  /**
   * Send welcome email to new users
   */
  static async sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Welcome to CA Marketplace',
      html: `
        <h1>Welcome ${userName}!</h1>
        <p>Thank you for joining CA Marketplace.</p>
        <p>We're excited to have you on board.</p>
      `,
      text: `Welcome ${userName}! Thank you for joining CA Marketplace.`,
    });
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(
    userEmail: string,
    resetToken: string,
    resetUrl: string
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset for your CA Marketplace account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}?token=${resetToken}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
      text: `Password Reset\n\nVisit this link to reset your password: ${resetUrl}?token=${resetToken}\n\nThis link expires in 1 hour.`,
    });
  }

  /**
   * Send service request notification
   */
  static async sendServiceRequestNotification(
    caEmail: string,
    caName: string,
    clientName: string,
    serviceType: string
  ): Promise<boolean> {
    return this.sendEmail({
      to: caEmail,
      subject: 'New Service Request',
      html: `
        <h1>New Service Request</h1>
        <p>Hi ${caName},</p>
        <p>You have received a new service request from ${clientName}.</p>
        <p><strong>Service Type:</strong> ${serviceType}</p>
        <p>Please log in to view and respond to this request.</p>
      `,
      text: `Hi ${caName},\n\nYou have received a new service request from ${clientName}.\nService Type: ${serviceType}\n\nPlease log in to view and respond to this request.`,
    });
  }

  /**
   * Send payment confirmation
   */
  static async sendPaymentConfirmation(
    userEmail: string,
    userName: string,
    amount: number,
    orderId: string
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Payment Confirmation',
      html: `
        <h1>Payment Received</h1>
        <p>Hi ${userName},</p>
        <p>We have received your payment of ₹${amount}.</p>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p>Thank you for your business!</p>
      `,
      text: `Hi ${userName},\n\nWe have received your payment of ₹${amount}.\nOrder ID: ${orderId}\n\nThank you!`,
    });
  }

  /**
   * Internal email sending implementation
   * BUG-001 FIX: Now uses SendGrid for actual email delivery
   */
  private static async sendEmailInternal(emailData: EmailData): Promise<void> {
    // Initialize SendGrid
    if (!sgMail.client) {
      sgMail.setApiKey(env.SENDGRID_API_KEY);
    }

    // In development/test, just log the email (unless SENDGRID_API_KEY is set)
    if (process.env.NODE_ENV !== 'production' && env.SENDGRID_API_KEY === 'SG.test_key') {
      LoggerService.info('Email would be sent (dev mode - no SendGrid key)', {
        to: emailData.to,
        subject: emailData.subject,
        from: emailData.from || this.config.from,
      });
      return;
    }

    // Send via SendGrid
    const msg: any = {
      to: emailData.to,
      from: {
        email: emailData.from || env.FROM_EMAIL,
        name: env.FROM_NAME,
      },
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html,
    };

    // Add optional fields
    if (emailData.cc) msg.cc = emailData.cc;
    if (emailData.bcc) msg.bcc = emailData.bcc;
    if (emailData.attachments) msg.attachments = emailData.attachments;

    try {
      await sgMail.send(msg);
      LoggerService.info('Email sent via SendGrid', {
        to: emailData.to,
        subject: emailData.subject,
      });
    } catch (error: any) {
      LoggerService.error('SendGrid error', error, {
        to: emailData.to,
        subject: emailData.subject,
        statusCode: error.code,
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Add failed email to queue for later retry
   */
  private static enqueueFailedEmail(emailData: EmailData): void {
    FailedOperationQueue.enqueue(
      this.QUEUE_NAME,
      () => this.sendEmailInternal(emailData),
      3, // max retries
      {
        to: emailData.to,
        subject: emailData.subject,
        timestamp: new Date().toISOString(),
      }
    );

    LoggerService.info('Email added to failed operations queue', {
      queueSize: FailedOperationQueue.getQueueSize(this.QUEUE_NAME),
      to: emailData.to,
      subject: emailData.subject,
    });
  }

  /**
   * Process queued failed emails
   */
  static async processFailedEmails(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    LoggerService.info('Processing failed email queue');

    const result = await FailedOperationQueue.processQueue(this.QUEUE_NAME);

    LoggerService.info('Finished processing failed email queue', result);

    return result;
  }

  /**
   * Get failed email queue size
   */
  static getFailedEmailQueueSize(): number {
    return FailedOperationQueue.getQueueSize(this.QUEUE_NAME);
  }

  /**
   * Get email circuit breaker status
   */
  static getCircuitStatus() {
    return this.circuitBreaker.getStats();
  }

  /**
   * Reset email circuit breaker
   */
  static resetCircuit(): void {
    this.circuitBreaker.reset();
    LoggerService.info('Email circuit breaker manually reset');
  }

  /**
   * Send batch emails
   */
  static async sendBatchEmails(emails: EmailData[]): Promise<{
    total: number;
    succeeded: number;
    failed: number;
  }> {
    const results = await Promise.allSettled(
      emails.map(email => this.sendEmail(email))
    );

    const succeeded = results.filter(
      r => r.status === 'fulfilled' && r.value === true
    ).length;
    const failed = results.length - succeeded;

    LoggerService.info('Batch email send completed', {
      total: emails.length,
      succeeded,
      failed,
    });

    return {
      total: emails.length,
      succeeded,
      failed,
    };
  }
}

/**
 * Schedule periodic processing of failed emails
 * Process every 5 minutes
 */
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    EmailService.processFailedEmails().catch(error => {
      LoggerService.error('Error processing failed emails', error);
    });
  }, 5 * 60 * 1000); // 5 minutes
}
