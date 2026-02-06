import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { MatchCard } from '@/components/cards/MatchCard';
import { formatEuros } from '@/lib/euros';
import { cn } from '@/lib/utils';
import { Copy, Trophy, ShoppingBag, BarChart3 } from 'lucide-react';
import type { MatchWithPlayers, Player, Tournament } from '@/lib/types';
import type { RoundSummary } from '@/hooks/useRoundSummaries';

interface RoundTimelineProps {
  summaries: RoundSummary[];
  currentPlayerId: string;
  onClaimBooking: (match: MatchWithPlayers) => void;
  onReportResult: (match: MatchWithPlayers) => void;
  onCopyContacts: (match: MatchWithPlayers) => void;
}

export function RoundTimeline({
  summaries,
  currentPlayerId,
  onClaimBooking,
  onReportResult,
  onCopyContacts,
}: RoundTimelineProps) {
  const navigate = useNavigate();

  // Find the live round to default-expand
  const liveRoundId = summaries.find(s => s.round.status === 'Live')?.round.id;
  const defaultValue = liveRoundId || summaries[summaries.length - 1]?.round.id || '';

  // Stats
  const totalMatches = summaries.reduce((acc, s) => acc + s.matches.length, 0);
  const playedMatches = summaries.reduce(
    (acc, s) => acc + s.matches.filter(m => m.status === 'Played' || m.status === 'AutoResolved').length,
    0,
  );
  const overdueMatches = summaries.reduce(
    (acc, s) => acc + s.matches.filter(m => m.status === 'Overdue').length,
    0,
  );

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span>🎾 {playedMatches}/{totalMatches} played</span>
        {overdueMatches > 0 && (
          <span className="text-destructive">⚠️ {overdueMatches} overdue</span>
        )}
      </div>

      {/* Round accordion */}
      <Accordion type="single" collapsible defaultValue={defaultValue}>
        {summaries.map((summary) => (
          <RoundAccordionItem
            key={summary.round.id}
            summary={summary}
            currentPlayerId={currentPlayerId}
            onClaimBooking={onClaimBooking}
            onReportResult={onReportResult}
            onCopyContacts={onCopyContacts}
          />
        ))}
      </Accordion>

      {/* Navigation actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate('/leaderboard')}>
          <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Leaderboard
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate('/auction')}>
          <ShoppingBag className="mr-1.5 h-3.5 w-3.5" /> Auction
        </Button>
      </div>
    </div>
  );
}

function RoundAccordionItem({
  summary,
  currentPlayerId,
  onClaimBooking,
  onReportResult,
  onCopyContacts,
}: {
  summary: RoundSummary;
  currentPlayerId: string;
  onClaimBooking: (match: MatchWithPlayers) => void;
  onReportResult: (match: MatchWithPlayers) => void;
  onCopyContacts: (match: MatchWithPlayers) => void;
}) {
  const { round, matches, playerSetsWon, playerSetsLost, playerNetCredits, matchResult } = summary;
  const isCompleted = round.status === 'Completed';
  const isLive = round.status === 'Live';

  const roundLabel = round.is_playoff
    ? (round.playoff_type === 'final' ? '🏆 Final' : '⚔️ Semi-Final')
    : `Round ${round.index}`;

  const statusVariant = isLive ? 'live' : isCompleted ? 'success' : 'neutral';

  // Compact summary line for completed rounds
  const resultEmoji = matchResult === 'win' ? '✅' : matchResult === 'loss' ? '❌' : matchResult === 'draw' ? '🤝' : matchResult === 'bye' ? '😎' : '⏳';
  const netSign = playerNetCredits >= 0 ? '+' : '';
  const completedSummary = isCompleted
    ? `${resultEmoji} ${playerSetsWon}–${playerSetsLost} sets • ${netSign}${formatEuros(playerNetCredits)}`
    : null;

  return (
    <AccordionItem value={round.id} className="border-border/50">
      <AccordionTrigger className="hover:no-underline py-3 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-semibold text-sm whitespace-nowrap">{roundLabel}</span>
          <StatusChip variant={statusVariant} size="sm" pulse={isLive}>
            {round.status}
          </StatusChip>
          {completedSummary && (
            <span className="text-xs text-muted-foreground truncate ml-auto mr-2">
              {completedSummary}
            </span>
          )}
          {isLive && round.end_at && (
            <div className="ml-auto mr-2">
              <CountdownTimer targetDate={round.end_at} variant="compact" className="text-xs" />
            </div>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pt-1 pb-2">
          {/* Round dates */}
          {(round.start_at || round.end_at) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {round.start_at && (
                <span>Started: {new Date(round.start_at).toLocaleDateString()}</span>
              )}
              {round.end_at && (
                <span>Ends: {new Date(round.end_at).toLocaleDateString()}</span>
              )}
            </div>
          )}

          {/* Matches */}
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No match this round</p>
          ) : (
            matches.map((match) =>
              match.is_bye ? (
                <Card key={match.id} className="chaos-card border-accent/30">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl mb-2">😎</div>
                    <p className="text-accent font-medium">Bye Round</p>
                    <p className="text-sm text-muted-foreground">Enjoy the rest!</p>
                  </CardContent>
                </Card>
              ) : (
                <div key={match.id} className="space-y-2">
                  <MatchCard
                    match={match}
                    currentPlayerId={currentPlayerId}
                    onClaimBooking={() => onClaimBooking(match)}
                    onReportResult={() => onReportResult(match)}
                  />
                  {match.status !== 'Played' && match.status !== 'AutoResolved' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => onCopyContacts(match)}
                    >
                      <Copy className="mr-1 h-3 w-3" /> Copy Match Contacts
                    </Button>
                  )}
                </div>
              ),
            )
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
