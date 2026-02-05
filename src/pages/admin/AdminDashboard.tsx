import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Tournament } from '@/lib/types';
import { Plus, Trophy, Users, Calendar, LogOut, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/admin');
        return;
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        toast({
          title: 'Access Denied',
          description: 'You do not have admin privileges.',
          variant: 'destructive',
        });
        await supabase.auth.signOut();
        navigate('/admin');
        return;
      }

      setIsAuthorized(true);

      // Load tournaments
      const { data: tournamentsData, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTournaments((tournamentsData || []) as Tournament[]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Live': return 'live';
      case 'SignupOpen': return 'success';
      case 'AuctionLive': return 'warning';
      case 'Finished':
      case 'Closed': return 'ended';
      default: return 'neutral';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage your tournaments</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Create tournament button */}
        <Button
          className="w-full touch-target bg-gradient-primary"
          onClick={() => navigate('/admin/tournaments/new')}
        >
          <Plus className="mr-2 h-5 w-5" />
          Create Tournament
        </Button>

        {/* Tournaments list */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Tournaments
          </h2>

          {tournaments.length === 0 ? (
            <Card className="chaos-card">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">🎾</div>
                <p className="text-muted-foreground">No tournaments yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first tournament to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            tournaments.map((tournament) => (
              <Link key={tournament.id} to={`/admin/tournaments/${tournament.id}`}>
                <Card className="chaos-card hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{tournament.name}</CardTitle>
                      <StatusChip variant={getStatusVariant(tournament.status)}>
                        {tournament.status}
                      </StatusChip>
                    </div>
                    {tournament.club_name && (
                      <p className="text-sm text-muted-foreground">@ {tournament.club_name}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{tournament.min_players}-{tournament.max_players} players</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{tournament.round_duration_days}d rounds</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
