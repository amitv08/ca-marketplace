I need to create a PostgreSQL database schema for a CA marketplace platform using Prisma ORM. 

Please create a complete `schema.prisma` file with these models:

1. **User** (base model with common fields for all user types)
   - id, email, password, role (CLIENT, CA, ADMIN)
   - Common profile fields: name, phone, profileImage, createdAt

2. **Client** (extends User with client-specific fields)
   - companyName (optional), address, taxNumber, documents

3. **CharteredAccountant** (extends User with CA-specific fields)
   - caLicenseNumber, specialization (GST, INCOME_TAX, AUDIT, etc.)
   - experienceYears, qualifications, verificationStatus (PENDING, VERIFIED, REJECTED)
   - hourlyRate, description, languages, availability

4. **ServiceRequest** (when client requests CA service)
   - clientId, caId, serviceType, status (PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED)
   - description, documents, deadline, estimatedHours

5. **Message** (for communication between client and CA)
   - senderId, receiverId, requestId, content, attachments, readStatus

6. **Review** (after service completion)
   - clientId, caId, requestId, rating (1-5), comment

7. **Payment** (transaction records)
   - clientId, caId, requestId, amount, status, paymentMethod, transactionId

8. **Availability** (CA's available time slots)
   - caId, date, startTime, endTime, isBooked

Add appropriate relationships, indexes, and constraints. Use proper Prisma syntax.

Save the output as: backend/prisma/schema.prisma