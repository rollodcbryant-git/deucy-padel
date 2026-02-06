import { cn } from '@/lib/utils';
import type { PledgeItem } from '@/lib/types';

interface PledgeIndicatorProps {
  pledge?: PledgeItem;
  className?: string;
}

const categoryEmoji: Record<string, string> = {
  food: '🍕',
  drink: '🍷',
  object: '🎁',
  service: '💆',
  chaos: '🎲',
};

export function PledgeIndicator({ pledge, className }: PledgeIndicatorProps) {
  if (!pledge) {
    return (
      <span className={cn(
        'inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20',
        className,
      )}>
        Missing
      </span>
    );
  }

  const isApproved = pledge.status === 'Approved';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border',
        isApproved
          ? 'bg-primary/10 text-primary border-primary/20'
          : 'bg-accent/10 text-accent-foreground border-accent/20',
        className,
      )}
      title={`${pledge.title} (${pledge.status})`}
    >
      {pledge.image_url && (
        <img
          src={pledge.image_url}
          alt=""
          className="h-3 w-3 rounded-full object-cover"
        />
      )}
      <span>{categoryEmoji[pledge.category] || '🧾'}</span>
      {isApproved && <span>✓</span>}
    </span>
  );
}
