import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { CreditsDisplay } from '@/components/ui/CreditsDisplay';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  const [viewMode, setViewMode] = useState<'balance' | 'sets'>('balance');

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
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏆</div>
      </div>
    );
  }

  if (!player || !tournament) {
    return (
      <>
        <PageLayout hasBottomNav={true}>
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl">🏆</div>
            <p className="font-semibold">No active tournament</p>
            <p className="text-sm text-muted-foreground">Join a tournament to see the leaderboard</p>
            <Button variant="outline" onClick={() => navigate('/tournaments')} className="mt-2">Browse Tournaments</Button>
          </div>
        </PageLayout>
        <BottomNav />
      </>
    );
  }

  // Sort players based on view mode
  const sorted = [...players].sort((a, b) =>
    viewMode === 'sets' ? b.sets_won - a.sets_won : b.credits_balance - a.credits_balance
  );
  const currentRank = sorted.findIndex(p => p.id === player.id) + 1;

  return (
    <>
      <PageLayout
        header={
          <div className="p-4 space-y-3">
            <h1 className="font-bold text-xl flex items-center gap-2">
              <Trophy className="h-6 w-6 text-chaos-orange" />
              Leaderboard
            </h1>
            <p className="text-sm text-muted-foreground">
              {sorted.length} players • Your rank: #{currentRank}
            </p>

            {/* View mode toggle */}
            <div className="flex items-center gap-3">
              <Label htmlFor="view-toggle" className={`text-xs font-medium ${viewMode === 'balance' ? 'text-foreground' : 'text-muted-foreground'}`}>
                € Balance
              </Label>
              <Switch
                id="view-toggle"
                checked={viewMode === 'sets'}
                onCheckedChange={(checked) => setViewMode(checked ? 'sets' : 'balance')}
              />
              <Label htmlFor="view-toggle" className={`text-xs font-medium ${viewMode === 'sets' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Sets Won
              </Label>
            </div>

            {viewMode === 'balance' && (
              <p className="text-xs text-muted-foreground/70">💡 € balance decides the auction · <span className="text-muted-foreground/50">not real money</span></p>
            )}
            {viewMode === 'sets' && (
              <p className="text-xs text-muted-foreground/70">🎾 Sets won determines finals qualification</p>
            )}
          </div>
        }
      >
        <div className="space-y-3">
          {viewMode === 'balance' && (
            <>
              {/* Top 3 Podium - balance mode only */}
              <PodiumSection players={sorted} currentPlayerId={player.id} />

              {sorted.length > 3 && (
                <div className="flex items-center gap-3 pt-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">Full Standings</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
            </>
          )}

          {/* Current player highlight if outside top 3 */}
          {currentRank > 3 && viewMode === 'balance' && (
            <Card
              className="chaos-card border-primary/50 p-4 cursor-pointer"
              onClick={() => navigate(`/player/${player.id}`)}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold">
                  {currentRank}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-primary">{player.full_name} (you)</p>
                  <p className="text-xs text-muted-foreground">
                    {player.match_wins}W - {player.match_losses}L • Sets Won: {player.sets_won}
                  </p>
                </div>
                <CreditsDisplay amount={player.credits_balance} variant="compact" />
              </div>
            </Card>
          )}

          {/* Player list */}
          {(viewMode === 'sets' ? sorted : sorted.slice(3)).map((p, idx) => {
            const rankNum = viewMode === 'sets' ? idx + 1 : idx + 4;
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
                    {rankNum}
                  </div>
                  <PlayerAvatar player={p} className="h-8 w-8" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {p.full_name}
                      {p.id === player.id && <span className="text-primary ml-1">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {viewMode === 'sets'
                        ? `Sets Won: ${p.sets_won}`
                        : `${p.match_wins}W - ${p.match_losses}L • Sets Won: ${p.sets_won}`
                      }
                    </p>
                  </div>
                  {viewMode === 'balance' ? (
                    <CreditsDisplay amount={p.credits_balance} variant="compact" />
                  ) : (
                    <span className="text-lg font-bold text-primary">{p.sets_won}</span>
                  )}
                </div>
              </Card>
            );
          })}

          {sorted.length === 0 && (
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
