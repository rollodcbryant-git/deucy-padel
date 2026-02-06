import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { cn } from '@/lib/utils';
import { Phone, ExternalLink, Check, MapPin, MessageCircle } from 'lucide-react';
import { PlayerLink } from '@/components/ui/PlayerLink';
import { useToast } from '@/hooks/use-toast';
import type { MatchWithPlayers, Player, Round, Tournament } from '@/lib/types';
import { format } from 'date-fns';

interface MatchCardProps {
  match: MatchWithPlayers;
  currentPlayerId: string;
  round?: Round;
  tournament?: Tournament;
  onClaimBooking?: () => void;
  onReportResult?: () => void;
  className?: string;
}

export function MatchCard({
  match,
  currentPlayerId,
  onClaimBooking,
  onReportResult,
  className,
}: MatchCardProps) {
  const isBookingClaimed = match.status === 'BookingClaimed' || match.booking_claimed_by_player_id;
  const isPlayed = match.status === 'Played';
  const isOverdue = match.status === 'Overdue' || match.status === 'AutoResolved';

  // Determine which team the current player is on
  const isTeamA = 
    match.team_a_player1_id === currentPlayerId || 
    match.team_a_player2_id === currentPlayerId;

  const partner = isTeamA
    ? (match.team_a_player1_id === currentPlayerId ? match.team_a_player2 : match.team_a_player1)
    : (match.team_b_player1_id === currentPlayerId ? match.team_b_player2 : match.team_b_player1);

  const opponents = isTeamA
    ? [match.team_b_player1, match.team_b_player2]
    : [match.team_a_player1, match.team_a_player2];

  const allPlayers = [
    match.team_a_player1,
    match.team_a_player2,
    match.team_b_player1,
    match.team_b_player2,
  ].filter(Boolean) as Player[];

  return (
    <Card className={cn('chaos-card', className)}>
      <CardContent className="p-4 space-y-4">
        {/* Status bar */}
        <div className="flex items-center justify-between">
          <StatusChip 
            variant={
              isPlayed ? 'success' :
              isOverdue ? 'error' :
              isBookingClaimed ? 'info' : 'neutral'
            }
          >
            {isPlayed ? 'Played' :
             isOverdue ? 'Overdue' :
             isBookingClaimed ? 'Booked' : 'Pending'}
          </StatusChip>

          {match.deadline_at && !isPlayed && !isOverdue && (
            <CountdownTimer targetDate={match.deadline_at} variant="compact" />
          )}
        </div>

        {/* Partner section */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Partner</p>
          {partner ? (
            <PlayerLink player={partner} showAvatar avatarClassName="h-10 w-10" />
          ) : (
            <span className="font-semibold text-muted-foreground">TBD</span>
          )}
        </div>

        {/* VS section */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm font-bold text-muted-foreground">VS</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Opponents section */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Opponents</p>
          <div className="flex items-center gap-2">
            {opponents.filter(Boolean).map((opponent, i) => (
              <div key={opponent?.id || i} className="flex items-center gap-2">
                {opponent ? (
                  <PlayerLink player={opponent} showAvatar avatarClassName="h-10 w-10" className="font-medium" />
                ) : (
                  <span className="font-medium text-muted-foreground">TBD</span>
                )}
                {i === 0 && opponents[1] && (
                  <span className="text-muted-foreground mx-1">&</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Score if played */}
        {isPlayed && (
          <div className="flex items-center justify-center gap-4 py-2 bg-muted/50 rounded-lg">
            <span className={cn(
              'text-2xl font-bold',
              (isTeamA && match.sets_a > match.sets_b) || (!isTeamA && match.sets_b > match.sets_a)
                ? 'text-primary' : 'text-muted-foreground'
            )}>
              {isTeamA ? match.sets_a : match.sets_b}
            </span>
            <span className="text-muted-foreground">-</span>
            <span className={cn(
              'text-2xl font-bold',
              (isTeamA && match.sets_b > match.sets_a) || (!isTeamA && match.sets_a > match.sets_b)
                ? 'text-primary' : 'text-muted-foreground'
            )}>
              {isTeamA ? match.sets_b : match.sets_a}
            </span>
          </div>
        )}

        {/* Actions */}
        {!isPlayed && !isOverdue && (
          <div className="space-y-2">
            {/* Booking button */}
            {!isBookingClaimed && onClaimBooking && (
              <Button 
                onClick={onClaimBooking}
                className="w-full touch-target bg-gradient-primary hover:opacity-90"
              >
                <Check className="mr-2 h-5 w-5" />
                I'll Book It
              </Button>
            )}

            {isBookingClaimed && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary" />
                Booked by {
                  match.booking_claimed_by_player_id === currentPlayerId 
                    ? 'you' 
                    : allPlayers.find(p => p.id === match.booking_claimed_by_player_id)?.full_name || 'someone'
                }
              </div>
            )}

            {/* Court location & booking */}
            <div className="rounded-lg bg-muted/40 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <p className="text-xs text-muted-foreground leading-snug">
                  BOIX TEAM TENNIS — Gran Vía de Fernando el Católico, 78, Extramurs, 46008 València
                </p>
              </div>
              <Button 
                variant="outline" 
                className="w-full touch-target"
                onClick={() => window.open('https://boixteam.es/booking-gran-via', '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Book Court
              </Button>
            </div>

            {/* Report result */}
            {isBookingClaimed && onReportResult && (
              <Button 
                variant="secondary"
                onClick={onReportResult}
                className="w-full touch-target"
              >
                Report Result
              </Button>
            )}
          </div>
        )}

        {/* Phone list for match chat */}
        {!isPlayed && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Match Chat</p>
            <div className="flex flex-wrap gap-2">
              {allPlayers
                .filter(p => p.id !== currentPlayerId)
                .map((player) => (
                  <a
                    key={player.id}
                    href={`https://wa.me/${player.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-muted rounded-full hover:bg-muted/80 transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    {player.full_name.split(' ')[0]}
                  </a>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
