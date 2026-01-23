/**
 * Email Notification Service
 *
 * TODO: Implement actual email sending functionality using:
 * - Nodemailer with SMTP
 * - SendGrid
 * - AWS SES
 * - Or other email service provider
 *
 * For now, this logs email notifications to console
 */

interface EmailRecipient {
  email: string;
  name?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export class EmailNotificationService {
  /**
   * Send firm invitation email
   */
  static async sendFirmInvitation(
    recipient: EmailRecipient,
    inviterName: string,
    firmName: string,
    invitationToken: string,
    message?: string
  ) {
    const invitationUrl = `${process.env.FRONTEND_URL}/firm-invitations/${invitationToken}`;

    const emailData = {
      to: recipient.email,
      subject: `You've been invited to join ${firmName}`,
      html: `
        <h2>Firm Invitation</h2>
        <p>Hello ${recipient.name || 'there'},</p>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${firmName}</strong> on CA Marketplace.</p>
        ${message ? `<p><em>Message from inviter:</em> ${message}</p>` : ''}
        <p>
          <a href="${invitationUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Accept Invitation
          </a>
        </p>
        <p>This invitation will expire in 7 days.</p>
        <p>If you don't want to join this firm, you can simply ignore this email.</p>
      `,
    };

    // TODO: Replace with actual email sending
    console.log('📧 [EMAIL] Firm Invitation:', emailData);

    return { sent: true, messageId: 'mock-' + Date.now() };
  }

  /**
   * Send firm verification request to admin
   */
  static async sendFirmVerificationRequest(
    adminEmails: string[],
    firmName: string,
    firmId: string
  ) {
    const verificationUrl = `${process.env.FRONTEND_URL}/admin/firms/${firmId}`;

    const emailData = {
      to: adminEmails,
      subject: `New Firm Verification Request: ${firmName}`,
      html: `
        <h2>New Firm Verification Request</h2>
        <p>A new firm <strong>${firmName}</strong> has been submitted for verification.</p>
        <p>
          <a href="${verificationUrl}" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Review Firm
          </a>
        </p>
        <p>Please review the firm's documents and approve or reject the registration.</p>
      `,
    };

    // TODO: Replace with actual email sending
    console.log('📧 [EMAIL] Firm Verification Request:', emailData);

    return { sent: true, messageId: 'mock-' + Date.now() };
  }

  /**
   * Send firm verification result to members
   */
  static async sendFirmVerificationResult(
    memberEmails: EmailRecipient[],
    firmName: string,
    approved: boolean,
    notes?: string
  ) {
    const subject = approved
      ? `${firmName} has been approved!`
      : `${firmName} verification was rejected`;

    const emailData = {
      to: memberEmails.map(m => m.email),
      subject,
      html: approved
        ? `
          <h2>Firm Approved!</h2>
          <p>Congratulations! Your firm <strong>${firmName}</strong> has been verified and is now active.</p>
          <p>You can now start receiving client requests and managing your firm.</p>
          ${notes ? `<p><em>Admin notes:</em> ${notes}</p>` : ''}
        `
        : `
          <h2>Firm Verification Rejected</h2>
          <p>Unfortunately, your firm <strong>${firmName}</strong> verification was rejected.</p>
          ${notes ? `<p><strong>Reason:</strong> ${notes}</p>` : ''}
          <p>Please review the requirements and resubmit your application.</p>
        `,
    };

    // TODO: Replace with actual email sending
    console.log('📧 [EMAIL] Firm Verification Result:', emailData);

    return { sent: true, messageId: 'mock-' + Date.now() };
  }

  /**
   * Send invitation acceptance notification to firm admin
   */
  static async sendInvitationAccepted(
    adminEmail: EmailRecipient,
    caName: string,
    firmName: string
  ) {
    const emailData = {
      to: adminEmail.email,
      subject: `${caName} accepted your invitation`,
      html: `
        <h2>Invitation Accepted</h2>
        <p><strong>${caName}</strong> has accepted your invitation to join <strong>${firmName}</strong>.</p>
        <p>They are now a member of your firm.</p>
      `,
    };

    // TODO: Replace with actual email sending
    console.log('📧 [EMAIL] Invitation Accepted:', emailData);

    return { sent: true, messageId: 'mock-' + Date.now() };
  }

  /**
   * Send invitation rejection notification to firm admin
   */
  static async sendInvitationRejected(
    adminEmail: EmailRecipient,
    caName: string,
    firmName: string
  ) {
    const emailData = {
      to: adminEmail.email,
      subject: `${caName} declined your invitation`,
      html: `
        <h2>Invitation Declined</h2>
        <p><strong>${caName}</strong> has declined your invitation to join <strong>${firmName}</strong>.</p>
      `,
    };

    // TODO: Replace with actual email sending
    console.log('📧 [EMAIL] Invitation Rejected:', emailData);

    return { sent: true, messageId: 'mock-' + Date.now() };
  }

  /**
   * Send escalation alert for pending verification >7 days
   */
  static async sendVerificationEscalation(
    adminEmails: string[],
    firmName: string,
    firmId: string,
    daysPending: number
  ) {
    const verificationUrl = `${process.env.FRONTEND_URL}/admin/firms/${firmId}`;

    const emailData = {
      to: adminEmails,
      subject: `URGENT: Firm verification pending for ${daysPending} days`,
      html: `
        <h2 style="color: #F44336;">Verification Escalation</h2>
        <p>The firm <strong>${firmName}</strong> has been pending verification for <strong>${daysPending} days</strong>.</p>
        <p>Our SLA is 7 days. Please review immediately.</p>
        <p>
          <a href="${verificationUrl}" style="background-color: #F44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Review Now
          </a>
        </p>
      `,
    };

    // TODO: Replace with actual email sending
    console.log('📧 [EMAIL] Verification Escalation:', emailData);

    return { sent: true, messageId: 'mock-' + Date.now() };
  }

  /**
   * Generic email sender for templates
   */
  static async sendEmail(params: {
    to: string;
    subject: string;
    template: string;
    data: any;
  }) {
    const templates: { [key: string]: (data: any) => { subject: string; html: string } } = {
      'request-assigned-to-client': (data) => ({
        subject: 'Your Service Request Has Been Assigned',
        html: `
          <h2>Request Assigned</h2>
          <p>Hello ${data.clientName},</p>
          <p>Your service request has been assigned to <strong>${data.caName}</strong> from <strong>${data.firmName}</strong>.</p>
          <p>Assignment method: <strong>${data.method === 'AUTO' ? 'Automatic' : 'Manual'}</strong></p>
          <p>You can contact your CA at: ${data.caEmail}</p>
          <p>Request ID: ${data.requestId}</p>
        `,
      }),
      'request-assigned-to-ca': (data) => ({
        subject: 'New Service Request Assigned to You',
        html: `
          <h2>New Assignment</h2>
          <p>Hello ${data.caName},</p>
          <p>A new service request from <strong>${data.clientName}</strong> has been assigned to you.</p>
          <p>Firm: <strong>${data.firmName}</strong></p>
          <p>Assignment method: <strong>${data.method === 'AUTO' ? 'Automatic' : 'Manual'}</strong></p>
          <p>Request ID: ${data.requestId}</p>
          <p>Please review and respond to the client as soon as possible.</p>
        `,
      }),
      'manual-assignment-required': (data) => ({
        subject: `Manual Assignment Required - ${data.firmName}`,
        html: `
          <h2>Manual Assignment Required</h2>
          <p>Hello ${data.adminName},</p>
          <p>A service request requires manual assignment for <strong>${data.firmName}</strong>.</p>
          <p>Request ID: ${data.requestId}</p>
          <p>Reason: ${data.reason}</p>
          <p>Please log in to the platform to manually assign this request to an available CA.</p>
          <p>
            <a href="${process.env.FRONTEND_URL}/firm/assignments/${data.requestId}" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Assign Request
            </a>
          </p>
        `,
      }),
    };

    const templateFn = templates[params.template];
    if (!templateFn) {
      console.warn(`⚠️  Unknown email template: ${params.template}`);
      return { sent: false };
    }

    const { subject, html } = templateFn(params.data);

    const emailData = {
      to: params.to,
      subject,
      html,
    };

    // TODO: Replace with actual email sending
    console.log(`📧 [EMAIL] ${params.template}:`, emailData);

    return { sent: true, messageId: 'mock-' + Date.now() };
  }
}

export default EmailNotificationService;
