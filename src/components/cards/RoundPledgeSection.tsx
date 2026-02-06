import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PledgeForm } from '@/components/auction/PledgeForm';
import { Gift, ShoppingBag } from 'lucide-react';
import type { PledgeItem, Tournament } from '@/lib/types';

interface RoundPledgeSectionProps {
  currentPlayerPledge?: PledgeItem;
  tournamentId: string;
  playerId: string;
  roundId: string;
  tournament?: Tournament;
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
  tournamentId,
  playerId,
  roundId,
  tournament,
  onPledgeSaved,
}: RoundPledgeSectionProps) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const handleSaved = () => {
    setShowModal(false);
    onPledgeSaved();
  };

  if (currentPlayerPledge) {
    const isApproved = currentPlayerPledge.status === 'Approved';
    return (
      <div className="pt-2 border-t border-border space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Round Pledge</p>
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
            {currentPlayerPledge.status === 'Draft' ? 'Pending' : currentPlayerPledge.status}
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
    <>
      <div className="pt-2 border-t border-border space-y-2">
        <Button
          onClick={() => setShowModal(true)}
          className="w-full touch-target bg-gradient-primary hover:opacity-90"
        >
          <Gift className="mr-2 h-5 w-5" />
          Submit Round Pledge
        </Button>
        <p className="text-[10px] text-muted-foreground text-center leading-tight">
          Required to stay eligible this round
        </p>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Round Pledge</DialogTitle>
          </DialogHeader>
          <PledgeForm
            tournamentId={tournamentId}
            playerId={playerId}
            roundId={roundId}
            onSaved={handleSaved}
            onCancel={() => setShowModal(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
