Create a messaging system for communication between Clients and CAs:

Requirements:
1. REST API endpoints:
   - POST /api/messages - Send message (with optional file attachment)
   - GET /api/messages/:requestId - Get all messages for a service request
   - PUT /api/messages/:id/read - Mark message as read

2. WebSocket (Socket.io) for real-time messaging:
   - When user sends message, emit to recipient
   - Online status tracking
   - Typing indicators (optional)

3. File upload for documents:
   - Support PDF, DOC, XLS, JPG, PNG
   - Max file size: 10MB
   - Store in AWS S3 or local uploads folder

Security:
- Users can only message within their service requests
- Client can only message their assigned CA
- CA can only message their clients