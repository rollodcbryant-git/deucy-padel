import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CreditsDisplayProps {
  amount: number;
  className?: string;
  variant?: 'default' | 'large' | 'compact';
  showIcon?: boolean;
  delta?: number;
  rank?: number;
}

export function CreditsDisplay({
  amount,
  className,
  variant = 'default',
  showIcon = true,
  delta,
  rank,
}: CreditsDisplayProps) {
  const formattedAmount = amount.toLocaleString();

  if (variant === 'large') {
    return (
      <div className={cn('flex flex-col items-center', className)}>
        <div className="flex items-baseline gap-2">
          {showIcon && <span className="text-2xl">💰</span>}
          <span className="text-4xl font-bold text-gradient-primary">
            {formattedAmount}
          </span>
        </div>
        <span className="text-sm text-muted-foreground mt-1">credits</span>
        <span className="text-[10px] text-muted-foreground/60">Spend these in the auction</span>
        {rank && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Rank</span>
            <span className="text-lg font-bold text-accent">#{rank}</span>
          </div>
        )}
        {delta !== undefined && delta !== 0 && (
          <DeltaIndicator delta={delta} />
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <span className={cn('inline-flex items-center gap-1 font-semibold', className)}>
        {showIcon && <span className="text-sm">💰</span>}
        <span className="text-primary">{formattedAmount}</span>
      </span>
    );
  }

  // Default variant
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showIcon && <span className="text-lg">💰</span>}
      <div className="flex flex-col">
        <span className="text-xl font-bold text-foreground">{formattedAmount}</span>
        <span className="text-xs text-muted-foreground">credits</span>
      </div>
      {delta !== undefined && delta !== 0 && (
        <DeltaIndicator delta={delta} compact />
      )}
    </div>
  );
}

function DeltaIndicator({ delta, compact }: { delta: number; compact?: boolean }) {
  const isPositive = delta > 0;
  const Icon = isPositive ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  
  return (
    <div
      className={cn(
        'flex items-center gap-1',
        isPositive ? 'text-primary' : 'text-destructive',
        compact ? 'text-xs' : 'text-sm mt-1'
      )}
    >
      <Icon className={cn(compact ? 'h-3 w-3' : 'h-4 w-4')} />
      <span className="font-medium">
        {isPositive ? '+' : ''}{delta}
      </span>
    </div>
  );
}
