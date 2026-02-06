import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePledgeStatus } from '@/hooks/usePledgeStatus';
import { PledgeForm } from '@/components/auction/PledgeForm';
import { BottomNav } from '@/components/layout/BottomNav';
import { CheckCircle, Gift, ArrowRight } from 'lucide-react';

export default function CompleteEntryPage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading, refreshPlayer } = usePlayer();
  const { pledgeStatus, refreshPledgeStatus } = usePledgeStatus(player, tournament);
  const [showPledgeForm, setShowPledgeForm] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/');
    }
  }, [isLoading, session, navigate]);

  const handleConfirm = async () => {
    if (!player) return;
    const { supabase } = await import('@/integrations/supabase/client');
    await supabase.from('players').update({ confirmed: true }).eq('id', player.id);
    await refreshPlayer();
  };

  const handlePledgeSaved = () => {
    setShowPledgeForm(false);
    refreshPledgeStatus();
  };

  if (isLoading || !player || !tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🎾</div>
      </div>
    );
  }

  const isConfirmed = player.confirmed;
  const hasPledge = pledgeStatus === 'submitted' || pledgeStatus === 'approved';
  const isComplete = isConfirmed && hasPledge;

  if (showPledgeForm) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto space-y-4">
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">Step 2 of 2</p>
            <h1 className="text-xl font-bold">Add Your Pledge</h1>
            <p className="text-sm text-muted-foreground">
              This becomes a prize in the Auction House. Credits decide who takes it.
            </p>
          </div>
          <PledgeForm
            tournamentId={tournament.id}
            playerId={player.id}
            onSaved={handlePledgeSaved}
            onCancel={() => setShowPledgeForm(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="text-5xl mb-2">{isComplete ? '🎉' : '🎾'}</div>
          <h1 className="text-2xl font-bold text-gradient-primary">
            {isComplete ? "You're all set!" : 'Complete Your Entry'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isComplete
              ? 'Ready for the chaos. See you on court.'
              : 'Two quick steps to get in the game'}
          </p>
        </div>

        {/* Step 1: Confirm */}
        <Card className={`chaos-card transition-all ${isConfirmed ? 'border-primary/30 opacity-80' : 'border-primary/50'}`}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
              isConfirmed ? 'bg-primary/20' : 'bg-muted'
            }`}>
              {isConfirmed ? (
                <CheckCircle className="h-6 w-6 text-primary" />
              ) : (
                <span className="text-lg font-bold text-muted-foreground">1</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{isConfirmed ? 'Participation confirmed' : 'Confirm participation'}</p>
              <p className="text-xs text-muted-foreground">
                {isConfirmed ? "You're in the tournament" : "Let everyone know you're playing"}
              </p>
            </div>
            {!isConfirmed && (
              <Button size="sm" onClick={handleConfirm} className="bg-gradient-primary hover:opacity-90 shrink-0">
                I'm In!
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Pledge */}
        <Card className={`chaos-card transition-all ${hasPledge ? 'border-primary/30 opacity-80' : 'border-chaos-orange/50'}`}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
              hasPledge ? 'bg-primary/20' : 'bg-chaos-orange/20'
            }`}>
              {hasPledge ? (
                <CheckCircle className="h-6 w-6 text-primary" />
              ) : (
                <Gift className="h-6 w-6 text-chaos-orange" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{hasPledge ? 'Pledge submitted' : 'Add your pledge'}</p>
              <p className="text-xs text-muted-foreground">
                {hasPledge
                  ? 'Pending admin approval — you\'re eligible for matches'
                  : 'Required to be scheduled for matches'}
              </p>
            </div>
            {!hasPledge && (
              <Button size="sm" onClick={() => setShowPledgeForm(true)}
                className="bg-gradient-primary hover:opacity-90 shrink-0">
                Add
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Continue */}
        {isComplete ? (
          <Button className="w-full touch-target bg-gradient-primary hover:opacity-90" onClick={() => navigate('/')}>
            Let's Go <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Complete both steps to be scheduled for matches
          </p>
        )}
      </div>
    </div>
  );
}
