import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { ShoppingBag } from 'lucide-react';
import type { PledgeItem } from '@/lib/types';

interface RoundPledgeSectionProps {
  currentPlayerPledge?: PledgeItem;
  tournamentId: string;
  playerId: string;
  onPledgeSaved: () => void;
}

const categoryEmoji: Record<string, string> = {
  food: '🍕',
  drink: '🍷',
  object: '🎁',
  service: '💆',
  chaos: '🎲',
};

export function RoundPledgeSection({
  currentPlayerPledge,
  onPledgeSaved,
}: RoundPledgeSectionProps) {
  const navigate = useNavigate();

  if (currentPlayerPledge) {
    const isApproved = currentPlayerPledge.status === 'Approved';
    return (
      <div className="pt-2 border-t border-border space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Pledge</p>
        <button
          onClick={() => navigate(`/pledge/${currentPlayerPledge.id}`)}
          className="w-full flex items-center gap-3 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        >
          {currentPlayerPledge.image_url && (
            <img
              src={currentPlayerPledge.image_url}
              alt=""
              className="h-10 w-10 rounded-lg object-cover shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {categoryEmoji[currentPlayerPledge.category] || '🧾'} {currentPlayerPledge.title}
            </p>
          </div>
          <StatusChip
            variant={isApproved ? 'success' : 'info'}
            size="sm"
          >
            {currentPlayerPledge.status}
          </StatusChip>
        </button>
        <button
          onClick={() => navigate('/auction')}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mx-auto"
        >
          <ShoppingBag className="h-3 w-3" /> View Auction House
        </button>
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-border space-y-2">
      <Button
        onClick={() => navigate('/auction')}
        variant="outline"
        className="w-full touch-target"
      >
        <ShoppingBag className="mr-2 h-4 w-4" />
        View Auction House
      </Button>
    </div>
  );
}
