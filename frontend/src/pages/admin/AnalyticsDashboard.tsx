/**
 * Analytics Dashboard Page
 * Comprehensive admin dashboard for platform analytics
 */

import React, { useState } from 'react';
import { MetricCard } from '../../components/analytics/MetricCard';
import { FunnelChart } from '../../components/analytics/FunnelChart';
import { RevenueChart } from '../../components/analytics/RevenueChart';
import { CAUtilizationChart } from '../../components/analytics/CAUtilizationChart';
import {
  useDashboardMetrics,
  useFunnelData,
  useRevenueData,
  useCAUtilization,
  DateRange,
} from '../../hooks/useAnalytics';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

type DateRangePreset = '7d' | '30d' | 'month' | 'custom';

export const AnalyticsDashboard: React.FC = () => {
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [revenueGroupBy, setRevenueGroupBy] = useState<'day' | 'week' | 'month'>('day');

  // Calculate date range based on preset
  const getDateRange = (): DateRange | undefined => {
    const now = new Date();

    switch (dateRangePreset) {
      case '7d':
        return {
          startDate: subDays(now, 7).toISOString(),
          endDate: now.toISOString(),
        };
      case '30d':
        return {
          startDate: subDays(now, 30).toISOString(),
          endDate: now.toISOString(),
        };
      case 'month':
        return {
          startDate: startOfMonth(now).toISOString(),
          endDate: endOfMonth(now).toISOString(),
        };
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            startDate: new Date(customStartDate).toISOString(),
            endDate: new Date(customEndDate).toISOString(),
          };
        }
        return undefined;
      default:
        return undefined;
    }
  };

  const dateRange = getDateRange();

  // Fetch data using custom hooks
  const { data: dashboardData, loading: dashboardLoading, error: dashboardError, refetch: refetchDashboard } = useDashboardMetrics(dateRange);
  const { data: funnelData, loading: funnelLoading, error: funnelError } = useFunnelData(dateRange);
  const { data: revenueData, loading: revenueLoading, error: revenueError } = useRevenueData(dateRange, revenueGroupBy);
  const { data: utilizationData, loading: utilizationLoading, error: utilizationError } = useCAUtilization(dateRange);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const handleRefresh = () => {
    refetchDashboard();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600 mt-1">Platform performance and insights</p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Date Range Selector */}
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="flex gap-2">
              {['7d', '30d', 'month', 'custom'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDateRangePreset(preset as DateRangePreset)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    dateRangePreset === preset
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {preset === '7d' && 'Last 7 Days'}
                  {preset === '30d' && 'Last 30 Days'}
                  {preset === 'month' && 'This Month'}
                  {preset === 'custom' && 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {dateRangePreset === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {(dashboardError || funnelError || revenueError || utilizationError) && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium mb-2">Error Loading Analytics</h3>
          <p className="text-red-600 text-sm">
            {dashboardError || funnelError || revenueError || utilizationError}
          </p>
        </div>
      )}

      {/* Key Metrics Summary Cards */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Users"
            value={dashboardData ? formatNumber(dashboardData.users.total) : '0'}
            subtitle={`${dashboardData?.users.clients || 0} Clients, ${dashboardData?.users.cas || 0} CAs`}
            trend={{
              value: dashboardData?.users.growthRate || 0,
              direction: (dashboardData?.users.growthRate || 0) >= 0 ? 'up' : 'down',
            }}
            variant="info"
            loading={dashboardLoading}
          />

          <MetricCard
            title="Service Requests"
            value={dashboardData ? formatNumber(dashboardData.requests.total) : '0'}
            subtitle={`${dashboardData?.requests.completionRate.toFixed(1) || 0}% completion rate`}
            trend={{
              value: dashboardData?.requests.completed || 0,
              direction: 'up',
            }}
            variant="default"
            loading={dashboardLoading}
          />

          <MetricCard
            title="Total Revenue"
            value={dashboardData ? formatCurrency(dashboardData.revenue.total) : '$0'}
            subtitle={`Platform fees: ${formatCurrency(dashboardData?.revenue.platformFees || 0)}`}
            trend={{
              value: dashboardData?.revenue.growthRate || 0,
              direction: (dashboardData?.revenue.growthRate || 0) >= 0 ? 'up' : 'down',
            }}
            variant="success"
            loading={dashboardLoading}
          />

          <MetricCard
            title="Average Rating"
            value={dashboardData?.engagement.averageRating.toFixed(1) || '0.0'}
            subtitle={`${formatNumber(dashboardData?.engagement.reviewsCount || 0)} reviews`}
            trend={{
              value: dashboardData?.engagement.caUtilizationRate || 0,
              direction: 'stable',
            }}
            variant="info"
            loading={dashboardLoading}
          />
        </div>
      </div>

      {/* Additional Metrics Row */}
      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">New Users (Period)</h3>
            <p className="text-2xl font-bold text-gray-900">
              {dashboardData ? formatNumber(dashboardData.users.newUsers) : '0'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Growth rate: {dashboardData?.users.growthRate.toFixed(1)}%
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Avg Order Value</h3>
            <p className="text-2xl font-bold text-gray-900">
              {dashboardData ? formatCurrency(dashboardData.revenue.averageOrderValue) : '$0'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              CA payout: {formatCurrency(dashboardData?.revenue.caPayout || 0)}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">CA Utilization</h3>
            <p className="text-2xl font-bold text-gray-900">
              {dashboardData?.engagement.caUtilizationRate.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Repeat client rate: {dashboardData?.engagement.repeatClientRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Request Status Breakdown */}
      {dashboardData && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Request Status</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatNumber(dashboardData.requests.pending)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatNumber(dashboardData.requests.inProgress)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatNumber(dashboardData.requests.completed)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatNumber(dashboardData.requests.cancelled)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.requests.completionRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Acquisition Funnel */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">User Acquisition Funnel</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {funnelData && <FunnelChart data={funnelData} loading={funnelLoading} />}
          {funnelLoading && (
            <div className="h-96 flex items-center justify-center">
              <p className="text-gray-400">Loading funnel data...</p>
            </div>
          )}
        </div>
      </div>

      {/* Revenue Trends */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Revenue Trends</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Group by:</span>
            <select
              value={revenueGroupBy}
              onChange={(e) => setRevenueGroupBy(e.target.value as 'day' | 'week' | 'month')}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {revenueData && <RevenueChart data={revenueData} loading={revenueLoading} />}
          {revenueLoading && (
            <div className="h-96 flex items-center justify-center">
              <p className="text-gray-400">Loading revenue data...</p>
            </div>
          )}
        </div>
      </div>

      {/* CA Utilization */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">CA Utilization Rates</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {utilizationData && <CAUtilizationChart data={utilizationData} loading={utilizationLoading} maxCAs={10} />}
          {utilizationLoading && (
            <div className="h-96 flex items-center justify-center">
              <p className="text-gray-400">Loading utilization data...</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-sm text-gray-500 mt-12">
        <p>Last updated: {format(new Date(), 'PPpp')}</p>
        <p className="mt-1">Data refreshes every 60 seconds automatically</p>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
