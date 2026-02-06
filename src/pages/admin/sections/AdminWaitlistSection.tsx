import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { WaitlistEntry, Tournament } from '@/lib/types';
import { Trash2, Star, StarOff, UserPlus, Copy, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AdminWaitlistSectionProps {
  tournament: Tournament;
  onReload: () => void;
}

export default function AdminWaitlistSection({ tournament, onReload }: AdminWaitlistSectionProps) {
  const { toast } = useToast();
  const [generalEntries, setGeneralEntries] = useState<WaitlistEntry[]>([]);
  const [tournamentEntries, setTournamentEntries] = useState<WaitlistEntry[]>([]);
  const [assignableTournaments, setAssignableTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, [tournament.id]);

  const loadAll = async () => {
    try {
      const [genRes, tournRes, tournamentsRes] = await Promise.all([
        supabase
          .from('waitlist_entries')
          .select('*')
          .is('tournament_id', null)
          .in('status', ['waiting', 'invited', 'no_response'])
          .order('priority', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('waitlist_entries')
          .select('*')
          .eq('tournament_id', tournament.id)
          .in('status', ['waiting', 'invited', 'no_response'])
          .order('priority', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('tournaments')
          .select('*')
          .in('status', ['Draft', 'SignupOpen'])
          .order('created_at', { ascending: false }),
      ]);
      setGeneralEntries((genRes.data || []) as WaitlistEntry[]);
      setTournamentEntries((tournRes.data || []) as WaitlistEntry[]);
      setAssignableTournaments((tournamentsRes.data || []) as Tournament[]);
    } catch (err) {
      console.error('Error loading waitlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePriority = async (entry: WaitlistEntry) => {
    await supabase
      .from('waitlist_entries')
      .update({ priority: !entry.priority })
      .eq('id', entry.id);
    loadAll();
  };

  const removeEntry = async (entry: WaitlistEntry) => {
    await supabase
      .from('waitlist_entries')
      .update({ status: 'removed' as any })
      .eq('id', entry.id);
    toast({ title: 'Removed from waitlist' });
    loadAll();
  };

  const markStatus = async (entry: WaitlistEntry, status: string) => {
    await supabase
      .from('waitlist_entries')
      .update({ status: status as any })
      .eq('id', entry.id);
    toast({ title: `Marked as ${status}` });
    loadAll();
  };

  const inviteEntry = async (entry: WaitlistEntry, targetTournamentId: string) => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('waitlist_entries')
      .update({
        status: 'invited' as any,
        assigned_tournament_id: targetTournamentId,
        assigned_at: new Date().toISOString(),
        invite_expires_at: expiresAt,
      })
      .eq('id', entry.id);
    toast({ title: 'Invite sent!', description: 'Player has 24h to confirm.' });
    loadAll();
  };

  const copyWhatsAppMessage = (entry: WaitlistEntry) => {
    const targetTournament = assignableTournaments.find(t => t.id === entry.assigned_tournament_id);
    const msg = `Hey ${entry.full_name}! 🎾 A seat just opened up${targetTournament ? ` in ${targetTournament.name}` : ''}. Confirm within 24h in the app!`;
    navigator.clipboard.writeText(msg);
    toast({ title: 'Copied to clipboard!' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'text-muted-foreground';
      case 'invited': return 'text-primary';
      case 'no_response': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const renderEntry = (entry: WaitlistEntry) => (
    <Card key={entry.id} className={`${entry.priority ? 'border-primary/40' : ''}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{entry.full_name}</span>
              {entry.priority && <Star className="h-3 w-3 fill-primary text-primary" />}
              <span className={`text-[10px] uppercase font-semibold ${getStatusColor(entry.status)}`}>
                {entry.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{entry.phone}</p>
            {entry.note && <p className="text-xs text-muted-foreground/70 mt-1 italic">"{entry.note}"</p>}
            <p className="text-[10px] text-muted-foreground mt-1">
              <Clock className="h-2.5 w-2.5 inline mr-1" />
              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePriority(entry)}>
              {entry.priority ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => removeEntry(entry)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {entry.status === 'waiting' && (
            <div className="flex items-center gap-2 w-full">
              <Select onValueChange={(tId) => inviteEntry(entry, tId)}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="Assign to tournament…" />
                </SelectTrigger>
                <SelectContent>
                  {assignableTournaments.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name} ({t.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {entry.status === 'invited' && (
            <div className="flex gap-2 w-full">
              <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => copyWhatsAppMessage(entry)}>
                <Copy className="h-3 w-3 mr-1" /> Copy WhatsApp Msg
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markStatus(entry, 'no_response')}>
                <AlertTriangle className="h-3 w-3 mr-1" /> No response
              </Button>
            </div>
          )}

          {entry.status === 'no_response' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markStatus(entry, 'dropped')}>
              Mark Dropped
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return <div className="text-sm text-muted-foreground text-center py-4">Loading waitlist…</div>;
  }

  return (
    <div className="space-y-3">
      <Tabs defaultValue="tournament" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="tournament" className="flex-1 text-xs">
            This Tournament ({tournamentEntries.length})
          </TabsTrigger>
          <TabsTrigger value="general" className="flex-1 text-xs">
            General ({generalEntries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tournament" className="space-y-2 mt-3">
          {tournamentEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No one on this tournament's waitlist</p>
          ) : (
            tournamentEntries.map(renderEntry)
          )}
        </TabsContent>

        <TabsContent value="general" className="space-y-2 mt-3">
          {generalEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No one on the general waitlist</p>
          ) : (
            generalEntries.map(renderEntry)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
