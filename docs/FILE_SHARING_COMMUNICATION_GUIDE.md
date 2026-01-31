# File Sharing & Communication Guide

**Date**: 2026-01-31
**Audience**: Clients, CAs, and Firm Members

---

## Quick Answer to Your Questions

### ✅ Can clients send files to CA/CA Firms?
**YES!** Clients can send files through the messaging system.

### ✅ What file types can be uploaded?
- **Documents**: PDF, Word (.doc, .docx), Excel (.xls, .xlsx), Text (.txt)
- **Images**: JPEG, PNG, GIF, WebP

### ✅ What are the file size limits?
- **Documents**: 10 MB per file, up to 10 files
- **Images**: 5 MB per file, up to 5 files
- **Profile Images**: 2 MB per file

### ✅ How does CA communicate document requirements?
- **In-app messaging** (real-time)
- **Email notifications** (if user offline)

### ✅ How does CA acknowledge receipt?
- **Reply message** confirming receipt
- **Read receipts** show when message is seen

### ✅ Is communication kept open until transaction completion?
**YES!** Communication channel remains open throughout the entire lifecycle:
- Request creation → CA acceptance → Document exchange → Service completion → Payment → Post-payment support

---

## 📋 Complete Communication Flow

### **Step-by-Step Example**

#### 1. **Client Creates Service Request**
```
Client: Creates "GST Filing" request for CA Rajesh Kumar
```

#### 2. **CA Receives Notification**
- 🔔 Real-time in-app notification
- 📧 Email notification
- 📱 Dashboard shows new request

#### 3. **CA Accepts & Requests Documents**
```
CA Message:
"Hi! I've accepted your GST filing request. To proceed, I need:

📄 Required Documents:
1. PAN Card copy
2. GSTIN Certificate
3. Purchase Register (last quarter)
4. Sales Register (last quarter)
5. Previous GST Returns (if filed)

Please upload these documents at your earliest convenience."
```

**Client receives**:
- Real-time notification (if online)
- Email notification (if offline)

#### 4. **Client Uploads Documents**
```
Client attaches files via message:
"Here are the documents you requested."
[Attached: PAN_Card.pdf, GSTIN_Certificate.pdf, Purchase_Register.xlsx]
```

#### 5. **CA Acknowledges Receipt**
```
CA Message:
"✓ Documents received!

I've reviewed:
- ✓ PAN Card - Verified
- ✓ GSTIN Certificate - Verified
- ✓ Purchase Register - Verified

I still need the Sales Register. Could you upload that as well?"
```

#### 6. **Client Uploads Missing Document**
```
Client: [Attached: Sales_Register.xlsx]
"Here's the sales register. Sorry for the delay!"
```

#### 7. **CA Confirms All Documents Received**
```
CA Message:
"✓ All documents received and verified!

I'll start processing your GST return. Expected completion: 2-3 business days.
I'll keep you updated on the progress."
```

#### 8. **Work in Progress - Updates**
```
Day 2:
CA: "Update: 60% complete. Found a small discrepancy in Purchase Register row 45. Can you verify the amount?"

Client: "Checked. The amount should be ₹25,000 not ₹2,500. It was a typo."

CA: "✓ Corrected. Thanks!"
```

#### 9. **Work Completed**
```
CA: "✓ Your GST return has been filed successfully!

Return Reference Number: ARN123456789
Filing Date: 31-Jan-2026

You'll receive the payment link via email. After payment, you can download the acknowledgment copy."
```

**Client receives**:
- In-app notification
- Email with payment link

#### 10. **Client Makes Payment**
```
Client pays ₹2,500

CA receives notification:
"Payment received for your completed service!"
```

#### 11. **Post-Payment Support**
```
3 days later:
Client: "Hi, I can't find the acknowledgment copy. Can you resend?"

CA: [Attached: GST_Acknowledgment.pdf]
"Here you go! Let me know if you need anything else."
```

**Communication stays open even after payment!**

---

## 💬 Using the Messaging System

### **For Clients**

#### **Sending a Message**
```
1. Go to Service Request Details
2. Click "Send Message" or scroll to Messages section
3. Type your message
4. (Optional) Click "Attach File" to upload documents
5. Click "Send"
```

#### **Uploading Documents**
```
1. In message compose box, click "Attach File" 📎
2. Select file from computer
3. Supported: PDF, Word, Excel, Images
4. Max size: 10 MB per file
5. Write a message describing the documents
6. Click "Send"
```

#### **Tracking Messages**
- ✓ Single checkmark = Sent
- ✓✓ Double checkmark = Delivered
- ✓✓ Blue checkmarks = Read by CA

### **For CAs**

#### **Requesting Documents**
```
Best Practice Template:

"Hi [Client Name],

To proceed with [Service Type], I need:

📄 Required Documents:
1. [Document name] - [Purpose]
2. [Document name] - [Purpose]
3. [Document name] - [Purpose]

📋 Optional (if available):
- [Document name] - [Purpose]

Please upload these through the messaging system.
Let me know if you have any questions!

Thanks,
[Your Name]"
```

#### **Acknowledging Receipt**
```
Best Practice Template:

"✓ Documents Received

Reviewed Documents:
- ✓ [Document name] - Verified
- ✓ [Document name] - Verified
- ⚠️ [Document name] - Issue: [Description]

Next Steps:
[What you'll do next]

Estimated Completion: [Date]

I'll keep you updated!"
```

---

## 📁 File Upload Guidelines

### **What to Upload**

#### **For GST Filing**:
- PAN Card
- GSTIN Certificate
- Purchase/Sales Registers
- Input Tax Credit details
- Previous returns (if applicable)

#### **For Income Tax Returns**:
- PAN Card
- Aadhaar Card
- Form 16 (if salaried)
- Bank statements
- Investment proofs
- Previous year's ITR acknowledgment

#### **For Company Audit**:
- Financial statements
- Bank statements
- Tax documents
- Invoices and receipts
- Previous audit reports

### **File Naming Best Practices**

❌ **Bad**: `IMG_1234.jpg`, `scan.pdf`, `document.docx`

✅ **Good**:
- `PAN_Card_Rajesh_Kumar.pdf`
- `GST_Purchase_Register_Q4_2025.xlsx`
- `Bank_Statement_Jan_2026.pdf`

---

## 🔒 Security & Privacy

### **Your Files Are Protected**

✅ **Encryption**: Files encrypted in transit and at rest
✅ **Access Control**: Only request participants can see files
✅ **File Validation**: Type and size checks
✅ **Signature Verification**: Fake file detection
✅ **Virus Scanning**: All files scanned (when activated)
✅ **Secure Storage**: Files stored securely on server
✅ **Audit Trail**: All uploads logged

### **Blocked File Types**

For your safety, these cannot be uploaded:
- ❌ Executables (.exe, .bat, .cmd, .sh)
- ❌ Scripts (.php, .jsp, .asp)
- ❌ Archive files with suspicious content

---

## 📧 Notification System

### **When You'll Receive Emails**

**Clients receive emails when**:
- CA accepts your request
- CA rejects your request
- CA sends you a message (if you're offline)
- Service is completed
- Payment is processed
- Refund is processed

**CAs receive emails when**:
- New service request assigned
- Client sends message (if you're offline)
- Payment received
- Payment released to wallet
- Review submitted

### **Staying in the Loop**

✅ **Enable notifications** in profile settings
✅ **Whitelist** `noreply@camarketplace.com`
✅ **Check dashboard** regularly
✅ **Respond promptly** to messages

---

## 🔔 Real-Time Features

### **Live Updates via WebSocket**

When you're online in the app:
- 🔔 Instant message notifications
- 📬 Real-time delivery status
- 👁️ Read receipts immediately shown
- 💬 Typing indicators (coming soon)
- 🟢 Online/offline status (coming soon)

---

## 🛡️ What's Coming

### **Planned Improvements**

1. **✅ Virus Scanning** (code ready, needs activation)
2. **Document Templates** - Pre-built checklists by service type
3. **Document Tracker** - See which docs are pending/received
4. **File Preview** - View PDFs without downloading
5. **Document Versioning** - Track updated documents
6. **Voice Messages** - Send voice notes
7. **Video Calls** - For complex consultations

---

## 📊 Message & File Limits

| Item | Limit | Notes |
|------|-------|-------|
| Messages per day | Unlimited | Fair use policy |
| Files per message | 10 | Documents only |
| File size | 10 MB | Per file |
| Total storage per user | 1 GB | Across all requests |
| Message history | 1 year | Older messages archived |
| File retention | Request lifetime + 3 months | Then moved to archive |

---

## ❓ FAQ

### **Q: Can I send multiple files at once?**
**A**: Yes! Up to 10 documents (100 MB total) per message.

### **Q: What if my file is too large?**
**A**:
- Compress PDF files using online tools
- Split large Excel files into multiple sheets
- Use cloud storage and share link in message (Google Drive, Dropbox)

### **Q: Can I delete a message I sent?**
**A**: Currently no. Contact support if you sent something by mistake.

### **Q: How long are files stored?**
**A**: Files are kept for the request duration + 3 months, then archived.

### **Q: Can I download files I uploaded?**
**A**: Yes! Click on any attached file in message history to download.

### **Q: Are my files private?**
**A**: Yes! Only you and the CA assigned to your request can see them.

### **Q: What if the CA doesn't respond?**
**A**: CAs typically respond within 24 hours. If no response in 48 hours, contact support.

### **Q: Can I chat with CA after service completion?**
**A**: Yes! The messaging channel stays open for follow-up questions.

---

## 🆘 Need Help?

**Common Issues**:

### **"File upload failed"**
- Check file size (max 10 MB)
- Check file type (PDF, Word, Excel only)
- Check internet connection
- Try a different browser

### **"File rejected for security reasons"**
- File failed virus scan
- Try re-downloading from original source
- Ensure file is not corrupted
- Contact support if issue persists

### **"Message not delivered"**
- Check internet connection
- Refresh the page
- Check if recipient user exists
- Contact support

---

## 📞 Support

- **Email**: support@camarketplace.com
- **Help Page**: /help in the app
- **Chat Support**: Available 9 AM - 6 PM (Mon-Fri)

---

**Remember**: Open communication leads to better outcomes. Don't hesitate to ask questions or request clarifications!

**Last Updated**: 2026-01-31
