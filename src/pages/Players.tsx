import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/StatusChip';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Player } from '@/lib/types';
import { Users, Phone, MessageCircle } from 'lucide-react';

export default function PlayersPage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading } = usePlayer();
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/');
      return;
    }

    if (tournament) {
      loadPlayers();
    }
  }, [session, tournament, isLoading, navigate]);

  const loadPlayers = async () => {
    if (!tournament) return;

    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('full_name');

    setPlayers((data || []) as Player[]);
  };

  if (isLoading || !player || !tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">👥</div>
      </div>
    );
  }

  

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Active': return 'success';
      case 'InactiveWarning': return 'warning';
      case 'Removed': return 'error';
      default: return 'neutral';
    }
  };

  const formatPhone = (phone: string) => {
    // Format for WhatsApp link
    return phone.replace(/\D/g, '');
  };

  return (
    <>
      <PageLayout
        header={
          <div className="p-4">
            <h1 className="font-bold text-xl flex items-center gap-2">
              <Users className="h-6 w-6 text-accent" />
              Players
            </h1>
            <p className="text-sm text-muted-foreground">
              {players.filter(p => p.status === 'Active').length} active • {players.length} total
            </p>
          </div>
        }
      >
        <div className="space-y-3">
          {players.map((p) => (
            <Card
              key={p.id}
              className={`chaos-card p-4 ${
                p.id === player.id ? 'border-primary/50' : ''
              } ${p.status !== 'Active' ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className={`
                  h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold
                  ${p.id === player.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}
                `}>
                  {p.avatar_url ? (
                    <img 
                      src={p.avatar_url} 
                      alt={p.full_name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    p.full_name.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">
                      {p.full_name}
                      {p.id === player.id && <span className="text-primary ml-1">(you)</span>}
                    </p>
                    {p.status !== 'Active' && (
                      <StatusChip variant={getStatusVariant(p.status)}>
                        {p.status === 'InactiveWarning' ? 'Warning' : p.status}
                      </StatusChip>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {p.phone}
                  </p>
                </div>

                {/* WhatsApp button */}
                {p.id !== player.id && (
                  <a
                    href={`https://wa.me/${formatPhone(p.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="icon" className="text-primary">
                      <MessageCircle className="h-5 w-5" />
                    </Button>
                  </a>
                )}
              </div>
            </Card>
          ))}

          {players.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-muted-foreground">No players yet</p>
            </div>
          )}
        </div>
      </PageLayout>

      <BottomNav showAuction={showAuction} />
    </>
  );
}
