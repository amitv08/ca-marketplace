/**
 * Email Notification Service
 * 
 * Sends transactional emails using Nodemailer with SMTP
 * Supports multiple email providers: Gmail, SendGrid, AWS SES, Custom SMTP
 */

import nodemailer from 'nodemailer';
import { LoggerService } from './logger.service';

interface EmailRecipient {
  email: string;
  name?: string;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: any[];
}

class EmailNotificationService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize email transporter
   */
  private initialize() {
    try {
      const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      };

      // Only initialize if SMTP is configured
      if (smtpConfig.host && smtpConfig.auth.user && smtpConfig.auth.pass) {
        this.transporter = nodemailer.createTransport(smtpConfig);
        this.isConfigured = true;
        
        // Verify connection
        this.transporter.verify((error: any, success: any) => {
          if (error) {
            LoggerService.error('SMTP connection failed', error);
            this.isConfigured = false;
          } else {
            LoggerService.info('SMTP connection verified');
          }
        });
      } else {
        LoggerService.warn('SMTP not configured - emails will be logged only');
      }
    } catch (error) {
      LoggerService.error('Failed to initialize email service', error as Error);
      this.isConfigured = false;
    }
  }

  /**
   * Send email with retry logic
   */
  private async sendEmail(options: EmailOptions, retries = 3): Promise<any> {
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const fromName = 'CA Marketplace';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: this.wrapInTemplate(options.html),
      text: options.text || this.htmlToText(options.html),
      attachments: options.attachments,
    };

    // If not configured, just log
    if (!this.isConfigured || !this.transporter) {
      console.log('📧 [EMAIL - NOT SENT]', {
        to: mailOptions.to,
        subject: mailOptions.subject,
      });
      LoggerService.info('Email not sent (SMTP not configured)', {
        to: mailOptions.to,
        subject: mailOptions.subject,
      });
      return { sent: false, messageId: 'not-configured' };
    }

    // Try sending with retries
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        
        LoggerService.info('Email sent successfully', {
          to: mailOptions.to,
          subject: mailOptions.subject,
          messageId: info.messageId,
        });

        return { sent: true, messageId: info.messageId };
      } catch (error) {
        LoggerService.error(`Email send attempt ${attempt}/${retries} failed`, error as Error);

        if (attempt === retries) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  /**
   * Wrap email content in branded HTML template
   */
  private wrapInTemplate(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e0e0e0;
          }
          .footer {
            background: #f5f5f5;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-radius: 0 0 10px 10px;
          }
          a.button {
            display: inline-block;
            background-color: #667eea;
            color: white !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          a.button:hover {
            background-color: #5568d3;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">CA Marketplace</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Professional CA Services Platform</p>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>CA Marketplace &copy; ${new Date().getFullYear()}</p>
          <p>This is an automated email. Please do not reply to this message.</p>
          <p>
            <a href="${process.env.APP_URL || 'http://localhost:3001'}" style="color: #667eea;">Visit Platform</a> | 
            <a href="${process.env.APP_URL || 'http://localhost:3001'}/support" style="color: #667eea;">Support</a>
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Convert HTML to plain text (basic)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  /**
   * ============================================================================
   * SERVICE REQUEST NOTIFICATIONS
   * ============================================================================
   */

  /**
   * Notify CA when new request is created
   */
  async sendRequestCreatedNotification(
    caEmail: string,
    data: {
      caName: string;
      clientName: string;
      serviceType: string;
      requestId: string;
      description?: string;
      deadline?: Date;
    }
  ) {
    const html = `
      <h2>New Service Request</h2>
      <p>Hello ${data.caName},</p>
      <p>You have received a new service request from <strong>${data.clientName}</strong>.</p>
      
      <h3>Request Details:</h3>
      <ul>
        <li><strong>Service Type:</strong> ${data.serviceType}</li>
        <li><strong>Request ID:</strong> ${data.requestId}</li>
        ${data.deadline ? `<li><strong>Deadline:</strong> ${data.deadline.toLocaleDateString()}</li>` : ''}
      </ul>
      
      ${data.description ? `<p><strong>Description:</strong><br>${data.description}</p>` : ''}
      
      <p>
        <a href="${process.env.APP_URL}/ca/requests/${data.requestId}" class="button">
          View Request
        </a>
      </p>
      
      <p>Please review and respond to this request at your earliest convenience.</p>
    `;

    return this.sendEmail({
      to: caEmail,
      subject: `New Service Request from ${data.clientName}`,
      html,
    });
  }

  /**
   * Notify client when CA accepts request
   */
  async sendRequestAcceptedNotification(
    clientEmail: string,
    data: {
      clientName: string;
      caName: string;
      serviceType: string;
      requestId: string;
      caEmail?: string;
      caPhone?: string;
    }
  ) {
    const html = `
      <h2>✅ Service Request Accepted</h2>
      <p>Hello ${data.clientName},</p>
      <p>Good news! <strong>${data.caName}</strong> has accepted your service request.</p>
      
      <h3>Request Details:</h3>
      <ul>
        <li><strong>Service Type:</strong> ${data.serviceType}</li>
        <li><strong>Request ID:</strong> ${data.requestId}</li>
        <li><strong>CA:</strong> ${data.caName}</li>
        ${data.caEmail ? `<li><strong>CA Email:</strong> ${data.caEmail}</li>` : ''}
        ${data.caPhone ? `<li><strong>CA Phone:</strong> ${data.caPhone}</li>` : ''}
      </ul>
      
      <p>Your CA will begin working on your request soon. You can communicate with them through the platform's messaging system.</p>
      
      <p>
        <a href="${process.env.APP_URL}/client/requests/${data.requestId}" class="button">
          View Request Details
        </a>
      </p>
    `;

    return this.sendEmail({
      to: clientEmail,
      subject: `Service Request Accepted by ${data.caName}`,
      html,
    });
  }

  /**
   * Notify client when CA rejects request
   */
  async sendRequestRejectedNotification(
    clientEmail: string,
    data: {
      clientName: string;
      caName: string;
      serviceType: string;
      requestId: string;
      reason?: string;
    }
  ) {
    const html = `
      <h2>Service Request Status Update</h2>
      <p>Hello ${data.clientName},</p>
      <p><strong>${data.caName}</strong> was unable to accept your service request.</p>
      
      <h3>Request Details:</h3>
      <ul>
        <li><strong>Service Type:</strong> ${data.serviceType}</li>
        <li><strong>Request ID:</strong> ${data.requestId}</li>
      </ul>
      
      ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
      
      <p>Don't worry! You can browse other qualified CAs on our platform and submit your request to them.</p>
      
      <p>
        <a href="${process.env.APP_URL}/cas" class="button">
          Browse Available CAs
        </a>
      </p>
    `;

    return this.sendEmail({
      to: clientEmail,
      subject: 'Service Request Update',
      html,
    });
  }

  /**
   * Notify client when request is completed
   */
  async sendRequestCompletedNotification(
    clientEmail: string,
    data: {
      clientName: string;
      caName: string;
      serviceType: string;
      requestId: string;
      amount?: number;
    }
  ) {
    const html = `
      <h2>🎉 Service Request Completed</h2>
      <p>Hello ${data.clientName},</p>
      <p><strong>${data.caName}</strong> has marked your service request as completed.</p>
      
      <h3>Request Details:</h3>
      <ul>
        <li><strong>Service Type:</strong> ${data.serviceType}</li>
        <li><strong>Request ID:</strong> ${data.requestId}</li>
        <li><strong>CA:</strong> ${data.caName}</li>
        ${data.amount ? `<li><strong>Amount Due:</strong> ₹${data.amount.toFixed(2)}</li>` : ''}
      </ul>
      
      <p>Please review the work and proceed with payment if you're satisfied.</p>
      
      <p>
        <a href="${process.env.APP_URL}/client/requests/${data.requestId}" class="button">
          Review & Pay
        </a>
      </p>
      
      <p>After payment, we'd appreciate if you could leave a review for ${data.caName}.</p>
    `;

    return this.sendEmail({
      to: clientEmail,
      subject: `Service Request Completed - Payment Required`,
      html,
    });
  }

  /**
   * Notify CA when request is cancelled
   */
  async sendRequestCancelledNotification(
    caEmail: string,
    data: {
      caName: string;
      clientName: string;
      serviceType: string;
      requestId: string;
      reason?: string;
    }
  ) {
    const html = `
      <h2>Service Request Cancelled</h2>
      <p>Hello ${data.caName},</p>
      <p>The service request from <strong>${data.clientName}</strong> has been cancelled.</p>
      
      <h3>Request Details:</h3>
      <ul>
        <li><strong>Service Type:</strong> ${data.serviceType}</li>
        <li><strong>Request ID:</strong> ${data.requestId}</li>
      </ul>
      
      ${data.reason ? `<p><strong>Cancellation Reason:</strong> ${data.reason}</p>` : ''}
      
      <p>No further action is required from your side.</p>
    `;

    return this.sendEmail({
      to: caEmail,
      subject: 'Service Request Cancelled',
      html,
    });
  }

  /**
   * ============================================================================
   * PAYMENT NOTIFICATIONS
   * ============================================================================
   */

  /**
   * Notify CA when payment is received
   */
  async sendPaymentReceivedNotification(
    caEmail: string,
    data: {
      caName: string;
      clientName: string;
      amount: number;
      platformFee: number;
      caAmount: number;
      requestId: string;
      transactionId: string;
    }
  ) {
    const html = `
      <h2>💰 Payment Received</h2>
      <p>Hello ${data.caName},</p>
      <p>You have received a payment for your completed service.</p>
      
      <h3>Payment Details:</h3>
      <ul>
        <li><strong>Client:</strong> ${data.clientName}</li>
        <li><strong>Request ID:</strong> ${data.requestId}</li>
        <li><strong>Total Amount:</strong> ₹${data.amount.toFixed(2)}</li>
        <li><strong>Platform Fee (10%):</strong> -₹${data.platformFee.toFixed(2)}</li>
        <li><strong>Your Earnings:</strong> ₹${data.caAmount.toFixed(2)}</li>
        <li><strong>Transaction ID:</strong> ${data.transactionId}</li>
      </ul>
      
      <p>The payment will be released to your wallet after the review period (7 days) or when the client submits a review, whichever comes first.</p>
      
      <p>
        <a href="${process.env.APP_URL}/ca/earnings" class="button">
          View Earnings
        </a>
      </p>
    `;

    return this.sendEmail({
      to: caEmail,
      subject: `Payment Received - ₹${data.caAmount.toFixed(2)}`,
      html,
    });
  }

  /**
   * Notify CA when payment is released to wallet
   */
  async sendPaymentReleasedNotification(
    caEmail: string,
    data: {
      caName: string;
      amount: number;
      requestId: string;
      walletBalance: number;
    }
  ) {
    const html = `
      <h2>✅ Payment Released to Wallet</h2>
      <p>Hello ${data.caName},</p>
      <p>Your payment has been released to your wallet and is now available for withdrawal.</p>
      
      <h3>Payment Details:</h3>
      <ul>
        <li><strong>Amount Released:</strong> ₹${data.amount.toFixed(2)}</li>
        <li><strong>Request ID:</strong> ${data.requestId}</li>
        <li><strong>Current Wallet Balance:</strong> ₹${data.walletBalance.toFixed(2)}</li>
      </ul>
      
      <p>You can now request a payout to your bank account.</p>
      
      <p>
        <a href="${process.env.APP_URL}/ca/wallet" class="button">
          View Wallet & Request Payout
        </a>
      </p>
    `;

    return this.sendEmail({
      to: caEmail,
      subject: 'Payment Released to Your Wallet',
      html,
    });
  }

  /**
   * Notify client when refund is processed
   */
  async sendRefundProcessedNotification(
    clientEmail: string,
    data: {
      clientName: string;
      refundAmount: number;
      requestId: string;
      reason?: string;
    }
  ) {
    const html = `
      <h2>Refund Processed</h2>
      <p>Hello ${data.clientName},</p>
      <p>Your refund has been processed successfully.</p>
      
      <h3>Refund Details:</h3>
      <ul>
        <li><strong>Refund Amount:</strong> ₹${data.refundAmount.toFixed(2)}</li>
        <li><strong>Request ID:</strong> ${data.requestId}</li>
        ${data.reason ? `<li><strong>Reason:</strong> ${data.reason}</li>` : ''}
      </ul>
      
      <p>The refund will be credited to your original payment method within 5-7 business days.</p>
      
      <p>If you have any questions, please contact our support team.</p>
    `;

    return this.sendEmail({
      to: clientEmail,
      subject: `Refund Processed - ₹${data.refundAmount.toFixed(2)}`,
      html,
    });
  }

  /**
   * ============================================================================
   * MESSAGE NOTIFICATIONS (for offline users)
   * ============================================================================
   */

  /**
   * Notify user of new message when offline
   */
  async sendNewMessageNotification(
    recipientEmail: string,
    data: {
      recipientName: string;
      senderName: string;
      messagePreview: string;
      requestId?: string;
    }
  ) {
    const html = `
      <h2>New Message from ${data.senderName}</h2>
      <p>Hello ${data.recipientName},</p>
      <p>You have received a new message from <strong>${data.senderName}</strong>.</p>
      
      <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
        <p style="margin: 0;">${data.messagePreview.substring(0, 200)}${data.messagePreview.length > 200 ? '...' : ''}</p>
      </div>
      
      <p>
        <a href="${process.env.APP_URL}/messages${data.requestId ? `?request=${data.requestId}` : ''}" class="button">
          View Message
        </a>
      </p>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject: `New message from ${data.senderName}`,
      html,
    });
  }

  /**
   * ============================================================================
   * FIRM-RELATED NOTIFICATIONS (existing, updated)
   * ============================================================================
   */

  /**
   * Send firm invitation email
   */
  async sendFirmInvitation(
    recipient: EmailRecipient,
    inviterName: string,
    firmName: string,
    invitationToken: string,
    message?: string
  ) {
    const invitationUrl = `${process.env.APP_URL}/firm-invitations/${invitationToken}`;

    const html = `
      <h2>You're Invited to Join a Firm!</h2>
      <p>Hello ${recipient.name || 'there'},</p>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${firmName}</strong> on CA Marketplace.</p>
      ${message ? `<p style="background: #f5f5f5; padding: 15px; border-left: 4px solid #667eea;"><em>"${message}"</em></p>` : ''}
      <p>
        <a href="${invitationUrl}" class="button">
          Accept Invitation
        </a>
      </p>
      <p><small>This invitation will expire in 7 days.</small></p>
      <p>If you don't want to join this firm, you can simply ignore this email.</p>
    `;

    return this.sendEmail({
      to: recipient.email,
      subject: `Invitation to join ${firmName}`,
      html,
    });
  }

  /**
   * Send firm verification request to admin
   */
  async sendFirmVerificationRequest(
    adminEmails: string[],
    firmName: string,
    firmId: string
  ) {
    const verificationUrl = `${process.env.APP_URL}/admin/firms/${firmId}`;

    const html = `
      <h2>New Firm Verification Request</h2>
      <p>A new firm <strong>${firmName}</strong> has been submitted for verification.</p>
      <p>
        <a href="${verificationUrl}" class="button">
          Review Firm
        </a>
      </p>
      <p>Please review the firm's documents and approve or reject the registration within 7 days.</p>
    `;

    return this.sendEmail({
      to: adminEmails,
      subject: `New Firm Verification Request: ${firmName}`,
      html,
    });
  }

  /**
   * Send firm verification result to members
   */
  async sendFirmVerificationResult(
    memberEmails: EmailRecipient[],
    firmName: string,
    approved: boolean,
    notes?: string
  ) {
    const subject = approved
      ? `${firmName} has been approved!`
      : `${firmName} verification was rejected`;

    const html = approved
      ? `
        <h2>🎉 Firm Approved!</h2>
        <p>Congratulations! Your firm <strong>${firmName}</strong> has been verified and is now active.</p>
        <p>You can now start receiving client requests and managing your firm.</p>
        ${notes ? `<p style="background: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50;"><strong>Admin notes:</strong> ${notes}</p>` : ''}
        <p>
          <a href="${process.env.APP_URL}/firm/dashboard" class="button">
            Go to Firm Dashboard
          </a>
        </p>
      `
      : `
        <h2>Firm Verification Update</h2>
        <p>Unfortunately, your firm <strong>${firmName}</strong> verification was not approved at this time.</p>
        ${notes ? `<p style="background: #ffebee; padding: 15px; border-left: 4px solid #f44336;"><strong>Reason:</strong> ${notes}</p>` : ''}
        <p>Please review the requirements and feel free to resubmit your application after addressing the concerns.</p>
      `;

    return this.sendEmail({
      to: memberEmails.map(m => m.email),
      subject,
      html,
    });
  }

  // Other firm-related methods remain the same...
  // (sendInvitationAccepted, sendInvitationRejected, etc.)
}

// Export singleton instance
export default new EmailNotificationService();
export { EmailNotificationService };
