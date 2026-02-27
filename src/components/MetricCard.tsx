import { LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface MetricCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  isCurrency?: boolean;
  isPercent?: boolean;
  variant?: 'default' | 'success' | 'danger' | 'info';
}

const variantStyles = {
  default: 'border-l-4 border-l-primary',
  success: 'border-l-4 border-l-success',
  danger: 'border-l-4 border-l-destructive',
  info: 'border-l-4 border-l-info',
};

export default function MetricCard({ label, value, icon: Icon, isCurrency = true, isPercent, variant = 'default' }: MetricCardProps) {
  const display = isPercent ? `${value.toFixed(1)}%` : isCurrency ? formatCurrency(value) : value.toString();

  return (
    <div className={`metric-card ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="section-label">{label}</span>
        <Icon size={18} className="text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold tracking-tight">{display}</p>
    </div>
  );
}
