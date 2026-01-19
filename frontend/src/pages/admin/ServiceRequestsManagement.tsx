import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common';

const ServiceRequestsManagement: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch service requests from API
    setLoading(false);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Service Requests</h1>
        <p className="text-gray-600">Monitor all service requests and their status</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <Card className="text-center">
          <p className="text-2xl font-bold text-blue-600">10</p>
          <p className="text-sm text-gray-600">Total Requests</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-yellow-600">1</p>
          <p className="text-sm text-gray-600">Pending</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-purple-600">2</p>
          <p className="text-sm text-gray-600">In Progress</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-green-600">6</p>
          <p className="text-sm text-gray-600">Completed</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-red-600">1</p>
          <p className="text-sm text-gray-600">Accepted</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex gap-4">
          <select className="px-4 py-2 border rounded-lg">
            <option>All Status</option>
            <option>Pending</option>
            <option>Accepted</option>
            <option>In Progress</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
          <select className="px-4 py-2 border rounded-lg">
            <option>All Services</option>
            <option>GST Filing</option>
            <option>Income Tax Return</option>
            <option>Audit</option>
            <option>Tax Planning</option>
            <option>Accounting</option>
          </select>
          <input
            type="text"
            placeholder="Search requests..."
            className="flex-1 px-4 py-2 border rounded-lg"
          />
        </div>
      </Card>

      {/* Requests Table */}
      <Card>
        <h2 className="text-xl font-bold mb-4">All Service Requests</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Request ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Est. Hours
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Loading requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    <div className="py-8">
                      <p className="text-lg mb-2">📝 Service Requests Management Coming Soon</p>
                      <p className="text-sm">
                        This feature is under development. Service requests can be viewed through the database.
                      </p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto mt-4">
                        <p className="text-sm text-blue-800">
                          <strong>Current Status:</strong> 10 service requests in the system (6 completed, 2 in progress, 1 pending, 1 accepted).
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      #{request.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{request.clientName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{request.caName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{request.serviceType}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        request.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-800'
                          : request.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800'
                          : request.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{request.estimatedHours}h</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-blue-600 hover:text-blue-900">View Details</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ServiceRequestsManagement;
