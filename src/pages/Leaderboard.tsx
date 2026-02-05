import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { CreditsDisplay } from '@/components/ui/CreditsDisplay';
import { Card } from '@/components/ui/card';
import { usePlayer } from '@/contexts/PlayerContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Player } from '@/lib/types';
import { Trophy, Medal, Award } from 'lucide-react';

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading } = usePlayer();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerRank, setPlayerRank] = useState<number>(0);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/');
      return;
    }

    if (tournament && player) {
      loadLeaderboard();
    }
  }, [session, tournament, player, isLoading, navigate]);

  const loadLeaderboard = async () => {
    if (!tournament || !player) return;

    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('tournament_id', tournament.id)
      .eq('status', 'Active')
      .order('credits_balance', { ascending: false });

    setPlayers((data || []) as Player[]);

    // Find player's rank
    const rank = (data || []).findIndex(p => p.id === player.id) + 1;
    setPlayerRank(rank);
  };

  if (isLoading || !player || !tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏆</div>
      </div>
    );
  }

  

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-chaos-orange" />;
    if (index === 1) return <Medal className="h-5 w-5 text-foreground" />;
    if (index === 2) return <Award className="h-5 w-5 text-chaos-orange/70" />;
    return null;
  };

  return (
    <>
      <PageLayout
        header={
          <div className="p-4">
            <h1 className="font-bold text-xl flex items-center gap-2">
              <Trophy className="h-6 w-6 text-chaos-orange" />
              Leaderboard
            </h1>
            <p className="text-sm text-muted-foreground">
              {players.length} players • Your rank: #{playerRank}
            </p>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Current player highlight */}
          {playerRank > 3 && (
            <Card className="chaos-card border-primary/50 p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold">
                  {playerRank}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-primary">{player.full_name} (you)</p>
                  <p className="text-xs text-muted-foreground">
                    {player.match_wins}W - {player.match_losses}L • 
                    Sets: +{player.sets_won - player.sets_lost}
                  </p>
                </div>
                <CreditsDisplay amount={player.credits_balance} variant="compact" />
              </div>
            </Card>
          )}

          {/* Full leaderboard */}
          {players.map((p, index) => (
            <Card
              key={p.id}
              className={`chaos-card p-4 transition-all ${
                p.id === player.id ? 'border-primary/50 shadow-glow-green' : ''
              } ${index < 3 ? 'border-chaos-orange/30' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`
                  h-10 w-10 rounded-full flex items-center justify-center font-bold
                  ${index === 0 ? 'bg-gradient-hot text-white' :
                    index === 1 ? 'bg-muted text-foreground' :
                    index === 2 ? 'bg-chaos-orange/20 text-chaos-orange' :
                    'bg-muted/50 text-muted-foreground'}
                `}>
                  {getRankIcon(index) || (index + 1)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {p.full_name}
                    {p.id === player.id && <span className="text-primary ml-1">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.match_wins}W - {p.match_losses}L • 
                    Sets: {p.sets_won - p.sets_lost >= 0 ? '+' : ''}{p.sets_won - p.sets_lost}
                  </p>
                </div>

                <div className="text-right">
                  <CreditsDisplay amount={p.credits_balance} variant="compact" />
                </div>
              </div>
            </Card>
          ))}

          {players.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🏆</div>
              <p className="text-muted-foreground">No players yet</p>
            </div>
          )}
        </div>
      </PageLayout>

      <BottomNav showAuction={showAuction} />
    </>
  );
}
