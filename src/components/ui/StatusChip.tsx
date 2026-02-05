import { cn } from '@/lib/utils';

type ChipVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'live' | 'ended';

interface StatusChipProps {
  variant: ChipVariant;
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

const variantStyles: Record<ChipVariant, string> = {
  success: 'bg-primary/20 text-primary border-primary/30',
  warning: 'bg-chaos-orange/20 text-chaos-orange border-chaos-orange/30',
  error: 'bg-destructive/20 text-destructive border-destructive/30',
  info: 'bg-accent/20 text-accent border-accent/30',
  neutral: 'bg-muted text-muted-foreground border-border',
  live: 'bg-primary/20 text-primary border-primary/30',
  ended: 'bg-muted text-muted-foreground border-border',
};

export function StatusChip({ variant, children, className, pulse = false }: StatusChipProps) {
  return (
    <span
      className={cn(
        'status-chip border',
        variantStyles[variant],
        pulse && variant === 'live' && 'animate-pulse',
        className
      )}
    >
      {variant === 'live' && (
        <span className="mr-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
      )}
      {children}
    </span>
  );
}
