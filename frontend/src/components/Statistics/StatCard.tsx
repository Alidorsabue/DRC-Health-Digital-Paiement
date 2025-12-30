'use client';

import React from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'indigo' | 'gray';
  trend?: {
    value: number;
    label: string;
  };
  subtitle?: string;
  progress?: number; // 0-100 pour la barre de progression
}

const colorClasses = {
  blue: {
    bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
    border: 'border-blue-200',
    icon: 'bg-blue-500',
    text: 'text-blue-700',
    value: 'text-blue-900',
    progress: 'bg-blue-500',
  },
  green: {
    bg: 'bg-gradient-to-br from-green-50 to-green-100',
    border: 'border-green-200',
    icon: 'bg-green-500',
    text: 'text-green-700',
    value: 'text-green-900',
    progress: 'bg-green-500',
  },
  red: {
    bg: 'bg-gradient-to-br from-red-50 to-red-100',
    border: 'border-red-200',
    icon: 'bg-red-500',
    text: 'text-red-700',
    value: 'text-red-900',
    progress: 'bg-red-500',
  },
  yellow: {
    bg: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
    border: 'border-yellow-200',
    icon: 'bg-yellow-500',
    text: 'text-yellow-700',
    value: 'text-yellow-900',
    progress: 'bg-yellow-500',
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
    border: 'border-purple-200',
    icon: 'bg-purple-500',
    text: 'text-purple-700',
    value: 'text-purple-900',
    progress: 'bg-purple-500',
  },
  indigo: {
    bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100',
    border: 'border-indigo-200',
    icon: 'bg-indigo-500',
    text: 'text-indigo-700',
    value: 'text-indigo-900',
    progress: 'bg-indigo-500',
  },
  gray: {
    bg: 'bg-gradient-to-br from-gray-50 to-gray-100',
    border: 'border-gray-200',
    icon: 'bg-gray-500',
    text: 'text-gray-700',
    value: 'text-gray-900',
    progress: 'bg-gray-500',
  },
};

export default function StatCard({
  title,
  value,
  icon,
  color = 'gray',
  trend,
  subtitle,
  progress,
}: StatCardProps) {
  const colors = colorClasses[color];

  return (
    <div
      className={`
        ${colors.bg}
        ${colors.border}
        border-2
        rounded-xl
        p-6
        shadow-lg
        hover:shadow-xl
        transition-all
        duration-300
        transform
        hover:-translate-y-1
        relative
        overflow-hidden
      `}
    >
      {/* Effet de brillance animé */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
      </div>

      <div className="relative z-10">
        {/* En-tête avec icône */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={`${colors.icon} p-2.5 rounded-lg shadow-md flex items-center justify-center`}>
                <span className="text-white text-2xl leading-none">{icon}</span>
              </div>
            )}
            <div>
              <h3 className={`${colors.text} text-sm font-semibold uppercase tracking-wide`}>
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          {trend && (
            <div className={`text-xs font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
            </div>
          )}
        </div>

        {/* Valeur principale */}
        <div className="mb-3">
          <div className={`${colors.value} text-4xl font-bold mb-1`}>
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </div>
        </div>

        {/* Barre de progression si fournie */}
        {progress !== undefined && (
          <div className="mt-4">
            <div className="w-full bg-white/50 rounded-full h-2 overflow-hidden">
              <div
                className={`${colors.progress} h-full rounded-full transition-all duration-500 ease-out`}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <div className="text-xs text-gray-600 mt-1">{progress.toFixed(0)}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

