import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import api from '../../services/api';
import { Card, Button, Input, Loading, Alert, Badge, Select } from '../../components/common';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  profileImage?: string;
  role: 'CLIENT' | 'CA' | 'ADMIN' | 'SUPER_ADMIN';
  createdAt: string;
  client?: {
    companyName?: string;
    address?: string;
    taxNumber?: string;
  };
  charteredAccountant?: {
    caLicenseNumber: string;
    specialization: string[];
    experienceYears: number;
    hourlyRate: number;
    description?: string;
    qualifications: string[];
    languages: string[];
    verificationStatus: string;
  };
}

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAppSelector((state) => state.auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    companyName: '',
    address: '',
    taxNumber: '',
    caLicenseNumber: '',
    specialization: [] as string[],
    experienceYears: 0,
    hourlyRate: 0,
    description: '',
    qualifications: [] as string[],
    languages: [] as string[],
  });

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/users/profile');

      if (response.data.success) {
        const profileData = response.data.data;
        setProfile(profileData);

        // Initialize form data
        setFormData({
          name: profileData.name || '',
          phone: profileData.phone || '',
          companyName: profileData.client?.companyName || '',
          address: profileData.client?.address || '',
          taxNumber: profileData.client?.taxNumber || '',
          caLicenseNumber: profileData.charteredAccountant?.caLicenseNumber || '',
          specialization: profileData.charteredAccountant?.specialization || [],
          experienceYears: profileData.charteredAccountant?.experienceYears || 0,
          hourlyRate: profileData.charteredAccountant?.hourlyRate || 0,
          description: profileData.charteredAccountant?.description || '',
          qualifications: profileData.charteredAccountant?.qualifications || [],
          languages: profileData.charteredAccountant?.languages || [],
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Validate
      if (!formData.name || formData.name.length < 2) {
        setError('Name must be at least 2 characters');
        return;
      }

      if (profile?.role === 'CA') {
        if (!formData.caLicenseNumber) {
          setError('CA License Number is required');
          return;
        }
        if (formData.hourlyRate < 0) {
          setError('Hourly rate must be 0 or greater');
          return;
        }
        if (formData.experienceYears < 0 || formData.experienceYears > 70) {
          setError('Experience years must be between 0 and 70');
          return;
        }
      }

      // Update profile based on role
      if (profile?.role === 'CA') {
        await api.patch('/users/ca-profile', {
          name: formData.name,
          phone: formData.phone,
          caLicenseNumber: formData.caLicenseNumber,
          specialization: formData.specialization,
          experienceYears: Number(formData.experienceYears),
          hourlyRate: Number(formData.hourlyRate),
          description: formData.description,
          qualifications: formData.qualifications,
          languages: formData.languages,
        });
      } else if (profile?.role === 'CLIENT') {
        await api.patch('/users/client-profile', {
          name: formData.name,
          phone: formData.phone,
          companyName: formData.companyName,
          address: formData.address,
          taxNumber: formData.taxNumber,
        });
      } else {
        // Admin - only basic fields
        await api.put('/users/profile', {
          name: formData.name,
          phone: formData.phone,
        });
      }

      setSuccess('Profile updated successfully!');
      setEditing(false);
      await fetchProfile();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    try {
      setPasswordError('');

      if (!passwordData.currentPassword || !passwordData.newPassword) {
        setPasswordError('All fields are required');
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setPasswordError('New passwords do not match');
        return;
      }

      if (passwordData.newPassword.length < 8) {
        setPasswordError('New password must be at least 8 characters');
        return;
      }

      const response = await api.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      if (response.data.success) {
        setSuccess('Password changed successfully!');
        setShowPasswordChange(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || 'Failed to change password');
    }
  };

  const getProfileCompletion = (): number => {
    if (!profile || profile.role !== 'CA') return 100;

    const ca = profile.charteredAccountant;
    if (!ca) return 0;

    const fields = [
      ca.caLicenseNumber,
      ca.specialization?.length > 0,
      ca.experienceYears > 0,
      ca.hourlyRate > 0,
      ca.description,
      ca.qualifications?.length > 0,
      ca.languages?.length > 0,
    ];

    const completed = fields.filter(Boolean).length;
    return Math.round((completed / fields.length) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert type="error">Profile not found</Alert>
      </div>
    );
  }

  const specializationOptions = [
    'GST',
    'INCOME_TAX',
    'AUDIT',
    'ACCOUNTING',
    'FINANCIAL_PLANNING',
    'TAX_PLANNING',
    'COMPANY_LAW',
    'OTHER',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="mt-2 text-gray-600">Manage your account settings and information</p>
        </div>
        <div className="flex gap-3">
          {!editing ? (
            <Button onClick={() => setEditing(true)}>
              Edit Profile
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => {
                setEditing(false);
                fetchProfile();
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave} isLoading={saving}>
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert type="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert type="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Profile Overview */}
        <div className="lg:col-span-1">
          <Card>
            <div className="text-center">
              {/* Profile Image Placeholder */}
              <div className="mx-auto h-32 w-32 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-4xl font-bold mb-4">
                {profile.name.charAt(0).toUpperCase()}
              </div>

              <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
              <p className="text-gray-600 mb-4">{profile.email}</p>

              <Badge variant={profile.role === 'ADMIN' ? 'info' : profile.role === 'CA' ? 'success' : 'default'}>
                {profile.role}
              </Badge>

              {profile.role === 'CA' && profile.charteredAccountant && (
                <div className="mt-6">
                  <Badge variant={
                    profile.charteredAccountant.verificationStatus === 'VERIFIED' ? 'success' :
                    profile.charteredAccountant.verificationStatus === 'REJECTED' ? 'error' : 'warning'
                  }>
                    {profile.charteredAccountant.verificationStatus}
                  </Badge>

                  <div className="mt-6">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Profile Completion</span>
                      <span className="font-medium">{getProfileCompletion()}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${getProfileCompletion()}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-200 text-sm text-gray-600">
                <p>Member since</p>
                <p className="font-medium text-gray-900">
                  {new Date(profile.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </Card>

          {/* Security Section */}
          <Card className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Security</h3>
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowPasswordChange(!showPasswordChange)}
            >
              Change Password
            </Button>

            {showPasswordChange && (
              <div className="mt-4 space-y-4">
                {passwordError && (
                  <Alert type="error" onClose={() => setPasswordError('')}>
                    {passwordError}
                  </Alert>
                )}

                <Input
                  type="password"
                  label="Current Password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({
                    ...prev,
                    currentPassword: e.target.value
                  }))}
                  placeholder="Enter current password"
                />

                <Input
                  type="password"
                  label="New Password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({
                    ...prev,
                    newPassword: e.target.value
                  }))}
                  placeholder="Enter new password"
                  helperText="Minimum 8 characters"
                />

                <Input
                  type="password"
                  label="Confirm New Password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({
                    ...prev,
                    confirmPassword: e.target.value
                  }))}
                  placeholder="Confirm new password"
                />

                <Button
                  variant="primary"
                  fullWidth
                  onClick={handlePasswordChange}
                >
                  Update Password
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column - Profile Details */}
        <div className="lg:col-span-2">
          {/* Basic Information */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={!editing}
                required
              />

              <Input
                label="Email"
                type="email"
                value={profile.email}
                disabled
                helperText="Email cannot be changed"
              />

              <Input
                label="Phone Number"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                disabled={!editing}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </Card>

          {/* Client-Specific Fields */}
          {profile.role === 'CLIENT' && (
            <Card className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Company Name"
                  value={formData.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  disabled={!editing}
                  placeholder="Optional"
                />

                <Input
                  label="Tax Number"
                  value={formData.taxNumber}
                  onChange={(e) => handleChange('taxNumber', e.target.value)}
                  disabled={!editing}
                  placeholder="GST/PAN Number"
                />
              </div>

              <div className="mt-4">
                <Input
                  label="Address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  disabled={!editing}
                  placeholder="Full address"
                />
              </div>
            </Card>
          )}

          {/* CA-Specific Fields */}
          {profile.role === 'CA' && (
            <>
              <Card className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Professional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="CA License Number"
                    value={formData.caLicenseNumber}
                    onChange={(e) => handleChange('caLicenseNumber', e.target.value)}
                    disabled={!editing}
                    required
                    placeholder="e.g., 123456"
                  />

                  <Input
                    label="Experience (Years)"
                    type="number"
                    value={formData.experienceYears}
                    onChange={(e) => handleChange('experienceYears', parseInt(e.target.value) || 0)}
                    disabled={!editing}
                    min="0"
                    max="70"
                  />

                  <Input
                    label="Hourly Rate (₹)"
                    type="number"
                    value={formData.hourlyRate}
                    onChange={(e) => handleChange('hourlyRate', parseFloat(e.target.value) || 0)}
                    disabled={!editing}
                    min="0"
                    step="100"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    rows={4}
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    disabled={!editing}
                    placeholder="Tell clients about your expertise and experience..."
                  />
                </div>
              </Card>

              <Card className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Specializations</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Select your areas of expertise
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {specializationOptions.map((spec) => (
                    <label key={spec} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.specialization.includes(spec)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleChange('specialization', [...formData.specialization, spec]);
                          } else {
                            handleChange('specialization', formData.specialization.filter(s => s !== spec));
                          }
                        }}
                        disabled={!editing}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{spec.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
