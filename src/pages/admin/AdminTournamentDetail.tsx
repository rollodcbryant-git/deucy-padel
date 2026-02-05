import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { Tournament, Player, Round, Match, PledgeItem } from '@/lib/types';
import { ArrowLeft, Loader2, RefreshCw, Settings, Users, Calendar, Swords, Coins, Gift, Gavel, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import AdminSetupSection from './sections/AdminSetupSection';
import AdminRosterSection from './sections/AdminRosterSection';
import AdminRoundsSection from './sections/AdminRoundsSection';
import AdminMatchesSection from './sections/AdminMatchesSection';
import AdminCreditsSection from './sections/AdminCreditsSection';
import AdminPledgesSection from './sections/AdminPledgesSection';
import AdminAuctionSection from './sections/AdminAuctionSection';
import AdminUtilitiesSection from './sections/AdminUtilitiesSection';

export default function AdminTournamentDetail() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [pledges, setPledges] = useState<PledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => { loadData(); }, [tournamentId]);

  const loadData = async () => {
    if (!tournamentId) return;
    try {
      const [tRes, pRes, rRes, mRes, plRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
        supabase.from('players').select('*').eq('tournament_id', tournamentId).order('credits_balance', { ascending: false }),
        supabase.from('rounds').select('*').eq('tournament_id', tournamentId).order('index', { ascending: true }),
        supabase.from('matches').select('*').eq('tournament_id', tournamentId).order('created_at', { ascending: false }),
        supabase.from('pledge_items').select('*').eq('tournament_id', tournamentId).order('created_at', { ascending: false }),
      ]);
      if (tRes.error) throw tRes.error;
      setTournament(tRes.data as Tournament);
      setPlayers((pRes.data || []) as Player[]);
      setRounds((rRes.data || []) as Round[]);
      setMatches((mRes.data || []) as Match[]);
      setPledges((plRes.data || []) as PledgeItem[]);
    } catch (error) {
      console.error('Error loading tournament:', error);
      toast({ title: 'Error', description: 'Failed to load tournament data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const callEngine = async (action: string, extra = {}) => {
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('tournament-engine', {
        body: { action, tournament_id: tournamentId, ...extra },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Done!', description: JSON.stringify(data).slice(0, 100) });
      await loadData();
      return data;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Live': return 'live' as const;
      case 'SignupOpen': return 'success' as const;
      case 'AuctionLive': return 'warning' as const;
      case 'Finished': case 'Closed': return 'ended' as const;
      default: return 'neutral' as const;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Tournament not found</p>
      </div>
    );
  }

  const confirmed = players.filter(p => p.confirmed && p.status !== 'Removed').length;
  const liveRound = rounds.find(r => r.status === 'Live');

  const sections = [
    { id: 'setup', icon: Settings, label: 'Setup', badge: tournament.status },
    { id: 'roster', icon: Users, label: 'Roster', badge: `${confirmed}/${players.length}` },
    { id: 'rounds', icon: Calendar, label: 'Rounds', badge: `${rounds.length}` },
    { id: 'matches', icon: Swords, label: 'Matches', badge: liveRound ? `R${liveRound.index}` : '—' },
    { id: 'credits', icon: Coins, label: 'Credits & Ledger' },
    { id: 'pledges', icon: Gift, label: 'Pledges', badge: `${pledges.length}` },
    { id: 'auction', icon: Gavel, label: 'Auction' },
    { id: 'utilities', icon: Wrench, label: 'Utilities' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/admin/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{tournament.name}</h1>
            <StatusChip variant={getStatusVariant(tournament.status)} size="sm">{tournament.status}</StatusChip>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-4">
        <Accordion type="single" collapsible defaultValue="setup" className="space-y-2">
          {sections.map(s => (
            <AccordionItem key={s.id} value={s.id} className="border border-border rounded-xl overflow-hidden bg-card">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-sm">
                  <s.icon className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="font-medium">{s.label}</span>
                  {s.badge && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{s.badge}</span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {s.id === 'setup' && <AdminSetupSection tournament={tournament} onReload={loadData} />}
                {s.id === 'roster' && <AdminRosterSection players={players} onReload={loadData} />}
                {s.id === 'rounds' && <AdminRoundsSection tournament={tournament} rounds={rounds} matches={matches} onReload={loadData} callEngine={callEngine} isUpdating={isUpdating} />}
                {s.id === 'matches' && <AdminMatchesSection tournament={tournament} rounds={rounds} matches={matches} players={players} onReload={loadData} callEngine={callEngine} isUpdating={isUpdating} />}
                {s.id === 'credits' && <AdminCreditsSection tournamentId={tournament.id} players={players} onReload={loadData} />}
                {s.id === 'pledges' && <AdminPledgesSection pledges={pledges} players={players} rounds={rounds} onReload={loadData} />}
                {s.id === 'auction' && <AdminAuctionSection tournament={tournament} players={players} onReload={loadData} callEngine={callEngine} isUpdating={isUpdating} />}
                {s.id === 'utilities' && <AdminUtilitiesSection tournament={tournament} onReload={loadData} callEngine={callEngine} isUpdating={isUpdating} />}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
    </div>
  );
}
