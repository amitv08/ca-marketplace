import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Card, Loading, Alert, Badge } from '../../components/common';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState({ total: 0, clients: 0, cas: 0, admins: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const params: any = {};
      if (roleFilter) params.role = roleFilter;

      const response = await api.get('/admin/users', { params });

      if (response.data.success) {
        setUsers(response.data.data.data || response.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [all, clients, cas, admins] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/users?role=CLIENT'),
        api.get('/admin/users?role=CA'),
        api.get('/admin/users?role=ADMIN'),
      ]);

      setStats({
        total: all.data.data?.total || all.data.data?.data?.length || 0,
        clients: clients.data.data?.total || clients.data.data?.data?.length || 0,
        cas: cas.data.data?.total || cas.data.data?.data?.length || 0,
        admins: admins.data.data?.total || admins.data.data?.data?.length || 0,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-800';
      case 'CA':
        return 'bg-blue-100 text-blue-800';
      case 'CLIENT':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredUsers = users.filter((user) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-gray-600">View and manage all platform users</p>
      </div>

      {/* Error Message */}
      {error && (
        <Alert type="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="text-center cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setRoleFilter('')}>
          <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
          <p className="text-sm text-gray-600">Total Users</p>
        </Card>
        <Card className="text-center cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setRoleFilter('CA')}>
          <p className="text-2xl font-bold text-green-600">{stats.cas}</p>
          <p className="text-sm text-gray-600">Chartered Accountants</p>
        </Card>
        <Card className="text-center cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setRoleFilter('CLIENT')}>
          <p className="text-2xl font-bold text-purple-600">{stats.clients}</p>
          <p className="text-sm text-gray-600">Clients</p>
        </Card>
        <Card className="text-center cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setRoleFilter('ADMIN')}>
          <p className="text-2xl font-bold text-yellow-600">{stats.admins}</p>
          <p className="text-sm text-gray-600">Administrators</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex gap-4">
          <select
            className="px-4 py-2 border rounded-lg"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="CLIENT">Clients</option>
            <option value="CA">Chartered Accountants</option>
            <option value="ADMIN">Admins</option>
          </select>
          <input
            type="text"
            placeholder="Search users..."
            className="flex-1 px-4 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <h2 className="text-xl font-bold mb-4">
          All Users {roleFilter && `(${roleFilter})`}
        </h2>
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
                  <td colSpan={6} className="px-6 py-4 text-center">
                    <Loading />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    <div className="py-8">
                      <p className="text-lg mb-2">No users found</p>
                      <p className="text-sm">
                        {searchTerm
                          ? 'Try adjusting your search criteria'
                          : roleFilter
                          ? `No users with role ${roleFilter}`
                          : 'No users in the system'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold mr-3">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => navigate(`/profile`)} // Could be `/admin/users/${user.id}` if detail page exists
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        View
                      </button>
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
