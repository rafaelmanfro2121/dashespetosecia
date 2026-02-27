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

const variantConfig = {
  default: {
    border: 'border-l-4 border-l-primary',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  success: {
    border: 'border-l-4 border-l-success',
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
  },
  danger: {
    border: 'border-l-4 border-l-destructive',
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
  },
  info: {
    border: 'border-l-4 border-l-info',
    iconBg: 'bg-info/10',
    iconColor: 'text-info',
  },
};

export default function MetricCard({ label, value, icon: Icon, isCurrency = true, isPercent, variant = 'default' }: MetricCardProps) {
  const display = isPercent ? `${value.toFixed(1)}%` : isCurrency ? formatCurrency(value) : value.toString();
  const config = variantConfig[variant];

  return (
    <div className={`metric-card ${config.border}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="section-label">{label}</span>
        <div className={`w-9 h-9 rounded-lg ${config.iconBg} flex items-center justify-center`}>
          <Icon size={18} className={config.iconColor} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{display}</p>
    </div>
  );
}
