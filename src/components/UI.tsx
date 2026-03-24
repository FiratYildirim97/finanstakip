import React from 'react';
import { cn } from '../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, children, className, ...props }) => {
  return (
    <div className={cn("bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm", className)} {...props}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>}
          {subtitle && <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};

export const StatCard: React.FC<{ title: string; value: string; trend?: { value: string; positive: boolean }; icon?: React.ReactNode; className?: string }> = ({ title, value, trend, icon, className }) => {
  return (
    <Card className={cn("flex flex-col justify-between", className)}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
          <h4 className="text-2xl font-bold mt-1 text-zinc-900 dark:text-zinc-100">{value}</h4>
        </div>
        {icon && <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300">{icon}</div>}
      </div>
      {trend && (
        <div className={cn("mt-4 text-sm font-medium flex items-center gap-1", trend.positive ? "text-emerald-600" : "text-rose-600")}>
          {trend.positive ? "↑" : "↓"} {trend.value}
          <span className="text-zinc-400 font-normal ml-1">geçen aya göre</span>
        </div>
      )}
    </Card>
  );
};
