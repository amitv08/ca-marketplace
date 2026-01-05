Create the service request system for CA marketplace:

Models already exist: ServiceRequest, Message, Availability

Endpoints needed:

**Client Side:**
1. POST /api/requests - Create new service request to a CA
   - Input: caId, serviceType, description, deadline, estimatedHours
   - Status: PENDING

2. GET /api/client/requests - Get all requests for logged-in client
   - Filter by status

3. GET /api/requests/:id - Get request details

**CA Side:**
1. GET /api/ca/requests - Get all requests for logged-in CA
   - Filter by status

2. PUT /api/requests/:id/accept - CA accepts a request
   - Status changes to ACCEPTED

3. PUT /api/requests/:id/reject - CA rejects a request
   - Status changes to REJECTED

4. PUT /api/requests/:id/complete - Mark request as completed
   - Status changes to COMPLETED

**Business Logic:**
- Client can only have 3 PENDING requests at a time
- CA can only accept requests if they have availability
- Only the CA assigned to a request can change its status
- Completed requests can be reviewed