import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Player, Tournament } from '@/lib/types';

export type PledgeGateStatus = 'loading' | 'missing' | 'submitted' | 'approved';

export function usePledgeStatus(player: Player | null, tournament: Tournament | null) {
  const [status, setStatus] = useState<PledgeGateStatus>('loading');

  useEffect(() => {
    if (!player || !tournament) {
      setStatus('loading');
      return;
    }
    checkPledge();
  }, [player?.id, tournament?.id]);

  const checkPledge = async () => {
    if (!player || !tournament) return;

    const { data } = await supabase
      .from('pledge_items')
      .select('id, status')
      .eq('pledged_by_player_id', player.id)
      .eq('tournament_id', tournament.id)
      .limit(1);

    if (!data || data.length === 0) {
      setStatus('missing');
    } else if (data[0].status === 'Approved') {
      setStatus('approved');
    } else {
      setStatus('submitted');
    }
  };

  return { pledgeStatus: status, refreshPledgeStatus: checkPledge };
}
