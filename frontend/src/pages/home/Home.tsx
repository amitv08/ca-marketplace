import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { Button, Card } from '../../components/common';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      if (user?.role === 'CLIENT') {
        navigate('/client/dashboard');
      } else if (user?.role === 'CA') {
        navigate('/ca/dashboard');
      } else {
        navigate('/cas');
      }
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            CA Marketplace
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Connect with verified Chartered Accountants for all your financial and taxation needs.
            Get professional services with complete transparency and secure payments.
          </p>
          <div className="flex justify-center space-x-4">
            <Button size="lg" onClick={handleGetStarted}>
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/cas')}>
              Browse CAs
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Verified Professionals</h3>
              <p className="text-gray-600">
                All CAs are verified with valid licenses and credentials for your peace of mind.
              </p>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="bg-green-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure Payments</h3>
              <p className="text-gray-600">
                Escrow-based payment system with Razorpay integration for complete security.
              </p>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="bg-purple-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-time Communication</h3>
              <p className="text-gray-600">
                Chat directly with CAs, share documents, and track your service requests in real-time.
              </p>
            </div>
          </Card>
        </div>

        {/* How It Works */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-blue-600 text-white rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Browse CAs</h3>
              <p className="text-gray-600 text-sm">
                Search and filter CAs based on specialization, experience, and ratings.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-600 text-white rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Send Request</h3>
              <p className="text-gray-600 text-sm">
                Send service request with your requirements and documents.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-600 text-white rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Make Payment</h3>
              <p className="text-gray-600 text-sm">
                Securely pay for services using our escrow payment system.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-600 text-white rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                4
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Get Service</h3>
              <p className="text-gray-600 text-sm">
                CA completes the work and you receive the deliverables.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-lg mb-6 opacity-90">
              Join thousands of satisfied clients and professionals
            </p>
            <div className="flex justify-center space-x-4">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate(isAuthenticated ? '/cas' : '/register')}
              >
                {isAuthenticated ? 'Find a CA' : 'Register Now'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Home;
