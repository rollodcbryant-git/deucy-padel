import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap, Swords, Trophy } from 'lucide-react';

interface TournamentStartedDialogProps {
  open: boolean;
  onClose: () => void;
  tournamentName: string;
}

export function TournamentStartedDialog({ open, onClose, tournamentName }: TournamentStartedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader className="items-center">
          <div className="text-5xl mb-2">🔥</div>
          <DialogTitle className="text-xl">{tournamentName} is Live!</DialogTitle>
          <DialogDescription className="space-y-2 text-sm">
            <p>The tournament you joined has started. Your matches are ready!</p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-left text-xs text-muted-foreground">
          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
            <Swords className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <span>Check the <strong>Matches</strong> tab to see your opponents and deadlines</span>
          </div>
          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
            <Zap className="h-4 w-4 mt-0.5 text-chaos-orange shrink-0" />
            <span>Place <strong>bets</strong> on other matches to earn bonus €</span>
          </div>
          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
            <Trophy className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <span>Track your ranking on the <strong>Leaderboard</strong></span>
          </div>
        </div>

        <Button className="w-full mt-2 bg-gradient-primary" onClick={onClose}>
          Let's go! 🎾
        </Button>
      </DialogContent>
    </Dialog>
  );
}
