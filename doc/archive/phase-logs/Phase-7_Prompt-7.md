Integrate Razorpay payment gateway for the CA marketplace:

Features needed:
1. Payment workflow:
   - Client initiates payment for a service request
   - Payment held in escrow (platform account)
   - After service completion, admin releases to CA
   - Platform takes 10% commission

2. Endpoints:
   - POST /api/payments/create-order - Create Razorpay order
   - POST /api/payments/verify - Verify payment signature
   - GET /api/payments/:requestId - Get payment status
   - POST /api/admin/payments/release - Admin releases payment to CA

3. Database models (already have Payment model):
   - Track: amount, platformFee, caAmount, status, razorpayOrderId, razorpayPaymentId

4. Webhook endpoint for Razorpay notifications:
   - /api/payments/webhook

Security:
- Store Razorpay keys in environment variables
- Verify Razorpay signatures
- Rate limiting on payment endpoints