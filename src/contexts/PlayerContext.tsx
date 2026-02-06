import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhone } from '@/lib/phone';
import type { Player, Tournament, PlayerSession } from '@/lib/types';

interface PlayerContextType {
  player: Player | null;
  tournament: Tournament | null;
  session: PlayerSession | null;
  isLoading: boolean;
  login: (phone: string, pin: string, tournamentId?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshPlayer: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const SESSION_KEY = 'padel_chaos_session';

// Simple hash function for PIN (in production, use bcrypt on server)
function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) {
        setIsLoading(false);
        return;
      }

      const savedSession: PlayerSession = JSON.parse(stored);
      
      // Verify session is still valid
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', savedSession.playerId)
        .eq('session_token', savedSession.token)
        .single();

      if (playerError || !playerData) {
        localStorage.removeItem(SESSION_KEY);
        setIsLoading(false);
        return;
      }

      // Load tournament if player has one
      if (savedSession.tournamentId) {
        const { data: tournamentData } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', savedSession.tournamentId)
          .single();
        setTournament(tournamentData as Tournament);
      } else {
        setTournament(null);
      }

      setPlayer(playerData as Player);
      setSession(savedSession);
    } catch (error) {
      console.error('Error loading session:', error);
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = async (phone: string, pin: string, tournamentId?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const normalized = normalizePhone(phone);
      const pinHash = hashPin(pin);
      
      // Build query — if tournamentId provided, scope to it; otherwise search all
      let query = supabase
        .from('players')
        .select('*')
        .eq('phone', normalized)
        .eq('pin_hash', pinHash);
      
      if (tournamentId) {
        query = query.eq('tournament_id', tournamentId);
      }

      const { data: players, error } = await query;

      if (error || !players || players.length === 0) {
        return { success: false, error: 'Invalid phone or PIN' };
      }

      // Pick the best player record:
      // prefer one with a tournament, then by tournament status (Live > SignupOpen > others)
      let playerData = players[0];
      if (players.length > 1 && !tournamentId) {
        const playersWithTournament = players.filter(p => p.tournament_id);
        if (playersWithTournament.length > 0) {
          const tIds = [...new Set(playersWithTournament.map(p => p.tournament_id).filter(Boolean))];
          const { data: tournaments } = await supabase
            .from('tournaments')
            .select('id, status')
            .in('id', tIds as string[]);
          
          if (tournaments) {
            const statusPriority: Record<string, number> = { Live: 0, AuctionLive: 0, SignupOpen: 1 };
            const tMap = new Map(tournaments.map(t => [t.id, statusPriority[t.status] ?? 9]));
            playersWithTournament.sort((a, b) => (tMap.get(a.tournament_id!) ?? 9) - (tMap.get(b.tournament_id!) ?? 9));
            playerData = playersWithTournament[0];
          } else {
            playerData = playersWithTournament[0];
          }
        }
        // else keep the account-only record (no tournament)
      }

      // Generate session token
      const token = crypto.randomUUID();
      
      const { error: updateError } = await supabase
        .from('players')
        .update({ session_token: token })
        .eq('id', playerData.id);

      if (updateError) {
        return { success: false, error: 'Failed to create session' };
      }

      // Load tournament if player has one
      let tournamentData = null;
      if (playerData.tournament_id) {
        const { data } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', playerData.tournament_id)
          .single();
        tournamentData = data;
      }

      const newSession: PlayerSession = {
        playerId: playerData.id,
        tournamentId: playerData.tournament_id,
        playerName: playerData.full_name,
        token,
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setPlayer({ ...playerData, session_token: token } as Player);
      setTournament(tournamentData as Tournament);
      setSession(newSession);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const logout = () => {
    if (player) {
      supabase
        .from('players')
        .update({ session_token: null })
        .eq('id', player.id)
        .then(() => {});
    }
    localStorage.removeItem(SESSION_KEY);
    setPlayer(null);
    setTournament(null);
    setSession(null);
  };

  const refreshPlayer = async () => {
    if (!session) return;
    
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('id', session.playerId)
      .single();
    
    if (data) {
      setPlayer(data as Player);
    }
  };

  return (
    <PlayerContext.Provider value={{
      player,
      tournament,
      session,
      isLoading,
      login,
      logout,
      refreshPlayer,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}

// Export hash function for registration
export { hashPin };
