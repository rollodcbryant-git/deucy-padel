import { Card, CardContent } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatEuros } from '@/lib/euros';
import type { PledgeItem, Player } from '@/lib/types';

interface PledgeCardProps {
  pledge: PledgeItem;
  pledger?: Player;
  isOwner?: boolean;
  roundIndex?: number;
  onClick?: () => void;
}

const categoryConfig: Record<string, { emoji: string; label: string; color: string }> = {
  food: { emoji: '🍕', label: 'Food', color: 'bg-chaos-orange/20 text-chaos-orange border-chaos-orange/30' },
  drink: { emoji: '🍷', label: 'Drink', color: 'bg-chaos-purple/20 text-chaos-purple border-chaos-purple/30' },
  object: { emoji: '🎁', label: 'Object', color: 'bg-primary/20 text-primary border-primary/30' },
  service: { emoji: '💆', label: 'Service', color: 'bg-accent/20 text-accent border-accent/30' },
  chaos: { emoji: '🎲', label: 'Chaos', color: 'bg-chaos-pink/20 text-chaos-pink border-chaos-pink/30' },
};

export function getCategoryConfig(category: string) {
  return categoryConfig[category] || { emoji: '📦', label: category, color: 'bg-muted text-muted-foreground border-border' };
}

function formatEstimate(low: number | null, high: number | null): string | null {
  if (low != null && high != null && low !== high) return `${formatEuros(low)}–${formatEuros(high)}`;
  if (low != null) return formatEuros(low);
  if (high != null) return formatEuros(high);
  return null;
}

export function PledgeCard({ pledge, pledger, isOwner, roundIndex, onClick }: PledgeCardProps) {
  const cat = getCategoryConfig(pledge.category);
  const estimate = formatEstimate(pledge.estimate_low, pledge.estimate_high);
  const priceLabel = (pledge as any).price_euro ? formatEuros((pledge as any).price_euro) : 'TBD';
  const isPending = pledge.status === 'Draft';

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:border-primary/40 transition-all group"
      onClick={onClick}
    >
      {/* Image */}
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {pledge.image_url ? (
          <img
            src={pledge.image_url}
            alt={pledge.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-5xl opacity-40">
            {cat.emoji}
          </div>
        )}

        {/* Category chip overlay */}
        <span className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium backdrop-blur-sm ${cat.color}`}>
          {cat.emoji} {cat.label}
        </span>

        {isPending && isOwner && (
          <div className="absolute top-2 right-2">
            <StatusChip variant="warning" size="sm">Pending</StatusChip>
          </div>
        )}

        {roundIndex != null && (
          <span className="absolute bottom-2 right-2 inline-flex items-center rounded-full bg-background/80 backdrop-blur-sm border border-border px-2 py-0.5 text-[10px] font-bold text-foreground">
            R{roundIndex}
          </span>
        )}

        {!estimate && pledge.status !== 'Draft' && (
          <span className="absolute top-2 right-2 inline-flex items-center rounded-full bg-muted/80 backdrop-blur-sm px-2 py-0.5 text-[10px] text-muted-foreground">
            Pending estimate
          </span>
        )}
      </div>

      <CardContent className="p-3 space-y-1.5">
        <p className="font-semibold text-sm truncate">{pledge.title}</p>

        <p className="text-xs text-muted-foreground truncate">
          by <span className="hover:text-primary transition-colors">{pledger?.full_name || 'Unknown'}</span>
        </p>

        <div className="space-y-0.5">
          <div>
            <p className="text-[10px] text-muted-foreground leading-tight">Expert estimate</p>
            <p className="text-xs font-medium text-primary">{estimate || 'TBD'}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground leading-tight">Price</p>
            <p className="text-xs font-medium text-primary">{priceLabel}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
