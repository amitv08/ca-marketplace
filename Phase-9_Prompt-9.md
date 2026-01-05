Create these specific React pages for CA marketplace:

1. **Login Page** (/login)
   - Email/Password form
   - "Register as Client" and "Register as CA" links
   - Remember me option

2. **Registration Page** (/register/:role)
   - Dynamic form based on role (client or ca)
   - Client: name, email, password, phone, company
   - CA: name, email, password, phone, caLicenseNumber, specialization
   - Form validation with error messages

3. **CA Listing Page** (/cas)
   - Grid/list of verified CAs
   - Filters: specialization, min rating, max hourly rate
   - Search by name/location
   - Sort options
   - "Hire" button on each CA card

4. **Client Dashboard** (/dashboard/client)
   - Stats: Active requests, Completed, Pending
   - Recent requests with status
   - Quick action: "Find a CA"
   - Notifications

5. **CA Dashboard** (/dashboard/ca)
   - Stats: Active clients, Pending requests, Earnings
   - Recent requests needing action
   - Availability calendar
   - Profile completion status

Use Tailwind CSS for responsive design.
Create reusable components: Header, Footer, Card, Button, Input, Modal.