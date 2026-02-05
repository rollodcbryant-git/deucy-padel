import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { CreditsDisplay } from '@/components/ui/CreditsDisplay';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { Card } from '@/components/ui/card';
import { PodiumSection } from '@/components/leaderboard/PodiumSection';
import { usePlayer } from '@/contexts/PlayerContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Player } from '@/lib/types';
import { Trophy } from 'lucide-react';

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
            <p className="text-xs text-muted-foreground/70 mt-1">💡 € balance decides the auction</p>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Top 3 Podium */}
          <PodiumSection players={players} currentPlayerId={player.id} />

          {/* Divider */}
          {players.length > 3 && (
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">Full Standings</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {/* Current player highlight if outside top 3 */}
          {playerRank > 3 && (
            <Card
              className="chaos-card border-primary/50 p-4 cursor-pointer"
              onClick={() => navigate(`/player/${player.id}`)}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold">
                  {playerRank}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-primary">{player.full_name} (you)</p>
                  <p className="text-xs text-muted-foreground">
                    {player.match_wins}W - {player.match_losses}L • Sets: +{player.sets_won - player.sets_lost}
                  </p>
                </div>
                <CreditsDisplay amount={player.credits_balance} variant="compact" />
              </div>
            </Card>
          )}

          {/* Full list from #4 onwards */}
          {players.slice(3).map((p, idx) => {
            const index = idx + 3;
            return (
              <Card
                key={p.id}
                className={`chaos-card p-4 transition-all cursor-pointer ${
                  p.id === player.id ? 'border-primary/50 shadow-glow-green' : ''
                }`}
                onClick={() => navigate(`/player/${p.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center font-bold text-muted-foreground">
                    {index + 1}
                  </div>
                  <PlayerAvatar player={p} className="h-8 w-8" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {p.full_name}
                      {p.id === player.id && <span className="text-primary ml-1">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.match_wins}W - {p.match_losses}L • Sets: {p.sets_won - p.sets_lost >= 0 ? '+' : ''}{p.sets_won - p.sets_lost}
                    </p>
                  </div>
                  <CreditsDisplay amount={p.credits_balance} variant="compact" />
                </div>
              </Card>
            );
          })}

          {players.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🏆</div>
              <p className="text-muted-foreground">No players yet</p>
            </div>
          )}
        </div>
      </PageLayout>
      <BottomNav />
    </>
  );
}
