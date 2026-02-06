import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface EuroDisclaimerProps {
  variant?: 'inline' | 'tooltip' | 'both';
  className?: string;
}

export function EuroDisclaimer({ variant = 'both', className }: EuroDisclaimerProps) {
  const inlineText = (
    <span className={cn('text-[10px] text-muted-foreground/60 leading-tight', className)}>
      € = in-app points (not real money)
    </span>
  );

  const tooltipIcon = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-muted-foreground/40 cursor-help inline-block ml-1" />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px] text-center">
          <p className="text-xs">In-app € balance only — no real money involved.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (variant === 'inline') return inlineText;
  if (variant === 'tooltip') return tooltipIcon;
  return (
    <span className="inline-flex items-center gap-0.5">
      {inlineText}
      {tooltipIcon}
    </span>
  );
}
