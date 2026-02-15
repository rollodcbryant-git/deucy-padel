import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Gavel, Gift, Eye } from 'lucide-react';

interface AuctionIntroModalProps {
  open: boolean;
  hasPledged: boolean;
  onViewGallery: () => void;
  onAddPledge: () => void;
  onSkip: () => void;
  onDontShowAgain?: () => void;
}

export function AuctionIntroModal({ open, hasPledged, onViewGallery, onAddPledge, onSkip, onDontShowAgain }: AuctionIntroModalProps) {
  const [dontShow, setDontShow] = useState(false);

  const handleAction = (action: () => void) => {
    if (dontShow && onDontShowAgain) {
      onDontShowAgain();
    }
    action();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
            <Gavel className="h-5 w-5 text-chaos-orange" />
            Welcome to the Auction House
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Eye className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Gallery of pledges</p>
                <p className="text-xs text-muted-foreground">Browse what everyone's bringing to the chaos</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Gavel className="h-5 w-5 text-chaos-orange mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Live auction after the tournament</p>
                <p className="text-xs text-muted-foreground">Spend your hard-earned credits on prizes</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Gift className="h-5 w-5 text-chaos-purple mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Add your pledge (required)</p>
                <p className="text-xs text-muted-foreground">Your item becomes a biddable prize later</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="dont-show"
              checked={dontShow}
              onCheckedChange={(checked) => setDontShow(checked === true)}
            />
            <label htmlFor="dont-show" className="text-xs text-muted-foreground cursor-pointer">
              Don't show this again
            </label>
          </div>

          <div className="flex flex-col gap-2">
            {!hasPledged && (
              <Button onClick={() => handleAction(onAddPledge)} className="w-full touch-target bg-gradient-primary hover:opacity-90">
                <Gift className="h-4 w-4 mr-2" />
                Add my pledge
              </Button>
            )}
            <Button onClick={() => handleAction(onViewGallery)} variant={hasPledged ? 'default' : 'outline'} className={`w-full touch-target ${hasPledged ? 'bg-gradient-primary hover:opacity-90' : ''}`}>
              View Auction House
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleAction(onSkip)}>
              Skip
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
