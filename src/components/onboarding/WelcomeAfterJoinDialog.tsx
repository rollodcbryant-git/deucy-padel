import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarClock, Trophy, Gift, TrendingUp } from 'lucide-react';

interface WelcomeAfterJoinDialogProps {
  open: boolean;
  onClose: () => void;
  tournamentName: string;
  tournamentStatus: string;
}

export function WelcomeAfterJoinDialog({ open, onClose, tournamentName, tournamentStatus }: WelcomeAfterJoinDialogProps) {
  const isPreStart = tournamentStatus === 'SignupOpen';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm p-0 border-0 bg-transparent shadow-none [&>button]:hidden">
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="bg-gradient-to-br from-primary to-accent p-8 flex flex-col items-center justify-center min-h-[160px]">
            <span className="text-6xl mb-2">🎉</span>
          </div>
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-foreground text-center">
              You're in {tournamentName}!
            </h2>

            {isPreStart ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  The tournament hasn't started yet. Here's what to expect:
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 text-xs">
                    <CalendarClock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground"><strong className="text-foreground">Matches</strong> will appear once the organizer starts the tournament</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs">
                    <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground"><strong className="text-foreground">Your € balance</strong> starts when the first round begins</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs">
                    <Gift className="h-4 w-4 text-chaos-orange shrink-0 mt-0.5" />
                    <span className="text-muted-foreground"><strong className="text-foreground">Add a pledge</strong> now to be eligible for match scheduling</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs">
                    <Trophy className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span className="text-muted-foreground"><strong className="text-foreground">Leaderboard & auction</strong> unlock as the tournament progresses</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                The tournament is live! Check the Matches tab to see your upcoming games.
              </p>
            )}

            <Button onClick={onClose} className="w-full touch-target bg-gradient-primary hover:opacity-90 text-primary-foreground">
              Got it! 🎾
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
