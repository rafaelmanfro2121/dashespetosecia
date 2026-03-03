import { LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface MetricCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  isCurrency?: boolean;
  isPercent?: boolean;
  variant?: 'default' | 'success' | 'danger' | 'info' | 'warning';
  subtitle?: string;
}

const variantConfig = {
  default: {
    gradient: 'from-primary/10 to-primary/5',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    border: 'border-l-4 border-l-primary',
  },
  success: {
    gradient: 'from-success/10 to-success/5',
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    border: 'border-l-4 border-l-success',
  },
  danger: {
    gradient: 'from-destructive/10 to-destructive/5',
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
    border: 'border-l-4 border-l-destructive',
  },
  info: {
    gradient: 'from-info/10 to-info/5',
    iconBg: 'bg-info/10',
    iconColor: 'text-info',
    border: 'border-l-4 border-l-info',
  },
  warning: {
    gradient: 'from-amber-500/10 to-amber-500/5',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600',
    border: 'border-l-4 border-l-amber-500',
  },
};

export default function MetricCard({ label, value, icon: Icon, isCurrency = true, isPercent, variant = 'default', subtitle }: MetricCardProps) {
  const display = isPercent ? `${value.toFixed(1)}%` : isCurrency ? formatCurrency(value) : value.toString();
  const config = variantConfig[variant];

  return (
    <div className={`metric-card ${config.border} bg-gradient-to-br ${config.gradient}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center`}>
          <Icon size={20} className={config.iconColor} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{display}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
