/**
 * CAUtilizationChart Component
 * Bar chart visualization of CA utilization rates
 */

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export interface CAUtilizationData {
  caId: string;
  caName: string;
  totalHours: number;
  bookedHours: number;
  utilizationRate: number;
  revenue: number;
  requestsCompleted: number;
  averageRating: number;
}

export interface CAUtilizationChartProps {
  data: CAUtilizationData[];
  loading?: boolean;
  maxCAs?: number;
}

export const CAUtilizationChart: React.FC<CAUtilizationChartProps> = ({
  data,
  loading = false,
  maxCAs = 10,
}) => {
  const [sortBy, setSortBy] = useState<'utilization' | 'revenue' | 'rating'>('utilization');

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
        <p className="text-gray-400">Loading utilization data...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-gray-400">No utilization data available</p>
      </div>
    );
  }

  // Sort and limit data
  const sortedData = [...data]
    .sort((a, b) => {
      switch (sortBy) {
        case 'utilization':
          return b.utilizationRate - a.utilizationRate;
        case 'revenue':
          return b.revenue - a.revenue;
        case 'rating':
          return b.averageRating - a.averageRating;
        default:
          return 0;
      }
    })
    .slice(0, maxCAs);

  // Calculate average utilization
  const avgUtilization = data.reduce((sum, ca) => sum + ca.utilizationRate, 0) / data.length;

  // Get color based on utilization rate
  const getColor = (rate: number) => {
    if (rate >= 80) return '#10B981'; // Green - High utilization
    if (rate >= 60) return '#3B82F6'; // Blue - Good utilization
    if (rate >= 40) return '#F59E0B'; // Yellow - Moderate utilization
    return '#EF4444'; // Red - Low utilization
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded shadow-lg max-w-xs">
          <p className="font-semibold text-gray-900 mb-2">{data.caName}</p>
          <div className="space-y-1 text-sm">
            <p className="text-gray-600">
              Utilization: <span className="font-medium text-blue-600">
                {data.utilizationRate.toFixed(1)}%
              </span>
            </p>
            <p className="text-gray-600">
              Hours: <span className="font-medium">{data.bookedHours}</span> / {data.totalHours}
            </p>
            <p className="text-gray-600">
              Revenue: <span className="font-medium">{formatCurrency(data.revenue)}</span>
            </p>
            <p className="text-gray-600">
              Requests: <span className="font-medium">{data.requestsCompleted}</span>
            </p>
            <p className="text-gray-600">
              Rating: <span className="font-medium">{data.averageRating.toFixed(1)} ⭐</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">CA Utilization Rates</h3>
          <p className="text-sm text-gray-600 mt-1">
            Average utilization: <span className="font-medium text-blue-600">
              {avgUtilization.toFixed(1)}%
            </span>
            {' '} | Top {sortedData.length} CAs
          </p>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="utilization">Utilization</option>
            <option value="revenue">Revenue</option>
            <option value="rating">Rating</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={sortedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="caName"
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            label={{ value: 'Utilization Rate (%)', angle: -90, position: 'insideLeft' }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="utilizationRate" radius={[8, 8, 0, 0]}>
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.utilizationRate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Utilization bands legend */}
      <div className="flex flex-wrap gap-4 mt-6 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-600"></div>
          <span className="text-sm text-gray-600">High (≥80%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-600"></div>
          <span className="text-sm text-gray-600">Good (60-79%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-600"></div>
          <span className="text-sm text-gray-600">Moderate (40-59%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-600"></div>
          <span className="text-sm text-gray-600">Low (&lt;40%)</span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-xs text-gray-600">Total CAs</p>
          <p className="text-lg font-semibold text-gray-900">{data.length}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-xs text-gray-600">Avg Utilization</p>
          <p className="text-lg font-semibold text-gray-900">{avgUtilization.toFixed(1)}%</p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-xs text-gray-600">Total Revenue</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatCurrency(data.reduce((sum, ca) => sum + ca.revenue, 0))}
          </p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-xs text-gray-600">Avg Rating</p>
          <p className="text-lg font-semibold text-gray-900">
            {(data.reduce((sum, ca) => sum + ca.averageRating, 0) / data.length).toFixed(1)} ⭐
          </p>
        </div>
      </div>
    </div>
  );
};

export default CAUtilizationChart;
