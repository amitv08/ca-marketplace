import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch users from API
    // For now, showing placeholder
    setLoading(false);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-gray-600">View and manage all platform users</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="text-center">
          <p className="text-2xl font-bold text-blue-600">8</p>
          <p className="text-sm text-gray-600">Total Users</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-green-600">3</p>
          <p className="text-sm text-gray-600">Chartered Accountants</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-purple-600">3</p>
          <p className="text-sm text-gray-600">Clients</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-yellow-600">2</p>
          <p className="text-sm text-gray-600">Administrators</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex gap-4">
          <select className="px-4 py-2 border rounded-lg">
            <option>All Roles</option>
            <option>Clients</option>
            <option>Chartered Accountants</option>
            <option>Admins</option>
          </select>
          <input
            type="text"
            placeholder="Search users..."
            className="flex-1 px-4 py-2 border rounded-lg"
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <h2 className="text-xl font-bold mb-4">All Users</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    <div className="py-8">
                      <p className="text-lg mb-2">📋 User Management Coming Soon</p>
                      <p className="text-sm">
                        This feature is under development. Users can be viewed and managed through the database.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{user.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-blue-600 hover:text-blue-900 mr-3">View</button>
                      <button className="text-red-600 hover:text-red-900">Suspend</button>
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

export default UserManagement;
