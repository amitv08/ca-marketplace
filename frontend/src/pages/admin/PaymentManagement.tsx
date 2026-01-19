import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common';

const PaymentManagement: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch payments from API
    setLoading(false);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Payment Management</h1>
        <p className="text-gray-600">Review and release payments to chartered accountants</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="text-center">
          <p className="text-2xl font-bold text-green-600">₹75,000</p>
          <p className="text-sm text-gray-600">Total Revenue</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-blue-600">₹63,750</p>
          <p className="text-sm text-gray-600">CA Payouts</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-purple-600">₹11,250</p>
          <p className="text-sm text-gray-600">Platform Fees</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-yellow-600">6</p>
          <p className="text-sm text-gray-600">Completed</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex gap-4">
          <select className="px-4 py-2 border rounded-lg">
            <option>All Payments</option>
            <option>Pending Release</option>
            <option>Released</option>
            <option>Completed</option>
          </select>
          <input
            type="date"
            className="px-4 py-2 border rounded-lg"
            placeholder="From Date"
          />
          <input
            type="date"
            className="px-4 py-2 border rounded-lg"
            placeholder="To Date"
          />
          <input
            type="text"
            placeholder="Search by CA or client..."
            className="flex-1 px-4 py-2 border rounded-lg"
          />
        </div>
      </Card>

      {/* Payments Table */}
      <Card>
        <h2 className="text-xl font-bold mb-4">Recent Payments</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Platform Fee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
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
                    Loading payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    <div className="py-8">
                      <p className="text-lg mb-2">💰 Payment Management Coming Soon</p>
                      <p className="text-sm">
                        This feature is under development. Payments can be managed through the database.
                      </p>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-2xl mx-auto mt-4">
                        <p className="text-sm text-green-800">
                          <strong>Current Status:</strong> 6 payments completed totaling ₹75,000 with ₹11,250 in platform fees.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      #{payment.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{payment.clientName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{payment.caName}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">₹{payment.amount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">₹{payment.platformFee}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        payment.released
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {payment.released ? 'Released' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {!payment.released && (
                        <button className="text-blue-600 hover:text-blue-900">
                          Release to CA
                        </button>
                      )}
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

export default PaymentManagement;
