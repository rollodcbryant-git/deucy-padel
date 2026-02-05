import { cn } from '@/lib/utils';
import { formatEuros } from '@/lib/euros';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CreditsDisplayProps {
  amount: number; // in cents
  className?: string;
  variant?: 'default' | 'large' | 'compact';
  showIcon?: boolean;
  delta?: number; // in cents
  rank?: number;
  showDecimals?: boolean;
  showDisclaimer?: boolean;
}

export function CreditsDisplay({
  amount,
  className,
  variant = 'default',
  showIcon = true,
  delta,
  rank,
  showDecimals = false,
  showDisclaimer = false,
}: CreditsDisplayProps) {
  const formatted = formatEuros(amount, showDecimals);

  const disclaimer = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px] text-center">
          <p className="text-xs">In-app € balance only — no real money.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (variant === 'large') {
    return (
      <div className={cn('flex flex-col items-center', className)}>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-gradient-primary">
            {formatted}
          </span>
          {showDisclaimer && disclaimer}
        </div>
        <span className="text-sm text-muted-foreground mt-1">balance</span>
        <span className="text-[10px] text-muted-foreground/60">Spend this in the auction</span>
        {rank != null && rank > 0 && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-sm text-muted-foreground">Rank</span>
            <span className="text-lg font-bold text-accent">#{rank}</span>
          </div>
        )}
        {delta !== undefined && delta !== 0 && (
          <DeltaIndicator delta={delta} showDecimals={showDecimals} />
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <span className={cn('inline-flex items-center gap-1 font-semibold', className)}>
        <span className="text-primary">{formatted}</span>
      </span>
    );
  }

  // Default variant
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex flex-col">
        <span className="text-xl font-bold text-foreground">{formatted}</span>
        <span className="text-xs text-muted-foreground">balance</span>
      </div>
      {showDisclaimer && disclaimer}
      {delta !== undefined && delta !== 0 && (
        <DeltaIndicator delta={delta} compact showDecimals={showDecimals} />
      )}
    </div>
  );
}

function DeltaIndicator({ delta, compact, showDecimals }: { delta: number; compact?: boolean; showDecimals?: boolean }) {
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
        {isPositive ? '+' : ''}{formatEuros(delta, showDecimals)}
      </span>
    </div>
  );
}
