import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import { LoggerService } from './logger.service';

/**
 * Email Template Service
 * Uses Handlebars for email templates and Nodemailer for sending
 */

interface EmailOptions {
  to: string | string[];
  subject: string;
  template: string;
  context: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from: string;
}

export class EmailTemplateService {
  private static transporter: nodemailer.Transporter | null = null;
  private static templateCache: Map<string, handlebars.TemplateDelegate> = new Map();
  private static config: EmailConfig;

  /**
   * Initialize email service
   */
  static initialize() {
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
      from: process.env.EMAIL_FROM || 'CA Marketplace <noreply@camarketplace.com>',
    };

    // Create Nodemailer transporter
    if (process.env.NODE_ENV === 'production' && this.config.auth) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
      });

      LoggerService.info('Email transporter initialized', {
        host: this.config.host,
        port: this.config.port,
      });
    } else {
      LoggerService.info('Email transporter running in development mode (emails will be logged)');
    }

    // Register Handlebars helpers
    this.registerHelpers();
  }

  /**
   * Register Handlebars helpers
   */
  private static registerHelpers() {
    // Format currency helper
    handlebars.registerHelper('currency', (amount: number) => {
      return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });

    // Format date helper
    handlebars.registerHelper('formatDate', (date: Date | string) => {
      const d = new Date(date);
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Format time helper
    handlebars.registerHelper('formatTime', (date: Date | string) => {
      const d = new Date(date);
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    });

    // Conditional helper
    handlebars.registerHelper('ifEquals', function(this: any, arg1: any, arg2: any, options: any) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    // Status badge color helper
    handlebars.registerHelper('statusColor', (status: string) => {
      const colors: Record<string, string> = {
        PENDING: '#FFA500',
        ACCEPTED: '#4CAF50',
        IN_PROGRESS: '#2196F3',
        COMPLETED: '#4CAF50',
        CANCELLED: '#F44336',
        REJECTED: '#F44336',
      };
      return colors[status] || '#9E9E9E';
    });
  }

  /**
   * Load and compile template
   */
  private static async loadTemplate(templateName: string): Promise<handlebars.TemplateDelegate> {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    // Load template from file
    const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.hbs`);

    try {
      const templateSource = fs.readFileSync(templatePath, 'utf-8');
      const template = handlebars.compile(templateSource);

      // Cache the compiled template
      this.templateCache.set(templateName, template);

      return template;
    } catch (error: any) {
      LoggerService.error('Failed to load email template', error, { templateName });
      throw new Error(`Email template not found: ${templateName}`);
    }
  }

  /**
   * Send email using template
   */
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Load and compile template
      const template = await this.loadTemplate(options.template);

      // Render HTML with context
      const html = template(options.context);

      // In development, just log the email
      if (process.env.NODE_ENV !== 'production' || !this.transporter) {
        LoggerService.info('Email would be sent (dev mode)', {
          to: options.to,
          subject: options.subject,
          template: options.template,
          context: options.context,
        });
        console.log('\n--- EMAIL PREVIEW ---');
        console.log(`To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Template: ${options.template}`);
        console.log('--- END EMAIL PREVIEW ---\n');
        return true;
      }

      // Send email
      const info = await this.transporter!.sendMail({
        from: this.config.from,
        to: options.to,
        subject: options.subject,
        html,
        attachments: options.attachments,
      });

      LoggerService.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      });

      return true;
    } catch (error: any) {
      LoggerService.error('Failed to send email', error, {
        to: options.to,
        subject: options.subject,
        template: options.template,
      });
      return false;
    }
  }

  /**
   * 1. Request Accepted by CA
   */
  static async sendRequestAccepted(data: {
    clientEmail: string;
    clientName: string;
    caName: string;
    caEmail: string;
    caPhone: string;
    serviceType: string;
    requestId: string;
    estimatedAmount?: number;
    estimatedDays?: number;
    dashboardUrl: string;
  }): Promise<boolean> {
    return this.sendEmail({
      to: data.clientEmail,
      subject: `Your Service Request Has Been Accepted - ${data.serviceType}`,
      template: 'request-accepted',
      context: data,
    });
  }

  /**
   * 2. Status Change: IN_PROGRESS
   */
  static async sendStatusInProgress(data: {
    clientEmail: string;
    clientName: string;
    caName: string;
    serviceType: string;
    requestId: string;
    message?: string;
    dashboardUrl: string;
  }): Promise<boolean> {
    return this.sendEmail({
      to: data.clientEmail,
      subject: `Work Started on Your Request - ${data.serviceType}`,
      template: 'status-in-progress',
      context: data,
    });
  }

  /**
   * 3. Status Change: COMPLETED
   */
  static async sendStatusCompleted(data: {
    clientEmail: string;
    clientName: string;
    caName: string;
    serviceType: string;
    requestId: string;
    completedDate: Date;
    reviewUrl: string;
    dashboardUrl: string;
  }): Promise<boolean> {
    return this.sendEmail({
      to: data.clientEmail,
      subject: `Service Request Completed - ${data.serviceType}`,
      template: 'status-completed',
      context: data,
    });
  }

  /**
   * 4. Payment Required
   */
  static async sendPaymentRequired(data: {
    clientEmail: string;
    clientName: string;
    caName: string;
    serviceType: string;
    requestId: string;
    amount: number;
    dueDate?: Date;
    paymentUrl: string;
    invoiceNumber?: string;
  }): Promise<boolean> {
    return this.sendEmail({
      to: data.clientEmail,
      subject: `Payment Required - ₹${data.amount.toLocaleString('en-IN')}`,
      template: 'payment-required',
      context: data,
    });
  }

  /**
   * 5. Payment Released to CA
   */
  static async sendPaymentReleased(data: {
    caEmail: string;
    caName: string;
    clientName: string;
    serviceType: string;
    requestId: string;
    amount: number;
    releasedDate: Date;
    expectedTransferDate: Date;
    transactionId: string;
    dashboardUrl: string;
  }): Promise<boolean> {
    return this.sendEmail({
      to: data.caEmail,
      subject: `Payment Released - ₹${data.amount.toLocaleString('en-IN')}`,
      template: 'payment-released',
      context: data,
    });
  }

  /**
   * 6. New Message Notification
   */
  static async sendNewMessage(data: {
    recipientEmail: string;
    recipientName: string;
    senderName: string;
    serviceType: string;
    requestId: string;
    messagePreview: string;
    messageUrl: string;
    hasAttachment: boolean;
  }): Promise<boolean> {
    return this.sendEmail({
      to: data.recipientEmail,
      subject: `New Message from ${data.senderName}`,
      template: 'new-message',
      context: data,
    });
  }

  /**
   * 7. CA Verification Approved
   */
  static async sendVerificationApproved(data: {
    caEmail: string;
    caName: string;
    approvedDate: Date;
    dashboardUrl: string;
    profileUrl: string;
  }): Promise<boolean> {
    return this.sendEmail({
      to: data.caEmail,
      subject: 'Congratulations! Your CA Profile Has Been Verified',
      template: 'verification-approved',
      context: data,
    });
  }

  /**
   * 8. CA Verification Rejected
   */
  static async sendVerificationRejected(data: {
    caEmail: string;
    caName: string;
    rejectionReasons: string[];
    resubmitUrl: string;
    supportEmail: string;
  }): Promise<boolean> {
    return this.sendEmail({
      to: data.caEmail,
      subject: 'Action Required: CA Verification Update',
      template: 'verification-rejected',
      context: data,
    });
  }

  /**
   * Clear template cache (useful for development)
   */
  static clearTemplateCache(): void {
    this.templateCache.clear();
    LoggerService.info('Email template cache cleared');
  }

  /**
   * Get list of available templates
   */
  static getAvailableTemplates(): string[] {
    const templatesDir = path.join(__dirname, '../templates/emails');
    try {
      return fs.readdirSync(templatesDir)
        .filter(file => file.endsWith('.hbs'))
        .map(file => file.replace('.hbs', ''));
    } catch (error) {
      return [];
    }
  }

  /**
   * Preview template with sample data
   */
  static async previewTemplate(templateName: string, context: Record<string, any>): Promise<string> {
    const template = await this.loadTemplate(templateName);
    return template(context);
  }
}

// Initialize service on import
EmailTemplateService.initialize();
