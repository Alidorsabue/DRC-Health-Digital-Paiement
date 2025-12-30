'use client';

import React from 'react';
import StatCard from './StatCard';

interface StatCardGroupProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
}

export default function StatCardGroup({ children, columns = 4 }: StatCardGroupProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-6 mb-8`}>
      {children}
    </div>
  );
}

export { StatCard };

