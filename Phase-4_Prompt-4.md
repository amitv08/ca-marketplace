Create profile management endpoints for the CA marketplace:

1. **GET /api/users/profile** - Get current user's profile
   - Returns different data based on role (Client or CA)

2. **PUT /api/users/profile** - Update profile
   - Client can update: name, phone, company, address
   - CA can update: name, phone, specialization, experience, description, hourlyRate

3. **GET /api/cas** - List all verified CAs (for clients to browse)
   - Filters: specialization, minRating, maxHourlyRate
   - Pagination: page, limit
   - Sorting: rating, experience, hourlyRate

4. **GET /api/cas/:id** - Get CA details by ID

5. **Admin endpoints** (for CA verification):
   - GET /api/admin/cas/pending - List pending CA verifications
   - PUT /api/admin/cas/:id/verify - Approve/Reject CA with reason

Include proper authorization:
- Clients can only view CA profiles
- CAs can only update their own profile
- Admin can verify CAs