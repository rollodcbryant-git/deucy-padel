import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PledgeItem } from '@/lib/types';

export interface RoundPledgeMap {
  /** playerId -> PledgeItem for this round */
  [playerId: string]: PledgeItem;
}

export function useRoundPledges(tournamentId: string | undefined, roundId: string | undefined) {
  const [pledges, setPledges] = useState<RoundPledgeMap>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tournamentId || !roundId) {
      setPledges({});
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('pledge_items')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round_id', roundId);

    const map: RoundPledgeMap = {};
    (data || []).forEach((p) => {
      map[p.pledged_by_player_id] = p as PledgeItem;
    });
    setPledges(map);
    setLoading(false);
  }, [tournamentId, roundId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { pledges, loading, refresh };
}
