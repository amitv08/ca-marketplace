/**
 * MetricCard Component
 * Reusable card for displaying single metrics with optional trend indicators
 */

import React from 'react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'stable';
  };
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
}

const variantStyles = {
  default: 'bg-white border-gray-200',
  success: 'bg-green-50 border-green-200',
  warning: 'bg-yellow-50 border-yellow-200',
  danger: 'bg-red-50 border-red-200',
  info: 'bg-blue-50 border-blue-200',
};

const trendColors = {
  up: 'text-green-600',
  down: 'text-red-600',
  stable: 'text-gray-600',
};

const trendIcons = {
  up: '↑',
  down: '↓',
  stable: '→',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  variant = 'default',
  loading = false,
}) => {
  if (loading) {
    return (
      <div className={`rounded-lg border p-6 ${variantStyles[variant]} animate-pulse`}>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-6 ${variantStyles[variant]} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>

      <div className="mb-2">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>

      <div className="flex items-center justify-between">
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}

        {trend && (
          <div className={`flex items-center text-sm font-medium ${trendColors[trend.direction]}`}>
            <span className="mr-1">{trendIcons[trend.direction]}</span>
            <span>{Math.abs(trend.value).toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * MetricCardGrid Component
 * Grid layout for multiple metric cards
 */
export interface MetricCardGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
}

export const MetricCardGrid: React.FC<MetricCardGridProps> = ({
  children,
  cols = 4,
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[cols]} gap-6`}>
      {children}
    </div>
  );
};

export default MetricCard;
