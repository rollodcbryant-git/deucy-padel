import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhone } from '@/lib/phone';
import type { WaitlistEntry } from '@/lib/types';

/**
 * Hook to check a player's waitlist status and provide join/leave actions.
 */
export function useWaitlist(phone: string | undefined) {
  const [entry, setEntry] = useState<WaitlistEntry | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizedPhone = phone ? normalizePhone(phone) : null;

  const refresh = useCallback(async () => {
    if (!normalizedPhone) return;
    const { data } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('phone', normalizedPhone)
      .in('status', ['waiting', 'invited'])
      .limit(1);
    setEntry((data && data.length > 0 ? data[0] : null) as WaitlistEntry | null);
  }, [normalizedPhone]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const joinWaitlist = async (opts: {
    fullName: string;
    phone: string;
    note?: string;
    tournamentId?: string | null;
  }) => {
    setLoading(true);
    try {
      const normalized = normalizePhone(opts.phone);
      // Check not already on a waitlist
      const { data: existing } = await supabase
        .from('waitlist_entries')
        .select('id')
        .eq('phone', normalized)
        .in('status', ['waiting', 'invited']);
      if (existing && existing.length > 0) {
        return { error: 'You are already on a waitlist' };
      }
      const { error } = await supabase.from('waitlist_entries').insert({
        full_name: opts.fullName,
        phone: normalized,
        note: opts.note || null,
        tournament_id: opts.tournamentId || null,
        status: 'waiting',
      });
      if (error) return { error: error.message };
      await refresh();
      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const leaveWaitlist = async () => {
    if (!entry) return;
    setLoading(true);
    try {
      await supabase
        .from('waitlist_entries')
        .update({ status: 'removed' as any })
        .eq('id', entry.id);
      setEntry(null);
    } finally {
      setLoading(false);
    }
  };

  // Count position in queue for a specific tournament or general
  const [position, setPosition] = useState<number | null>(null);
  useEffect(() => {
    if (!entry) { setPosition(null); return; }
    (async () => {
      let query = supabase
        .from('waitlist_entries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'waiting')
        .lt('created_at', entry.created_at);
      if (entry.tournament_id) {
        query = query.eq('tournament_id', entry.tournament_id);
      } else {
        query = query.is('tournament_id', null);
      }
      const { count } = await query;
      setPosition((count ?? 0) + 1);
    })();
  }, [entry]);

  return { entry, position, loading, joinWaitlist, leaveWaitlist, refresh };
}
