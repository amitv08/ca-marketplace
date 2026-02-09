/**
 * RevenueChart Component
 * Multi-series line/area chart for revenue tracking
 */

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

export interface RevenueDataPoint {
  date: string;
  totalRevenue: number;
  platformFees: number;
  caPayout: number;
  transactionCount: number;
}

export interface RevenueChartProps {
  data: RevenueDataPoint[];
  loading?: boolean;
  chartType?: 'line' | 'area';
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  loading = false,
  chartType: initialChartType = 'area',
}) => {
  const [chartType, setChartType] = useState<'line' | 'area'>(initialChartType);
  const [showMetrics, setShowMetrics] = useState({
    totalRevenue: true,
    platformFees: true,
    caPayout: true,
  });

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
        <p className="text-gray-400">Loading revenue data...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-gray-400">No revenue data available</p>
      </div>
    );
  }

  // Calculate totals
  const totals = data.reduce(
    (acc, d) => ({
      totalRevenue: acc.totalRevenue + d.totalRevenue,
      platformFees: acc.platformFees + d.platformFees,
      caPayout: acc.caPayout + d.caPayout,
      transactions: acc.transactions + d.transactionCount,
    }),
    { totalRevenue: 0, platformFees: 0, caPayout: 0, transactions: 0 }
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM dd');
    } catch {
      return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: <span className="font-medium">{formatCurrency(entry.value)}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const toggleMetric = (metric: keyof typeof showMetrics) => {
    setShowMetrics((prev) => ({ ...prev, [metric]: !prev[metric] }));
  };

  const ChartComponent = chartType === 'area' ? AreaChart : LineChart;

  return (
    <div className="w-full">
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Revenue Breakdown</h3>
          <p className="text-sm text-gray-600 mt-1">
            Total: {formatCurrency(totals.totalRevenue)} | {totals.transactions} transactions
          </p>
        </div>

        {/* Chart type toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1 text-sm rounded ${
              chartType === 'line'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Line
          </button>
          <button
            onClick={() => setChartType('area')}
            className={`px-3 py-1 text-sm rounded ${
              chartType === 'area'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Area
          </button>
        </div>
      </div>

      {/* Legend with toggles */}
      <div className="flex flex-wrap gap-4 mb-4">
        <button
          onClick={() => toggleMetric('totalRevenue')}
          className={`flex items-center gap-2 px-3 py-1 rounded text-sm ${
            showMetrics.totalRevenue ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <div className="w-3 h-3 rounded-full bg-blue-600"></div>
          <span>Total Revenue</span>
        </button>
        <button
          onClick={() => toggleMetric('platformFees')}
          className={`flex items-center gap-2 px-3 py-1 rounded text-sm ${
            showMetrics.platformFees ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <div className="w-3 h-3 rounded-full bg-green-600"></div>
          <span>Platform Fees</span>
        </button>
        <button
          onClick={() => toggleMetric('caPayout')}
          className={`flex items-center gap-2 px-3 py-1 rounded text-sm ${
            showMetrics.caPayout ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <div className="w-3 h-3 rounded-full bg-purple-600"></div>
          <span>CA Payout</span>
        </button>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <ChartComponent
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />

          {chartType === 'area' ? (
            <>
              {showMetrics.totalRevenue && (
                <Area
                  type="monotone"
                  dataKey="totalRevenue"
                  name="Total Revenue"
                  stroke="#2563EB"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}
              {showMetrics.platformFees && (
                <Area
                  type="monotone"
                  dataKey="platformFees"
                  name="Platform Fees"
                  stroke="#059669"
                  fill="#10B981"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}
              {showMetrics.caPayout && (
                <Area
                  type="monotone"
                  dataKey="caPayout"
                  name="CA Payout"
                  stroke="#7C3AED"
                  fill="#8B5CF6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )}
            </>
          ) : (
            <>
              {showMetrics.totalRevenue && (
                <Line
                  type="monotone"
                  dataKey="totalRevenue"
                  name="Total Revenue"
                  stroke="#2563EB"
                  strokeWidth={2}
                />
              )}
              {showMetrics.platformFees && (
                <Line
                  type="monotone"
                  dataKey="platformFees"
                  name="Platform Fees"
                  stroke="#059669"
                  strokeWidth={2}
                />
              )}
              {showMetrics.caPayout && (
                <Line
                  type="monotone"
                  dataKey="caPayout"
                  name="CA Payout"
                  stroke="#7C3AED"
                  strokeWidth={2}
                />
              )}
            </>
          )}
        </ChartComponent>
      </ResponsiveContainer>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-blue-50 p-4 rounded">
          <p className="text-sm text-blue-600 font-medium">Total Revenue</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">
            {formatCurrency(totals.totalRevenue)}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded">
          <p className="text-sm text-green-600 font-medium">Platform Fees (10%)</p>
          <p className="text-2xl font-bold text-green-900 mt-1">
            {formatCurrency(totals.platformFees)}
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded">
          <p className="text-sm text-purple-600 font-medium">CA Payout (90%)</p>
          <p className="text-2xl font-bold text-purple-900 mt-1">
            {formatCurrency(totals.caPayout)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RevenueChart;
