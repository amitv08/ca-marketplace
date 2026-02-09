/**
 * Email Integration Examples
 *
 * This file shows how to integrate EmailTemplateService into existing routes
 * Copy the relevant code snippets to your actual route files
 */

import { EmailTemplateService } from '../services/email-template.service';

/**
 * EXAMPLE 1: Service Request Accepted
 * File: backend/src/routes/serviceRequest.routes.ts
 * Endpoint: POST /api/service-requests/:id/accept
 */
export async function exampleRequestAccepted() {
  // After CA accepts the request, send email notification
  await EmailTemplateService.sendRequestAccepted({
    clientEmail: 'client@example.com',
    clientName: 'John Doe',
    caName: 'CA Rajesh Kumar',
    caEmail: 'rajesh@example.com',
    caPhone: '+91-9876543210',
    serviceType: 'GST Filing',
    requestId: 'REQ123',
    estimatedAmount: 5000,
    estimatedDays: 5,
    dashboardUrl: `${process.env.FRONTEND_URL}/client/requests/REQ123`,
  });
}

/**
 * EXAMPLE 2: Status Change to IN_PROGRESS
 * File: backend/src/routes/serviceRequest.routes.ts
 * Endpoint: PATCH /api/service-requests/:id/status
 */
export async function exampleStatusInProgress() {
  // After CA starts work, send notification
  await EmailTemplateService.sendStatusInProgress({
    clientEmail: 'client@example.com',
    clientName: 'John Doe',
    caName: 'CA Rajesh Kumar',
    serviceType: 'Income Tax Return',
    requestId: 'REQ456',
    message: 'Started reviewing your documents. Will complete within 3 days.',
    dashboardUrl: `${process.env.FRONTEND_URL}/client/requests/REQ456`,
  });
}

/**
 * EXAMPLE 3: Status Change to COMPLETED
 * File: backend/src/routes/serviceRequest.routes.ts
 * Endpoint: PATCH /api/service-requests/:id/complete
 */
export async function exampleStatusCompleted() {
  // After service completion, send notification
  await EmailTemplateService.sendStatusCompleted({
    clientEmail: 'client@example.com',
    clientName: 'John Doe',
    caName: 'CA Rajesh Kumar',
    serviceType: 'Audit Services',
    requestId: 'REQ789',
    completedDate: new Date(),
    reviewUrl: `${process.env.FRONTEND_URL}/reviews/create?requestId=REQ789`,
    dashboardUrl: `${process.env.FRONTEND_URL}/client/requests/REQ789`,
  });
}

/**
 * EXAMPLE 4: Payment Required
 * File: backend/src/routes/payment.routes.ts
 * Endpoint: POST /api/payments/create-order
 */
export async function examplePaymentRequired() {
  // When payment order is created, send payment request email
  await EmailTemplateService.sendPaymentRequired({
    clientEmail: 'client@example.com',
    clientName: 'John Doe',
    caName: 'CA Rajesh Kumar',
    serviceType: 'GST Filing',
    requestId: 'REQ123',
    amount: 5000,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    paymentUrl: `${process.env.FRONTEND_URL}/payments/ORDER123`,
    invoiceNumber: 'INV-2026-001',
  });
}

/**
 * EXAMPLE 5: Payment Released to CA
 * File: backend/src/routes/escrow.routes.ts or payment.routes.ts
 * Endpoint: POST /api/escrow/release or similar
 */
export async function examplePaymentReleased() {
  // When payment is released from escrow, notify CA
  await EmailTemplateService.sendPaymentReleased({
    caEmail: 'rajesh@example.com',
    caName: 'CA Rajesh Kumar',
    clientName: 'John Doe',
    serviceType: 'Income Tax Return',
    requestId: 'REQ456',
    amount: 7500,
    releasedDate: new Date(),
    expectedTransferDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    transactionId: 'TXN_987654321',
    dashboardUrl: `${process.env.FRONTEND_URL}/ca/earnings`,
  });
}

/**
 * EXAMPLE 6: New Message Notification
 * File: backend/src/routes/message.routes.ts
 * Endpoint: POST /api/messages
 */
export async function exampleNewMessage() {
  // After message is created, notify recipient
  await EmailTemplateService.sendNewMessage({
    recipientEmail: 'recipient@example.com',
    recipientName: 'CA Rajesh Kumar',
    senderName: 'John Doe',
    serviceType: 'GST Filing',
    requestId: 'REQ123',
    messagePreview: 'Hi, I have uploaded all the required documents. Please review and let me know if you need anything else.',
    messageUrl: `${process.env.FRONTEND_URL}/requests/REQ123/messages`,
    hasAttachment: true,
  });
}

/**
 * EXAMPLE 7: CA Verification Approved
 * File: backend/src/routes/admin.routes.ts
 * Endpoint: PATCH /api/admin/cas/:id/verify
 */
export async function exampleVerificationApproved() {
  // When admin approves CA verification
  await EmailTemplateService.sendVerificationApproved({
    caEmail: 'newca@example.com',
    caName: 'CA Priya Sharma',
    approvedDate: new Date(),
    dashboardUrl: `${process.env.FRONTEND_URL}/ca/dashboard`,
    profileUrl: `${process.env.FRONTEND_URL}/cas/CA123`,
  });
}

/**
 * EXAMPLE 8: CA Verification Rejected
 * File: backend/src/routes/admin.routes.ts
 * Endpoint: PATCH /api/admin/cas/:id/verify
 */
export async function exampleVerificationRejected() {
  // When admin rejects CA verification
  await EmailTemplateService.sendVerificationRejected({
    caEmail: 'newca@example.com',
    caName: 'CA Priya Sharma',
    rejectionReasons: [
      'CA membership certificate is not clearly visible',
      'Profile photo is not professional',
      'Missing bank account details',
    ],
    resubmitUrl: `${process.env.FRONTEND_URL}/ca/profile/edit`,
    supportEmail: 'support@camarketplace.com',
  });
}

/**
 * INTEGRATION TEMPLATE for serviceRequest.routes.ts
 *
 * Add this to your existing accept endpoint:
 */
export const integrationTemplate = `
// Import at top of file
import { EmailTemplateService } from '../services/email-template.service';

// In your accept endpoint, after successfully updating the request:
router.post('/:id/accept', authenticate, authorize('CA'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { estimatedAmount, estimatedDays } = req.body;

  // ... existing code to accept request ...

  // ✅ ADD THIS: Send email notification
  await EmailTemplateService.sendRequestAccepted({
    clientEmail: updatedRequest.client.user.email,
    clientName: updatedRequest.client.user.name,
    caName: ca.user.name,
    caEmail: ca.user.email,
    caPhone: ca.user.phone || 'Not provided',
    serviceType: updatedRequest.serviceType,
    requestId: updatedRequest.id,
    estimatedAmount,
    estimatedDays,
    dashboardUrl: \`\${process.env.FRONTEND_URL}/client/requests/\${updatedRequest.id}\`,
  });

  // ... rest of your code ...
}));
`;

/**
 * TESTING EMAILS
 *
 * Use these curl commands to test email templates:
 */
export const testingCommands = `
# 1. List all templates
curl -H "Authorization: Bearer \$ADMIN_TOKEN" \\
  http://localhost:8081/api/email-templates

# 2. Preview request-accepted template
curl -X POST \\
  -H "Authorization: Bearer \$ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template": "request-accepted",
    "context": {
      "clientName": "John Doe",
      "caName": "CA Rajesh Kumar",
      "caEmail": "rajesh@example.com",
      "caPhone": "+91-9876543210",
      "serviceType": "GST Filing",
      "requestId": "REQ123",
      "estimatedAmount": 5000,
      "estimatedDays": 5,
      "dashboardUrl": "http://localhost:3001/client/requests/REQ123"
    }
  }' \\
  http://localhost:8081/api/email-templates/preview

# 3. Send test email
curl -X POST \\
  -H "Authorization: Bearer \$ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template": "request-accepted",
    "to": "your-email@example.com",
    "context": { ... same as above ... }
  }' \\
  http://localhost:8081/api/email-templates/send-test
`;
