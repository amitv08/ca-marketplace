/**
 * FunnelChart Component
 * Visualization of user acquisition funnel with conversion rates
 */

import React from 'react';
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

export interface FunnelData {
  registrations: number;
  verifiedUsers: number;
  firstRequest: number;
  firstPayment: number;
  repeatCustomers: number;
  conversionRates: {
    registrationToVerified: number;
    verifiedToRequest: number;
    requestToPayment: number;
    paymentToRepeat: number;
    overallConversion: number;
  };
}

export interface FunnelChartProps {
  data: FunnelData;
  loading?: boolean;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const FunnelChart: React.FC<FunnelChartProps> = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
        <p className="text-gray-400">Loading funnel data...</p>
      </div>
    );
  }

  // Transform data for funnel visualization
  const funnelStages = [
    {
      stage: 'Registrations',
      users: data.registrations,
      percentage: 100,
      dropOff: 0,
    },
    {
      stage: 'Verified',
      users: data.verifiedUsers,
      percentage: data.registrations > 0 ? (data.verifiedUsers / data.registrations) * 100 : 0,
      dropOff: data.registrations - data.verifiedUsers,
    },
    {
      stage: 'First Request',
      users: data.firstRequest,
      percentage: data.registrations > 0 ? (data.firstRequest / data.registrations) * 100 : 0,
      dropOff: data.verifiedUsers - data.firstRequest,
    },
    {
      stage: 'First Payment',
      users: data.firstPayment,
      percentage: data.registrations > 0 ? (data.firstPayment / data.registrations) * 100 : 0,
      dropOff: data.firstRequest - data.firstPayment,
    },
    {
      stage: 'Repeat Customers',
      users: data.repeatCustomers,
      percentage: data.registrations > 0 ? (data.repeatCustomers / data.registrations) * 100 : 0,
      dropOff: data.firstPayment - data.repeatCustomers,
    },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded shadow-lg">
          <p className="font-semibold text-gray-900">{data.stage}</p>
          <p className="text-sm text-gray-600 mt-1">
            Users: <span className="font-medium">{data.users.toLocaleString()}</span>
          </p>
          <p className="text-sm text-gray-600">
            Retention: <span className="font-medium">{data.percentage.toFixed(1)}%</span>
          </p>
          {data.dropOff > 0 && (
            <p className="text-sm text-red-600">
              Drop-off: <span className="font-medium">{data.dropOff.toLocaleString()}</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">User Acquisition Funnel</h3>
        <p className="text-sm text-gray-600">
          Overall conversion rate: <span className="font-medium text-blue-600">
            {data.conversionRates.overallConversion.toFixed(1)}%
          </span>
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={funnelStages}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" />
          <YAxis type="category" dataKey="stage" />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="users" radius={[0, 8, 8, 0]}>
            {funnelStages.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Conversion rate details */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-xs text-gray-600">Reg → Verified</p>
          <p className="text-lg font-semibold text-gray-900">
            {data.conversionRates.registrationToVerified.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-xs text-gray-600">Verified → Request</p>
          <p className="text-lg font-semibold text-gray-900">
            {data.conversionRates.verifiedToRequest.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-xs text-gray-600">Request → Payment</p>
          <p className="text-lg font-semibold text-gray-900">
            {data.conversionRates.requestToPayment.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-xs text-gray-600">Payment → Repeat</p>
          <p className="text-lg font-semibold text-gray-900">
            {data.conversionRates.paymentToRepeat.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default FunnelChart;
