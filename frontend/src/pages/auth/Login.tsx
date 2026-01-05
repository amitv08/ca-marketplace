import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAppDispatch } from '../../store/hooks';
import { loginStart, loginSuccess, loginFailure } from '../../store/slices/authSlice';
import { authService, LoginCredentials } from '../../services';
import { Button, Input, Card } from '../../components/common';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>();

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setIsLoading(true);
      setApiError('');
      dispatch(loginStart());

      const response = await authService.login(data);

      if (response.success) {
        dispatch(loginSuccess({
          user: response.data.user,
          token: response.data.token,
        }));

        // Redirect based on role
        if (response.data.user.role === 'CLIENT') {
          navigate('/client/dashboard');
        } else if (response.data.user.role === 'CA') {
          navigate('/ca/dashboard');
        } else if (response.data.user.role === 'ADMIN') {
          navigate('/admin/dashboard');
        } else {
          navigate('/');
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login failed. Please try again.';
      setApiError(errorMessage);
      dispatch(loginFailure(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">CA Marketplace</h2>
          <p className="mt-2 text-gray-600">Sign in to your account</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {apiError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {apiError}
              </div>
            )}

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

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters',
                },
              })}
            />

            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                Remember me
              </label>
            </div>

            <Button type="submit" fullWidth isLoading={isLoading}>
              Sign In
            </Button>

            <div className="space-y-3">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Don't have an account?</p>
                <div className="flex gap-3">
                  <Link to="/register/client" className="flex-1">
                    <Button variant="outline" size="sm" fullWidth>
                      Register as Client
                    </Button>
                  </Link>
                  <Link to="/register/ca" className="flex-1">
                    <Button variant="outline" size="sm" fullWidth>
                      Register as CA
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;
