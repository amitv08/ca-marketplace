import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAppDispatch } from '../../store/hooks';
import { loginSuccess } from '../../store/slices/authSlice';
import { authService, RegisterData } from '../../services';
import { Button, Input, Card } from '../../components/common';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { role } = useParams<{ role?: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [selectedRole, setSelectedRole] = useState<'CLIENT' | 'CA'>('CLIENT');

  // Set role from URL parameter if provided
  useEffect(() => {
    if (role) {
      const upperRole = role.toUpperCase() as 'CLIENT' | 'CA';
      if (upperRole === 'CLIENT' || upperRole === 'CA') {
        setSelectedRole(upperRole);
      }
    }
  }, [role]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterData>();

  const password = watch('password');

  const onSubmit = async (data: RegisterData) => {
    try {
      setIsLoading(true);
      setApiError('');

      // Remove confirmPassword from the data sent to the backend
      const { confirmPassword, ...registerData } = data;
      const finalData: RegisterData = {
        ...registerData,
        role: selectedRole,
      };

      const response = await authService.register(finalData);

      if (response.success) {
        dispatch(loginSuccess({
          user: response.data.user,
          token: response.data.token,
        }));

        // Redirect based on role
        if (selectedRole === 'CLIENT') {
          navigate('/client/dashboard');
        } else if (selectedRole === 'CA') {
          navigate('/ca/dashboard');
        } else {
          navigate('/');
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
      setApiError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">CA Marketplace</h2>
          <p className="mt-2 text-gray-600">Create your account</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {apiError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {apiError}
              </div>
            )}

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                I am a <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedRole('CLIENT')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedRole === 'CLIENT'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <h3 className="font-semibold text-lg">Client</h3>
                  <p className="text-sm text-gray-600 mt-1">Looking for CA services</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('CA')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedRole === 'CA'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <h3 className="font-semibold text-lg">Chartered Accountant</h3>
                  <p className="text-sm text-gray-600 mt-1">Offering CA services</p>
                </button>
              </div>
            </div>

            {/* Common Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                placeholder="Enter your full name"
                error={errors.name?.message}
                {...register('name', { required: 'Name is required' })}
              />

              <Input
                label="Phone Number"
                type="tel"
                placeholder="Enter phone number"
                error={errors.phone?.message}
                {...register('phone')}
              />
            </div>

            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Password"
                type="password"
                placeholder="Enter password"
                error={errors.password?.message}
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters',
                  },
                })}
              />

              <Input
                label="Confirm Password"
                type="password"
                placeholder="Confirm password"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword', {
                  validate: (value) => value === password || 'Passwords do not match',
                })}
              />
            </div>

            {/* CA-Specific Fields */}
            {selectedRole === 'CA' && (
              <>
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4">Professional Information</h3>

                  <div className="space-y-4">
                    <Input
                      label="CA License Number"
                      placeholder="Enter your CA license number"
                      error={errors.caLicenseNumber?.message}
                      {...register('caLicenseNumber', {
                        required: selectedRole === 'CA' ? 'License number is required' : false,
                      })}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Years of Experience"
                        type="number"
                        placeholder="Enter years"
                        error={errors.experienceYears?.message}
                        {...register('experienceYears', {
                          required: selectedRole === 'CA' ? 'Experience is required' : false,
                          min: { value: 0, message: 'Invalid experience' },
                        })}
                      />

                      <Input
                        label="Hourly Rate (₹)"
                        type="number"
                        placeholder="Enter hourly rate"
                        error={errors.hourlyRate?.message}
                        {...register('hourlyRate', {
                          required: selectedRole === 'CA' ? 'Hourly rate is required' : false,
                          min: { value: 0, message: 'Invalid rate' },
                        })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="Brief description of your services"
                        {...register('description')}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Client-Specific Fields */}
            {selectedRole === 'CLIENT' && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Company Information (Optional)</h3>

                <div className="space-y-4">
                  <Input
                    label="Company Name"
                    placeholder="Enter company name"
                    {...register('companyName')}
                  />

                  <Input
                    label="Address"
                    placeholder="Enter address"
                    {...register('address')}
                  />

                  <Input
                    label="Tax Number (GST/PAN)"
                    placeholder="Enter tax number"
                    {...register('taxNumber')}
                  />
                </div>
              </div>
            )}

            <Button type="submit" fullWidth isLoading={isLoading}>
              Create Account
            </Button>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  Login here
                </Link>
              </p>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Register;
