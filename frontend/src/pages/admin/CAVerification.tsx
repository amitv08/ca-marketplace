import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common';

const CAVerification: React.FC = () => {
  const [pendingCAs, setPendingCAs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch pending CA verifications from API
    setLoading(false);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">CA Verification</h1>
        <p className="text-gray-600">Review and verify chartered accountant applications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="text-center">
          <p className="text-2xl font-bold text-yellow-600">0</p>
          <p className="text-sm text-gray-600">Pending Review</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-green-600">3</p>
          <p className="text-sm text-gray-600">Verified</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-red-600">0</p>
          <p className="text-sm text-gray-600">Rejected</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-blue-600">3</p>
          <p className="text-sm text-gray-600">Total CAs</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex gap-4">
          <select className="px-4 py-2 border rounded-lg">
            <option>All Status</option>
            <option>Pending</option>
            <option>Verified</option>
            <option>Rejected</option>
          </select>
          <input
            type="text"
            placeholder="Search by name or license number..."
            className="flex-1 px-4 py-2 border rounded-lg"
          />
        </div>
      </Card>

      {/* CA Applications */}
      <Card>
        <h2 className="text-xl font-bold mb-4">CA Applications</h2>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading applications...</div>
          ) : pendingCAs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✓</div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">All Caught Up!</h3>
              <p className="text-gray-500 mb-4">
                There are no pending CA verification requests at the moment.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> All 3 CAs in the system have been verified. New applications
                  will appear here for review.
                </p>
              </div>
            </div>
          ) : (
            pendingCAs.map((ca) => (
              <div key={ca.id} className="border rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2">{ca.name}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">License Number:</span>
                        <span className="ml-2 font-medium">{ca.licenseNumber}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Experience:</span>
                        <span className="ml-2 font-medium">{ca.experienceYears} years</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Email:</span>
                        <span className="ml-2 font-medium">{ca.email}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Hourly Rate:</span>
                        <span className="ml-2 font-medium">₹{ca.hourlyRate}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className="text-gray-600 text-sm">Specializations:</span>
                      <div className="flex gap-2 mt-2">
                        {ca.specializations?.map((spec: string) => (
                          <span
                            key={spec}
                            className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      ✓ Approve
                    </button>
                    <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default CAVerification;
