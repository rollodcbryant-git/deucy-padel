import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { cn } from '@/lib/utils';
import { Phone, ExternalLink, Check, MapPin, MessageCircle } from 'lucide-react';
import { PlayerLink } from '@/components/ui/PlayerLink';
import { PledgeIndicator } from './PledgeIndicator';
import { RoundPledgeSection } from './RoundPledgeSection';
import { useToast } from '@/hooks/use-toast';
import type { MatchWithPlayers, Player, Round, Tournament, PledgeItem } from '@/lib/types';
import type { RoundPledgeMap } from '@/hooks/useRoundPledges';
import { format } from 'date-fns';

interface MatchCardProps {
  match: MatchWithPlayers;
  currentPlayerId: string;
  round?: Round;
  tournament?: Tournament;
  roundPledges?: RoundPledgeMap;
  onClaimBooking?: () => void;
  onReportResult?: () => void;
  onPledgeSaved?: () => void;
  className?: string;
}

export function MatchCard({
  match,
  currentPlayerId,
  round,
  tournament,
  roundPledges = {},
  onClaimBooking,
  onReportResult,
  onPledgeSaved,
  className,
}: MatchCardProps) {
  const { toast } = useToast();
  const isBookingClaimed = match.status === 'BookingClaimed' || match.booking_claimed_by_player_id;
  const isPlayed = match.status === 'Played';
  const isOverdue = match.status === 'Overdue' || match.status === 'AutoResolved';

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

  const renderPlayerWithPledge = (player: Player | undefined, label?: string) => {
    if (!player) return <span className="font-semibold text-muted-foreground">TBD</span>;
    return (
      <div className="flex items-center gap-2">
        <PlayerLink player={player} showAvatar avatarClassName="h-10 w-10" className="font-medium" />
        {round && <PledgeIndicator pledge={roundPledges[player.id]} />}
      </div>
    );
  };

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
          {renderPlayerWithPledge(partner)}
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
          <div className="flex flex-col gap-2">
            {opponents.filter(Boolean).map((opponent, i) => (
              <div key={opponent?.id || i}>
                {renderPlayerWithPledge(opponent)}
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
                  {tournament?.club_name || 'BOIX TEAM TENNIS'} — Gran Vía de Fernando el Católico, 78, Extramurs, 46008 València
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full touch-target"
                onClick={() => window.open(tournament?.booking_url || 'https://boixteam.es/booking-gran-via', '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Book Court
              </Button>
            </div>

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

        {/* Round Pledge Section */}
        {!isPlayed && round && tournament && onPledgeSaved && (
          <RoundPledgeSection
            currentPlayerPledge={roundPledges[currentPlayerId]}
            tournamentId={tournament.id}
            playerId={currentPlayerId}
            roundId={round.id}
            tournament={tournament}
            onPledgeSaved={onPledgeSaved}
          />
        )}

        {/* Phone list for match chat */}
        {!isPlayed && (
          <div className="pt-2 border-t border-border space-y-3">
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

            {/* WhatsApp group creation */}
            {allPlayers.length >= 2 && (() => {
              const roundLabel = round
                ? (round.is_playoff ? (round.playoff_type === 'final' ? 'Final' : 'Semi-Final') : `Round ${round.index}`)
                : 'Match';
              const deadlineText = match.deadline_at
                ? format(new Date(match.deadline_at), 'EEE d MMM, HH:mm')
                : 'TBD';
              const bookingUrl = tournament?.booking_url || 'https://boixteam.es/booking-gran-via';
              const tournamentName = tournament?.name || 'Deucy';

              const groupMsg = [
                `${tournamentName} – ${roundLabel} 🥤`,
                '',
                `Team A: ${match.team_a_player1?.full_name || 'TBD'} + ${match.team_a_player2?.full_name || 'TBD'}`,
                `Team B: ${match.team_b_player1?.full_name || 'TBD'} + ${match.team_b_player2?.full_name || 'TBD'}`,
                '',
                `⏰ Deadline: ${deadlineText}`,
                `🎾 Book court: ${bookingUrl}`,
                '',
                "Let's pick a time – who's booking?",
              ].join('\n');

              const handleCreateGroup = () => {
                navigator.clipboard.writeText(groupMsg).then(() => {
                  toast({ title: 'Message copied! 📋', description: 'Paste it in your new WhatsApp group' });
                });
                const firstOther = allPlayers.find(p => p.id !== currentPlayerId);
                if (firstOther) {
                  const phone = firstOther.phone.replace(/\D/g, '');
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(groupMsg)}`, '_blank');
                }
              };

              return (
                <div className="space-y-1.5">
                  <Button
                    variant="outline"
                    className="w-full touch-target"
                    onClick={handleCreateGroup}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Create WhatsApp Group
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center leading-tight">
                    Opens WhatsApp & copies a group message with all players
                  </p>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
