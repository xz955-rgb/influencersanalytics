import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  type?: 'currency' | 'percent' | 'number';
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({ title, value, type = 'number', color = 'indigo', onClick }) => {
  const formattedValue = type === 'currency' 
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))
    : type === 'percent'
    ? `${Number(value).toFixed(2)}`
    : value;

  const colorClasses: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <div 
      onClick={onClick}
      className={`p-4 rounded-xl border ${colorClasses[color] || colorClasses.indigo} shadow-sm transition-all hover:-translate-y-1 ${onClick ? 'cursor-pointer hover:shadow-md ring-2 ring-transparent hover:ring-indigo-100' : ''}`}
    >
      <p className="text-sm font-medium opacity-80 mb-1">{title}</p>
      <h3 className="text-2xl font-bold">{formattedValue}</h3>
    </div>
  );
};