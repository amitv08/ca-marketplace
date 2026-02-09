# Email Template System - Integration Guide

## Overview

Complete email notification system using **Nodemailer** + **Handlebars** templates for 6 critical flows.

---

## ✅ What Was Implemented

### **Backend Services**

1. **Email Template Service** (`backend/src/services/email-template.service.ts`)
   - Handlebars template engine integration
   - Nodemailer SMTP configuration
   - 8 pre-built email methods
   - Template caching for performance
   - Custom Handlebars helpers (currency, date formatting, status colors)

2. **Email Templates** (`backend/src/templates/emails/`)
   - `_layout.hbs` - Base layout with responsive design
   - `request-accepted.hbs` - CA accepts service request
   - `status-in-progress.hbs` - Work started notification
   - `status-completed.hbs` - Service completed
   - `payment-required.hbs` - Payment request
   - `payment-released.hbs` - Payment released to CA
   - `new-message.hbs` - Message notification
   - `verification-approved.hbs` - CA verification approved
   - `verification-rejected.hbs` - CA verification rejected

3. **Email Template Routes** (`backend/src/routes/email-template.routes.ts`)
   - `GET /api/email-templates` - List templates
   - `POST /api/email-templates/preview` - Preview with sample data
   - `POST /api/email-templates/send-test` - Send test email
   - `POST /api/email-templates/clear-cache` - Clear template cache

---

## 🔧 Configuration

### **Environment Variables**

Add to `backend/.env`:

```bash
# SMTP Configuration (for production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=CA Marketplace <noreply@camarketplace.com>

# Development mode (emails will be logged, not sent)
NODE_ENV=development
```

### **Gmail Setup** (if using Gmail)

1. Enable 2-Factor Authentication
2. Generate App Password:
   - Google Account → Security → 2-Step Verification → App passwords
   - Select "Mail" and device
   - Copy 16-character password
3. Use app password in `SMTP_PASS`

### **Other SMTP Providers**

**SendGrid:**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**AWS SES:**
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-aws-access-key-id
SMTP_PASS=your-aws-secret-access-key
```

**Mailgun:**
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASS=your-mailgun-password
```

---

## 📧 Integration Points

### **1. Service Request Routes**

Add to `backend/src/routes/serviceRequest.routes.ts`:

```typescript
import { EmailTemplateService } from '../services/email-template.service';

// When CA accepts request (in accept endpoint)
router.post('/:id/accept', authenticate, authorize('CA'), asyncHandler(async (req: Request, res: Response) => {
  // ... existing acceptance logic ...

  // Send email notification
  await EmailTemplateService.sendRequestAccepted({
    clientEmail: request.client.user.email,
    clientName: request.client.user.name,
    caName: ca.user.name,
    caEmail: ca.user.email,
    caPhone: ca.user.phone || 'Not provided',
    serviceType: request.serviceType,
    requestId: request.id,
    estimatedAmount: req.body.estimatedAmount,
    estimatedDays: req.body.estimatedDays,
    dashboardUrl: `${process.env.FRONTEND_URL}/client/requests/${request.id}`,
  });

  // ... rest of code ...
}));

// When status changes to IN_PROGRESS
router.patch('/:id/status', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { status, message } = req.body;

  // ... update status ...

  if (status === 'IN_PROGRESS') {
    await EmailTemplateService.sendStatusInProgress({
      clientEmail: request.client.user.email,
      clientName: request.client.user.name,
      caName: request.ca.user.name,
      serviceType: request.serviceType,
      requestId: request.id,
      message,
      dashboardUrl: `${process.env.FRONTEND_URL}/client/requests/${request.id}`,
    });
  }

  if (status === 'COMPLETED') {
    await EmailTemplateService.sendStatusCompleted({
      clientEmail: request.client.user.email,
      clientName: request.client.user.name,
      caName: request.ca.user.name,
      serviceType: request.serviceType,
      requestId: request.id,
      completedDate: new Date(),
      reviewUrl: `${process.env.FRONTEND_URL}/reviews/create?requestId=${request.id}`,
      dashboardUrl: `${process.env.FRONTEND_URL}/client/requests/${request.id}`,
    });
  }

  // ... rest of code ...
}));
```

### **2. Payment Routes**

Add to `backend/src/routes/payment.routes.ts`:

```typescript
import { EmailTemplateService } from '../services/email-template.service';

// When payment is required
router.post('/create-order', authenticate, authorize('CLIENT'), asyncHandler(async (req: Request, res: Response) => {
  // ... create payment order ...

  await EmailTemplateService.sendPaymentRequired({
    clientEmail: client.user.email,
    clientName: client.user.name,
    caName: request.ca.user.name,
    serviceType: request.serviceType,
    requestId: request.id,
    amount: order.amount / 100, // Convert from paise to rupees
    paymentUrl: `${process.env.FRONTEND_URL}/payments/${order.id}`,
    invoiceNumber: order.receipt,
  });

  // ... rest of code ...
}));

// When payment is released to CA
router.post('/release', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  // ... release payment from escrow ...

  await EmailTemplateService.sendPaymentReleased({
    caEmail: ca.user.email,
    caName: ca.user.name,
    clientName: payment.client.user.name,
    serviceType: payment.request.serviceType,
    requestId: payment.requestId,
    amount: payment.amount,
    releasedDate: new Date(),
    expectedTransferDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    transactionId: payment.razorpayPaymentId,
    dashboardUrl: `${process.env.FRONTEND_URL}/ca/earnings`,
  });

  // ... rest of code ...
}));
```

### **3. Message Routes**

Add to `backend/src/routes/message.routes.ts`:

```typescript
import { EmailTemplateService } from '../services/email-template.service';

// When new message is sent
router.post('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  // ... create message ...

  // Determine recipient
  const recipientIsCA = message.request.caId === req.user!.userId;
  const recipientEmail = recipientIsCA
    ? message.request.ca.user.email
    : message.request.client.user.email;
  const recipientName = recipientIsCA
    ? message.request.ca.user.name
    : message.request.client.user.name;
  const senderName = req.user!.name;

  // Send email notification
  await EmailTemplateService.sendNewMessage({
    recipientEmail,
    recipientName,
    senderName,
    serviceType: message.request.serviceType,
    requestId: message.requestId,
    messagePreview: message.content.substring(0, 150) + (message.content.length > 150 ? '...' : ''),
    messageUrl: `${process.env.FRONTEND_URL}/requests/${message.requestId}/messages`,
    hasAttachment: message.attachments && message.attachments.length > 0,
  });

  // ... rest of code ...
}));
```

### **4. Admin CA Verification**

Add to `backend/src/routes/admin.routes.ts`:

```typescript
import { EmailTemplateService } from '../services/email-template.service';

// When CA is verified
router.patch('/cas/:id/verify', authenticate, authorize('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { verificationStatus, rejectionReasons } = req.body;

  // ... update CA verification status ...

  if (verificationStatus === 'VERIFIED') {
    await EmailTemplateService.sendVerificationApproved({
      caEmail: ca.user.email,
      caName: ca.user.name,
      approvedDate: new Date(),
      dashboardUrl: `${process.env.FRONTEND_URL}/ca/dashboard`,
      profileUrl: `${process.env.FRONTEND_URL}/cas/${ca.id}`,
    });
  }

  if (verificationStatus === 'REJECTED') {
    await EmailTemplateService.sendVerificationRejected({
      caEmail: ca.user.email,
      caName: ca.user.name,
      rejectionReasons: rejectionReasons || ['Profile information incomplete'],
      resubmitUrl: `${process.env.FRONTEND_URL}/ca/profile/edit`,
      supportEmail: 'support@camarketplace.com',
    });
  }

  // ... rest of code ...
}));
```

---

## 🎨 Custom Email Templates

### **Handlebars Helpers Available**

```handlebars
<!-- Format currency -->
{{currency 5000}}  <!-- Output: ₹5,000.00 -->

<!-- Format date -->
{{formatDate completedDate}}  <!-- Output: February 6, 2026 -->

<!-- Format time -->
{{formatTime messageDate}}  <!-- Output: 02:30 PM -->

<!-- Status badge color -->
<span style="background-color: {{statusColor 'COMPLETED'}};">COMPLETED</span>

<!-- Conditional -->
{{#ifEquals status 'COMPLETED'}}
  Service is complete!
{{/ifEquals}}

<!-- Iteration -->
{{#each rejectionReasons}}
  <li>{{this}}</li>
{{/each}}
```

### **Creating New Templates**

1. Create `.hbs` file in `backend/src/templates/emails/`
2. Use base layout structure:

```handlebars
<div class="email-container">
  <div class="email-header">
    <h1>Your Title</h1>
    <p>Subtitle</p>
  </div>

  <div class="email-body">
    <div class="greeting">Hi {{userName}},</div>

    <div class="content">
      <p>Your content here...</p>
    </div>

    <div class="info-box">
      <!-- Key-value pairs -->
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{actionUrl}}" class="btn">Call to Action</a>
    </div>
  </div>

  <div class="email-footer">
    <!-- Standard footer -->
  </div>
</div>
```

3. Add method to `EmailTemplateService`:

```typescript
static async sendYourNewEmail(data: {
  userEmail: string;
  userName: string;
  // ... other fields
}): Promise<boolean> {
  return this.sendEmail({
    to: data.userEmail,
    subject: 'Your Subject',
    template: 'your-template-name',
    context: data,
  });
}
```

---

## 🧪 Testing

### **Test in Development Mode**

When `NODE_ENV !== 'production'`, emails are logged to console:

```bash
docker-compose logs -f backend

# You'll see:
# --- EMAIL PREVIEW ---
# To: client@example.com
# Subject: Your Service Request Has Been Accepted
# Template: request-accepted
# --- END EMAIL PREVIEW ---
```

### **Preview Templates (Admin API)**

```bash
# List all templates
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8081/api/email-templates

# Preview template with sample data
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
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
  }' \
  http://localhost:8081/api/email-templates/preview

# Send test email
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template": "request-accepted",
    "to": "your-email@example.com",
    "context": { ... }
  }' \
  http://localhost:8081/api/email-templates/send-test
```

### **Production Testing**

1. Set up SMTP credentials in `.env`
2. Set `NODE_ENV=production`
3. Restart backend
4. Trigger actual email flows

---

## 🎨 Admin UI Component

Create `frontend/src/pages/admin/EmailTemplateManager.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { Card, Button, Loading } from '../../components/common';
import api from '../../services/api';

const EmailTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(false);

  // Sample context data for each template
  const sampleData: Record<string, any> = {
    'request-accepted': {
      clientName: 'John Doe',
      caName: 'CA Rajesh Kumar',
      caEmail: 'rajesh@example.com',
      caPhone: '+91-9876543210',
      serviceType: 'GST Filing',
      requestId: 'REQ123',
      estimatedAmount: 5000,
      estimatedDays: 5,
      dashboardUrl: 'http://localhost:3001/client/requests/REQ123',
    },
    'payment-required': {
      clientName: 'John Doe',
      caName: 'CA Rajesh Kumar',
      serviceType: 'Income Tax Return',
      requestId: 'REQ456',
      amount: 7500,
      paymentUrl: 'http://localhost:3001/payments/PAY789',
      invoiceNumber: 'INV-2026-001',
    },
    // Add more sample data...
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/email-templates');
      setTemplates(response.data.data.templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const previewTemplate = async (templateName: string) => {
    setLoading(true);
    try {
      const response = await api.post('/email-templates/preview', {
        template: templateName,
        context: sampleData[templateName] || {},
      });
      setPreviewHtml(response.data.data.html);
    } catch (error) {
      console.error('Error previewing template:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Email Template Manager</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Template List */}
        <Card className="lg:col-span-1">
          <h2 className="text-lg font-semibold mb-4">Available Templates</h2>
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template}
                onClick={() => {
                  setSelectedTemplate(template);
                  previewTemplate(template);
                }}
                className={`w-full text-left px-3 py-2 rounded ${
                  selectedTemplate === template
                    ? 'bg-blue-100 text-blue-800'
                    : 'hover:bg-gray-100'
                }`}
              >
                {template}
              </button>
            ))}
          </div>
        </Card>

        {/* Preview */}
        <Card className="lg:col-span-3">
          <h2 className="text-lg font-semibold mb-4">
            Preview: {selectedTemplate || 'Select a template'}
          </h2>

          {loading ? (
            <Loading text="Loading preview..." />
          ) : previewHtml ? (
            <div className="border rounded-lg p-4 bg-gray-50">
              <iframe
                srcDoc={previewHtml}
                style={{ width: '100%', height: '600px', border: 'none' }}
                title="Email Preview"
              />
            </div>
          ) : (
            <p className="text-gray-500">Select a template to preview</p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default EmailTemplateManager;
```

---

## 📝 Files Created

### Backend
1. `backend/src/services/email-template.service.ts` (440 lines)
2. `backend/src/routes/email-template.routes.ts` (90 lines)
3. `backend/src/templates/emails/_layout.hbs` (base layout)
4. `backend/src/templates/emails/request-accepted.hbs`
5. `backend/src/templates/emails/status-in-progress.hbs`
6. `backend/src/templates/emails/status-completed.hbs`
7. `backend/src/templates/emails/payment-required.hbs`
8. `backend/src/templates/emails/payment-released.hbs`
9. `backend/src/templates/emails/new-message.hbs`
10. `backend/src/templates/emails/verification-approved.hbs`
11. `backend/src/templates/emails/verification-rejected.hbs`

### Frontend (Optional)
12. `frontend/src/pages/admin/EmailTemplateManager.tsx` (sample)

---

## ✨ Features

✅ **8 Pre-built Templates** - Ready to use email templates
✅ **Handlebars Engine** - Dynamic content with helpers
✅ **Responsive Design** - Mobile-friendly emails
✅ **SMTP Integration** - Works with any SMTP provider
✅ **Template Caching** - Performance optimization
✅ **Dev Mode** - Email logging for development
✅ **Admin Preview** - Preview templates before sending
✅ **Test Emails** - Send test emails with sample data
✅ **Professional Design** - Gradient headers, clean layout
✅ **Type-Safe** - Full TypeScript support

---

## 🚀 Deployment Steps

1. **Install Handlebars** ✅ (Already done)
   ```bash
   npm install handlebars @types/handlebars
   ```

2. **Configure SMTP**
   - Update `.env` with SMTP credentials
   - Test in development first

3. **Register Routes**
   Add to `backend/src/routes/index.ts`:
   ```typescript
   import emailTemplateRoutes from './email-template.routes';
   app.use('/api/email-templates', emailTemplateRoutes);
   ```

4. **Integrate Email Sending**
   - Add email calls to service request routes
   - Add email calls to payment routes
   - Add email calls to message routes
   - Add email calls to admin verification routes

5. **Test in Development**
   - Verify emails are logged
   - Preview templates via admin API
   - Send test emails

6. **Deploy to Production**
   - Set `NODE_ENV=production`
   - Configure production SMTP
   - Monitor email delivery

---

**Created:** 2026-02-06
**Status:** Ready for Integration ✅
**Templates:** 8 complete email flows
**Next Step:** Integrate into existing routes
