import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PledgeItem } from '@/lib/types';

export interface RoundPledgeMap {
  /** playerId -> PledgeItem (any pledge for the tournament) */
  [playerId: string]: PledgeItem;
}

/**
 * Returns a map of playerId -> their pledge for the tournament (not round-specific).
 * Each player maps to their first approved/visible pledge.
 */
export function useRoundPledges(tournamentId: string | undefined, _roundId?: string | undefined) {
  const [pledges, setPledges] = useState<RoundPledgeMap>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tournamentId) {
      setPledges({});
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('pledge_items')
      .select('*')
      .eq('tournament_id', tournamentId)
      .in('status', ['Approved', 'Draft']);

    const map: RoundPledgeMap = {};
    (data || []).forEach((p) => {
      // Keep first pledge found per player (already have one = skip)
      if (!map[p.pledged_by_player_id]) {
        map[p.pledged_by_player_id] = p as PledgeItem;
      }
    });
    setPledges(map);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { pledges, loading, refresh };
}
