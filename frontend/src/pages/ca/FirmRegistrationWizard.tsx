import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Select, Alert } from '../../components/common';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8081/api';

interface FirmData {
  firmName: string;
  firmType: 'SOLE_PROPRIETORSHIP' | 'PARTNERSHIP' | 'LLP' | 'PRIVATE_LIMITED';
  registrationNumber: string;
  gstin: string;
  panNumber: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  establishedYear: number;
  website?: string;
  description?: string;
}

interface InviteMember {
  email: string;
  role: 'SENIOR_CA' | 'JUNIOR_CA' | 'ASSOCIATE';
  membershipType: 'EQUITY_PARTNER' | 'SALARIED_PARTNER' | 'CONSULTANT';
  message?: string;
}

const FirmRegistrationWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [firmId, setFirmId] = useState<string | null>(null);

  const [firmData, setFirmData] = useState<FirmData>({
    firmName: '',
    firmType: 'PARTNERSHIP',
    registrationNumber: '',
    gstin: '',
    panNumber: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    establishedYear: new Date().getFullYear(),
    website: '',
    description: '',
  });

  const [invitations, setInvitations] = useState<InviteMember[]>([
    {
      email: '',
      role: 'SENIOR_CA',
      membershipType: 'EQUITY_PARTNER',
      message: '',
    },
  ]);

  const steps = [
    { number: 1, title: 'Basic Information', description: 'Firm details' },
    { number: 2, title: 'Invite Members', description: 'Add team members' },
    { number: 3, title: 'Review & Submit', description: 'Final review' },
  ];

  const firmTypes = [
    { value: 'SOLE_PROPRIETORSHIP', label: 'Sole Proprietorship' },
    { value: 'PARTNERSHIP', label: 'Partnership' },
    { value: 'LLP', label: 'Limited Liability Partnership (LLP)' },
    { value: 'PRIVATE_LIMITED', label: 'Private Limited Company' },
  ];

  const memberRoles = [
    { value: 'SENIOR_CA', label: 'Senior CA' },
    { value: 'JUNIOR_CA', label: 'Junior CA' },
    { value: 'ASSOCIATE', label: 'Associate' },
  ];

  const membershipTypes = [
    { value: 'EQUITY_PARTNER', label: 'Equity Partner' },
    { value: 'SALARIED_PARTNER', label: 'Salaried Partner' },
    { value: 'CONSULTANT', label: 'Consultant' },
  ];

  const handleFirmDataChange = (field: keyof FirmData, value: any) => {
    setFirmData((prev) => ({ ...prev, [field]: value }));
  };

  const handleInvitationChange = (index: number, field: keyof InviteMember, value: any) => {
    const updated = [...invitations];
    updated[index] = { ...updated[index], [field]: value };
    setInvitations(updated);
  };

  const addInvitation = () => {
    setInvitations([
      ...invitations,
      {
        email: '',
        role: 'SENIOR_CA',
        membershipType: 'EQUITY_PARTNER',
        message: '',
      },
    ]);
  };

  const removeInvitation = (index: number) => {
    setInvitations(invitations.filter((_, i) => i !== index));
  };

  // Validation helper functions
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidPhone = (phone: string): boolean => {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const isValidGSTIN = (gstin: string): boolean => {
    if (!gstin) return true; // Optional field
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
  };

  const isValidPAN = (pan: string): boolean => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  };

  const isValidPincode = (pincode: string): boolean => {
    const pincodeRegex = /^[0-9]{6}$/;
    return pincodeRegex.test(pincode);
  };

  const isValidURL = (url: string): boolean => {
    if (!url) return true; // Optional field
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isValidYear = (year: number): boolean => {
    const currentYear = new Date().getFullYear();
    return year >= 1900 && year <= currentYear;
  };

  const validateStep1 = (): boolean => {
    // Check required fields
    if (!firmData.firmName || !firmData.firmType || !firmData.registrationNumber) {
      setError('Please fill in all required fields');
      return false;
    }
    if (!firmData.panNumber || !firmData.email || !firmData.phone) {
      setError('Please fill in all required fields');
      return false;
    }
    if (!firmData.address || !firmData.city || !firmData.state || !firmData.pincode) {
      setError('Please fill in all required fields');
      return false;
    }

    // Validate email format
    if (!isValidEmail(firmData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Validate phone number
    if (!isValidPhone(firmData.phone)) {
      setError('Please enter a valid 10-digit phone number');
      return false;
    }

    // Validate PAN number
    if (!isValidPAN(firmData.panNumber)) {
      setError('Please enter a valid PAN number (e.g., AAAAA0000A)');
      return false;
    }

    // Validate GSTIN if provided
    if (firmData.gstin && !isValidGSTIN(firmData.gstin)) {
      setError('Please enter a valid GSTIN (e.g., 22AAAAA0000A1Z5)');
      return false;
    }

    // Validate pincode
    if (!isValidPincode(firmData.pincode)) {
      setError('Please enter a valid 6-digit pincode');
      return false;
    }

    // Validate website URL if provided
    if (firmData.website && !isValidURL(firmData.website)) {
      setError('Please enter a valid website URL');
      return false;
    }

    // Validate established year
    if (!isValidYear(firmData.establishedYear)) {
      setError(`Established year must be between 1900 and ${new Date().getFullYear()}`);
      return false;
    }

    return true;
  };

  const validateStep2 = (): boolean => {
    const validInvitations = invitations.filter((inv) => inv.email.trim() !== '');

    // Check if there's at least one invitation
    if (validInvitations.length === 0) {
      // Step 2 is optional, so allow progression
      return true;
    }

    // Validate each invitation email
    for (const invitation of validInvitations) {
      if (!isValidEmail(invitation.email)) {
        setError(`Invalid email format: ${invitation.email}`);
        return false;
      }
    }

    // Check for duplicate emails
    const emails = validInvitations.map((inv) => inv.email.toLowerCase());
    const uniqueEmails = new Set(emails);
    if (emails.length !== uniqueEmails.size) {
      setError('Duplicate email addresses found. Each invitation must have a unique email.');
      return false;
    }

    return true;
  };

  const handleStep1Submit = async () => {
    if (!validateStep1()) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please login again.');
        setLoading(false);
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/firms/initiate`,
        firmData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Validate response structure
      if (!response?.data?.data?.firm?.id) {
        throw new Error('Invalid response from server');
      }

      setFirmId(response.data.data.firm.id);
      setSuccess('Firm created successfully!');
      setCurrentStep(2);
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message === 'Network Error') {
        setError('Network error. Please check your connection and try again.');
      } else if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to create firm');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async () => {
    if (!validateStep2()) return;
    if (!firmId) {
      setError('Firm ID not found. Please start from step 1.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please login again.');
        setLoading(false);
        return;
      }

      const validInvitations = invitations.filter((inv) => inv.email.trim() !== '');

      // Send invitations one by one
      for (const invitation of validInvitations) {
        const response = await axios.post(
          `${API_BASE_URL}/firms/${firmId}/invite`,
          invitation,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response?.data) {
          throw new Error('Invalid response from server');
        }
      }

      setSuccess(validInvitations.length > 0 ? 'Invitations sent successfully!' : 'Moving to next step');
      setCurrentStep(3);
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message === 'Network Error') {
        setError('Network error. Please check your connection and try again.');
      } else if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to send invitations');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please login again.');
        setLoading(false);
        return;
      }

      if (!firmId) {
        setError('Firm ID not found. Please start from step 1.');
        setLoading(false);
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/firms/${firmId}/submit-for-verification`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response?.data) {
        throw new Error('Invalid response from server');
      }

      setSuccess('Firm submitted for verification! You will be notified once approved.');
      setTimeout(() => {
        navigate('/ca/my-firm');
      }, 2000);
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message === 'Network Error') {
        setError('Network error. Please check your connection and try again.');
      } else if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(
          err.response?.data?.message || err.message ||
            'Cannot submit yet. Please ensure all requirements are met.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Basic Firm Information</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Input
            label="Firm Name *"
            value={firmData.firmName}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('firmName', e.target.value)}
            placeholder="Enter firm name"
          />
        </div>

        <Select
          label="Firm Type *"
          value={firmData.firmType}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('firmType', e.target.value)}
          options={firmTypes}
        />

        <Input
          label="Registration Number *"
          value={firmData.registrationNumber}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('registrationNumber', e.target.value)}
          placeholder="e.g., REG123456"
        />

        <Input
          label="GSTIN"
          value={firmData.gstin}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('gstin', e.target.value)}
          placeholder="e.g., 22AAAAA0000A1Z5"
        />

        <Input
          label="PAN Number *"
          value={firmData.panNumber}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('panNumber', e.target.value)}
          placeholder="e.g., AAAAA0000A"
        />

        <Input
          label="Email *"
          type="email"
          value={firmData.email}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('email', e.target.value)}
          placeholder="firm@example.com"
        />

        <Input
          label="Phone *"
          value={firmData.phone}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('phone', e.target.value)}
          placeholder="e.g., 9876543210"
        />

        <Input
          label="Established Year *"
          type="number"
          value={firmData.establishedYear}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('establishedYear', parseInt(e.target.value))}
          placeholder={new Date().getFullYear().toString()}
        />

        <div className="md:col-span-2">
          <Input
            label="Address *"
            value={firmData.address}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('address', e.target.value)}
            placeholder="Enter complete address"
          />
        </div>

        <Input
          label="City *"
          value={firmData.city}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('city', e.target.value)}
          placeholder="e.g., Mumbai"
        />

        <Input
          label="State *"
          value={firmData.state}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('state', e.target.value)}
          placeholder="e.g., Maharashtra"
        />

        <Input
          label="Pincode *"
          value={firmData.pincode}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('pincode', e.target.value)}
          placeholder="e.g., 400001"
        />

        <Input
          label="Website"
          value={firmData.website}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('website', e.target.value)}
          placeholder="https://www.example.com"
        />

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={firmData.description}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleFirmDataChange('description', e.target.value)}
            placeholder="Brief description of your firm..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleStep1Submit} disabled={loading}>
          {loading ? 'Creating...' : 'Next: Invite Members'}
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Invite Team Members</h3>
        <p className="text-sm text-gray-600 mt-1">
          Invite at least one verified CA to join your firm
        </p>
      </div>

      {invitations.map((invitation, index) => (
        <Card key={index} className="p-4">
          <div className="flex justify-between items-start mb-4">
            <h4 className="font-medium">Member {index + 1}</h4>
            {invitations.length > 1 && (
              <button
                onClick={() => removeInvitation(index)}
                className="text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Email *"
                type="email"
                value={invitation.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInvitationChange(index, 'email', e.target.value)}
                placeholder="ca@example.com"
              />
            </div>

            <Select
              label="Role *"
              value={invitation.role}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleInvitationChange(index, 'role', e.target.value)}
              options={memberRoles}
            />

            <Select
              label="Membership Type *"
              value={invitation.membershipType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleInvitationChange(index, 'membershipType', e.target.value)}
              options={membershipTypes}
            />

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Personal Message
              </label>
              <textarea
                value={invitation.message}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => handleInvitationChange(index, 'message', e.target.value)}
                placeholder="Optional message to the invitee..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Card>
      ))}

      <Button onClick={addInvitation} variant="secondary">
        + Add Another Member
      </Button>

      <div className="flex justify-between pt-4">
        <Button onClick={() => setCurrentStep(1)} variant="secondary">
          Back
        </Button>
        <Button onClick={handleStep2Submit} disabled={loading}>
          {loading ? 'Sending...' : 'Next: Review'}
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Review & Submit</h3>

      <Card className="p-6">
        <h4 className="font-medium mb-4">Firm Details</h4>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-600">Firm Name</dt>
            <dd className="font-medium">{firmData.firmName}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Type</dt>
            <dd className="font-medium">{firmData.firmType.replace(/_/g, ' ')}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Registration Number</dt>
            <dd className="font-medium">{firmData.registrationNumber}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">PAN Number</dt>
            <dd className="font-medium">{firmData.panNumber}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Email</dt>
            <dd className="font-medium">{firmData.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Phone</dt>
            <dd className="font-medium">{firmData.phone}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <h4 className="font-medium mb-4">Invited Members</h4>
        <div className="space-y-2">
          {invitations
            .filter((inv) => inv.email.trim() !== '')
            .map((inv, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b">
                <span>{inv.email}</span>
                <span className="text-sm text-gray-600">
                  {inv.role.replace(/_/g, ' ')} - {inv.membershipType.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
        </div>
      </Card>

      <Alert type="info">
        <p className="font-medium">Next Steps:</p>
        <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
          <li>Your invited members need to accept the invitations</li>
          <li>Upload required documents (Registration Certificate, PAN, etc.)</li>
          <li>Submit for admin verification once all requirements are met</li>
          <li>Approval typically takes 5-7 business days</li>
        </ol>
      </Alert>

      <div className="flex justify-between pt-4">
        <Button onClick={() => setCurrentStep(2)} variant="secondary">
          Back
        </Button>
        <Button onClick={handleFinalSubmit} disabled={loading}>
          {loading ? 'Submitting...' : 'Complete Registration'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Register Your CA Firm</h1>
        <p className="text-gray-600">Follow the steps below to create your firm</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex justify-between">
          {steps.map((step) => (
            <div key={step.number} className="flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    currentStep >= step.number
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {step.number}
                </div>
                <div className="text-center mt-2">
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
              </div>
              {step.number < steps.length && (
                <div
                  className={`h-1 mt-5 ${
                    currentStep > step.number ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert type="error" className="mb-4" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert type="success" className="mb-4" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Step Content */}
      <Card className="p-6">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </Card>
    </div>
  );
};

export default FirmRegistrationWizard;
