import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calculateRoundsCount(playerCount: number): number {
  if (playerCount <= 12) return 3;
  if (playerCount <= 18) return 4;
  return 5;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "start_tournament":
        return await startTournament(supabase, body);
      case "process_match_result":
        return await processMatchResult(supabase, body);
      case "check_advance_round":
        return await checkAdvanceRound(supabase, body);
      case "regenerate_matches":
        return await regenerateMatches(supabase, body);
      case "seed_demo":
        return await seedDemo(supabase, body);
      case "start_auction":
        return await startAuction(supabase, body);
      case "settle_auction":
        return await settleAuction(supabase, body);
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error("Tournament engine error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================
// START TOURNAMENT
// ============================================================
async function startTournament(supabase: any, body: any) {
  const { tournament_id } = body;

  // Load tournament
  const { data: tournament, error: tErr } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournament_id)
    .single();
  if (tErr) throw new Error(`Tournament not found: ${tErr.message}`);
  if (tournament.status !== "SignupOpen") throw new Error("Tournament must be in SignupOpen status");

  // Get confirmed players
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("*")
    .eq("tournament_id", tournament_id)
    .eq("confirmed", true)
    .eq("status", "Active");
  if (pErr) throw pErr;

  if (players.length < tournament.min_players) {
    throw new Error(`Need at least ${tournament.min_players} confirmed players (have ${players.length})`);
  }

  const roundsCount = calculateRoundsCount(players.length);

  // Update tournament
  await supabase
    .from("tournaments")
    .update({ status: "Live", rounds_count: roundsCount })
    .eq("id", tournament_id);

  // Grant starting credits via ledger
  const creditEntries = players.map((p: any) => ({
    tournament_id,
    player_id: p.id,
    type: "StartingGrant",
    amount: tournament.starting_credits,
    note: "Starting credits",
  }));
  await supabase.from("credit_ledger_entries").insert(creditEntries);

  // Update player balances
  for (const p of players) {
    await supabase
      .from("players")
      .update({ credits_balance: tournament.starting_credits })
      .eq("id", p.id);
  }

  // Create Round 1
  const now = new Date();
  const endAt = new Date(now.getTime() + tournament.round_duration_days * 24 * 60 * 60 * 1000);

  const { data: round, error: rErr } = await supabase
    .from("rounds")
    .insert({
      tournament_id,
      index: 1,
      start_at: now.toISOString(),
      end_at: endAt.toISOString(),
      status: "Live",
    })
    .select()
    .single();
  if (rErr) throw rErr;

  // Grant participation bonus for Round 1
  const bonusEntries = players.map((p: any) => ({
    tournament_id,
    player_id: p.id,
    round_id: round.id,
    type: "ParticipationBonus",
    amount: tournament.participation_bonus,
    note: `Round 1 participation bonus`,
  }));
  await supabase.from("credit_ledger_entries").insert(bonusEntries);

  // Update balances with bonus
  for (const p of players) {
    await supabase
      .from("players")
      .update({
        credits_balance: tournament.starting_credits + tournament.participation_bonus,
      })
      .eq("id", p.id);
  }

  // Generate matches
  const matchResult = await generateMatchesForRound(supabase, tournament, round, players);

  return jsonResponse({
    success: true,
    rounds_count: roundsCount,
    matches_created: matchResult.matchCount,
    byes: matchResult.byes.length,
  });
}

// ============================================================
// GENERATE MATCHES FOR A ROUND
// ============================================================
async function generateMatchesForRound(
  supabase: any,
  tournament: any,
  round: any,
  players: any[]
) {
  // Get partner history from previous matches
  const { data: pastMatches } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournament.id)
    .eq("is_bye", false);

  const partnerHistory = new Map<string, Set<string>>();
  for (const m of pastMatches || []) {
    // Team A partners
    if (m.team_a_player1_id && m.team_a_player2_id) {
      if (!partnerHistory.has(m.team_a_player1_id))
        partnerHistory.set(m.team_a_player1_id, new Set());
      if (!partnerHistory.has(m.team_a_player2_id))
        partnerHistory.set(m.team_a_player2_id, new Set());
      partnerHistory.get(m.team_a_player1_id)!.add(m.team_a_player2_id);
      partnerHistory.get(m.team_a_player2_id)!.add(m.team_a_player1_id);
    }
    // Team B partners
    if (m.team_b_player1_id && m.team_b_player2_id) {
      if (!partnerHistory.has(m.team_b_player1_id))
        partnerHistory.set(m.team_b_player1_id, new Set());
      if (!partnerHistory.has(m.team_b_player2_id))
        partnerHistory.set(m.team_b_player2_id, new Set());
      partnerHistory.get(m.team_b_player1_id)!.add(m.team_b_player2_id);
      partnerHistory.get(m.team_b_player2_id)!.add(m.team_b_player1_id);
    }
  }

  // Check bye history
  const { data: pastByes } = await supabase
    .from("matches")
    .select("bye_player_id")
    .eq("tournament_id", tournament.id)
    .eq("is_bye", true);
  const byeHistory = new Set((pastByes || []).map((b: any) => b.bye_player_id));

  let activePlayers = shuffleArray(players);
  const byes: any[] = [];

  // Remove players for byes until divisible by 4
  while (activePlayers.length % 4 !== 0) {
    // Prefer giving bye to someone who hasn't had one
    const noBye = activePlayers.filter((p) => !byeHistory.has(p.id));
    const byePlayer =
      noBye.length > 0
        ? noBye[noBye.length - 1]
        : activePlayers[activePlayers.length - 1];
    byes.push(byePlayer);
    activePlayers = activePlayers.filter((p) => p.id !== byePlayer.id);
  }

  // Create bye matches
  for (const bp of byes) {
    await supabase.from("matches").insert({
      tournament_id: tournament.id,
      round_id: round.id,
      is_bye: true,
      bye_player_id: bp.id,
      status: "Played",
      deadline_at: round.end_at,
    });
  }

  // Generate matches in groups of 4
  const matches: any[] = [];
  for (let i = 0; i < activePlayers.length; i += 4) {
    const group = activePlayers.slice(i, i + 4);
    const teams = findBestTeamAssignment(group, partnerHistory);

    const { error: mErr } = await supabase.from("matches").insert({
      tournament_id: tournament.id,
      round_id: round.id,
      team_a_player1_id: teams.teamA[0].id,
      team_a_player2_id: teams.teamA[1].id,
      team_b_player1_id: teams.teamB[0].id,
      team_b_player2_id: teams.teamB[1].id,
      status: "Scheduled",
      pot_total_credits: tournament.stake_per_player * 4,
      deadline_at: round.end_at,
    });
    if (mErr) console.error("Match insert error:", mErr);
    matches.push(teams);
  }

  return { matchCount: matches.length, byes };
}

function findBestTeamAssignment(
  group: any[],
  partnerHistory: Map<string, Set<string>>
) {
  // 3 possible assignments for 4 players
  const assignments = [
    { teamA: [0, 1], teamB: [2, 3] },
    { teamA: [0, 2], teamB: [1, 3] },
    { teamA: [0, 3], teamB: [1, 2] },
  ];

  let bestScore = -Infinity;
  let bestAssignment = assignments[0];

  for (const assignment of assignments) {
    let score = 0;
    const p1A = group[assignment.teamA[0]];
    const p2A = group[assignment.teamA[1]];
    const p1B = group[assignment.teamB[0]];
    const p2B = group[assignment.teamB[1]];

    // Penalize repeated partners
    if (partnerHistory.get(p1A.id)?.has(p2A.id)) score -= 10;
    if (partnerHistory.get(p1B.id)?.has(p2B.id)) score -= 10;

    // Prefer mixed gender
    if (p1A.gender && p2A.gender && p1A.gender !== p2A.gender) score += 3;
    if (p1B.gender && p2B.gender && p1B.gender !== p2B.gender) score += 3;

    // Penalize two women together
    if (p1A.gender === "female" && p2A.gender === "female") score -= 5;
    if (p1B.gender === "female" && p2B.gender === "female") score -= 5;

    if (score > bestScore) {
      bestScore = score;
      bestAssignment = assignment;
    }
  }

  return {
    teamA: [
      group[bestAssignment.teamA[0]],
      group[bestAssignment.teamA[1]],
    ],
    teamB: [
      group[bestAssignment.teamB[0]],
      group[bestAssignment.teamB[1]],
    ],
  };
}

// ============================================================
// PROCESS MATCH RESULT
// ============================================================
async function processMatchResult(supabase: any, body: any) {
  const { match_id, sets_a, sets_b, is_unfinished, player_id } = body;

  const { data: match, error: mErr } = await supabase
    .from("matches")
    .select("*")
    .eq("id", match_id)
    .single();
  if (mErr) throw mErr;
  if (match.status === "Played") throw new Error("Match already played");

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", match.tournament_id)
    .single();

  // Determine if player is Team A or Team B to correctly assign sets
  const isTeamA =
    match.team_a_player1_id === player_id ||
    match.team_a_player2_id === player_id;

  // Sets from player perspective: sets_a = player's team, sets_b = opponents
  // Convert to absolute Team A / Team B
  const absoluteSetsA = isTeamA ? sets_a : sets_b;
  const absoluteSetsB = isTeamA ? sets_b : sets_a;

  // Update match
  await supabase
    .from("matches")
    .update({
      sets_a: absoluteSetsA,
      sets_b: absoluteSetsB,
      is_unfinished,
      status: "Played",
      played_at: new Date().toISOString(),
    })
    .eq("id", match_id);

  // Process credits
  const stake = tournament.stake_per_player;
  const pot = stake * 4;
  const allPlayerIds = [
    match.team_a_player1_id,
    match.team_a_player2_id,
    match.team_b_player1_id,
    match.team_b_player2_id,
  ].filter(Boolean);

  const teamAIds = [match.team_a_player1_id, match.team_a_player2_id].filter(Boolean);
  const teamBIds = [match.team_b_player1_id, match.team_b_player2_id].filter(Boolean);

  // Deduct stakes
  const stakeEntries = allPlayerIds.map((pid: string) => ({
    tournament_id: match.tournament_id,
    player_id: pid,
    match_id,
    round_id: match.round_id,
    type: "MatchStake",
    amount: -stake,
    note: "Match stake",
  }));
  await supabase.from("credit_ledger_entries").insert(stakeEntries);

  // Calculate payouts
  let teamAShare = 0;
  let teamBShare = 0;

  if (is_unfinished) {
    // 1-1 split
    teamAShare = Math.floor(pot / 2);
    teamBShare = pot - teamAShare;
  } else if (absoluteSetsA > absoluteSetsB) {
    // Team A wins
    if (absoluteSetsA === 2 && absoluteSetsB === 0) {
      teamAShare = pot;
      teamBShare = 0;
    } else {
      // 2-1
      teamAShare = Math.round(pot * 0.66);
      teamBShare = pot - teamAShare;
    }
  } else {
    // Team B wins
    if (absoluteSetsB === 2 && absoluteSetsA === 0) {
      teamBShare = pot;
      teamAShare = 0;
    } else {
      // 2-1
      teamBShare = Math.round(pot * 0.66);
      teamAShare = pot - teamBShare;
    }
  }

  // Distribute payouts
  const payoutEntries: any[] = [];

  if (teamAShare > 0) {
    const perPlayer = Math.floor(teamAShare / teamAIds.length);
    const remainder = teamAShare - perPlayer * teamAIds.length;
    teamAIds.forEach((pid: string, i: number) => {
      payoutEntries.push({
        tournament_id: match.tournament_id,
        player_id: pid,
        match_id,
        round_id: match.round_id,
        type: "MatchPayout",
        amount: perPlayer + (i === 0 ? remainder : 0),
        note: `Match payout (${absoluteSetsA}-${absoluteSetsB})`,
      });
    });
  }

  if (teamBShare > 0) {
    const perPlayer = Math.floor(teamBShare / teamBIds.length);
    const remainder = teamBShare - perPlayer * teamBIds.length;
    teamBIds.forEach((pid: string, i: number) => {
      payoutEntries.push({
        tournament_id: match.tournament_id,
        player_id: pid,
        match_id,
        round_id: match.round_id,
        type: "MatchPayout",
        amount: perPlayer + (i === 0 ? remainder : 0),
        note: `Match payout (${absoluteSetsA}-${absoluteSetsB})`,
      });
    });
  }

  if (payoutEntries.length > 0) {
    await supabase.from("credit_ledger_entries").insert(payoutEntries);
  }

  // Update player balances and stats
  for (const pid of allPlayerIds) {
    const isWinnerTeamA = absoluteSetsA > absoluteSetsB;
    const isOnTeamA = teamAIds.includes(pid);
    const isWinner = (isWinnerTeamA && isOnTeamA) || (!isWinnerTeamA && !isOnTeamA);
    const payout = isOnTeamA
      ? Math.floor(teamAShare / teamAIds.length)
      : Math.floor(teamBShare / teamBIds.length);
    const netCredit = payout - stake;

    const { data: currentPlayer } = await supabase
      .from("players")
      .select("*")
      .eq("id", pid)
      .single();

    if (currentPlayer) {
      const setsWon = isOnTeamA ? absoluteSetsA : absoluteSetsB;
      const setsLost = isOnTeamA ? absoluteSetsB : absoluteSetsA;

      await supabase
        .from("players")
        .update({
          credits_balance: currentPlayer.credits_balance + netCredit,
          matches_played: currentPlayer.matches_played + 1,
          sets_won: currentPlayer.sets_won + setsWon,
          sets_lost: currentPlayer.sets_lost + setsLost,
          match_wins: currentPlayer.match_wins + (isWinner && !is_unfinished ? 1 : 0),
          match_losses: currentPlayer.match_losses + (!isWinner && !is_unfinished ? 1 : 0),
        })
        .eq("id", pid);
    }
  }

  // Check if round should advance
  await checkRoundCompletion(supabase, match.round_id, match.tournament_id);

  return jsonResponse({ success: true, pot, teamAShare, teamBShare });
}

// ============================================================
// CHECK ROUND COMPLETION
// ============================================================
async function checkRoundCompletion(
  supabase: any,
  roundId: string,
  tournamentId: string
) {
  const { data: remaining } = await supabase
    .from("matches")
    .select("id")
    .eq("round_id", roundId)
    .in("status", ["Scheduled", "BookingClaimed"]);

  if (remaining && remaining.length === 0) {
    // All matches resolved - complete round
    await supabase
      .from("rounds")
      .update({ status: "Completed" })
      .eq("id", roundId);
  }
}

// ============================================================
// CHECK AND ADVANCE ROUND (admin trigger or cron)
// ============================================================
async function checkAdvanceRound(supabase: any, body: any) {
  const { tournament_id } = body;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournament_id)
    .single();
  if (!tournament) throw new Error("Tournament not found");

  // Find current live round
  const { data: liveRounds } = await supabase
    .from("rounds")
    .select("*")
    .eq("tournament_id", tournament_id)
    .eq("status", "Live");

  if (!liveRounds || liveRounds.length === 0) {
    return jsonResponse({ success: true, message: "No live round" });
  }

  const currentRound = liveRounds[0];

  // Check for overdue matches
  const now = new Date();
  const { data: overdueMatches } = await supabase
    .from("matches")
    .select("*")
    .eq("round_id", currentRound.id)
    .in("status", ["Scheduled", "BookingClaimed"]);

  const isRoundExpired = currentRound.end_at && new Date(currentRound.end_at) <= now;
  let penaltiesApplied = 0;

  if (isRoundExpired && overdueMatches && overdueMatches.length > 0) {
    // Apply penalties to overdue matches
    for (const match of overdueMatches) {
      const playerIds = [
        match.team_a_player1_id,
        match.team_a_player2_id,
        match.team_b_player1_id,
        match.team_b_player2_id,
      ].filter(Boolean);

      // Mark match as auto-resolved
      await supabase
        .from("matches")
        .update({ status: "AutoResolved" })
        .eq("id", match.id);

      // Apply penalties
      const penaltyEntries = playerIds.map((pid: string) => ({
        tournament_id,
        player_id: pid,
        match_id: match.id,
        round_id: currentRound.id,
        type: "Penalty",
        amount: -tournament.penalty_amount,
        note: "Overdue match penalty",
      }));
      await supabase.from("credit_ledger_entries").insert(penaltyEntries);

      // Update player balances and no_shows
      for (const pid of playerIds) {
        const { data: player } = await supabase
          .from("players")
          .select("*")
          .eq("id", pid)
          .single();

        if (player) {
          const newNoShows = player.no_shows + 1;
          const newStatus = newNoShows >= 2 ? "Removed" : player.status;

          await supabase
            .from("players")
            .update({
              credits_balance: player.credits_balance - tournament.penalty_amount,
              no_shows: newNoShows,
              status: newStatus,
            })
            .eq("id", pid);
        }
      }
      penaltiesApplied++;
    }
  }

  // Complete current round
  await supabase
    .from("rounds")
    .update({ status: "Completed" })
    .eq("id", currentRound.id);

  // Check if more rounds needed
  const { data: allRounds } = await supabase
    .from("rounds")
    .select("*")
    .eq("tournament_id", tournament_id)
    .eq("is_playoff", false);

  const completedRegularRounds = (allRounds || []).length;
  const roundsCount = tournament.rounds_count || calculateRoundsCount(0);

  if (completedRegularRounds < roundsCount) {
    // Create next round
    const { data: activePlayers } = await supabase
      .from("players")
      .select("*")
      .eq("tournament_id", tournament_id)
      .eq("status", "Active")
      .eq("confirmed", true);

    if (activePlayers && activePlayers.length >= 4) {
      const nextRoundIndex = completedRegularRounds + 1;
      const startAt = new Date();
      const endAt = new Date(
        startAt.getTime() + tournament.round_duration_days * 24 * 60 * 60 * 1000
      );

      const { data: newRound } = await supabase
        .from("rounds")
        .insert({
          tournament_id,
          index: nextRoundIndex,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          status: "Live",
        })
        .select()
        .single();

      // Grant participation bonus
      const bonusEntries = activePlayers.map((p: any) => ({
        tournament_id,
        player_id: p.id,
        round_id: newRound.id,
        type: "ParticipationBonus",
        amount: tournament.participation_bonus,
        note: `Round ${nextRoundIndex} participation bonus`,
      }));
      await supabase.from("credit_ledger_entries").insert(bonusEntries);

      for (const p of activePlayers) {
        await supabase
          .from("players")
          .update({
            credits_balance: p.credits_balance + tournament.participation_bonus,
          })
          .eq("id", p.id);
      }

      // Generate matches
      await generateMatchesForRound(supabase, tournament, newRound, activePlayers);

      return jsonResponse({
        success: true,
        penalties_applied: penaltiesApplied,
        new_round: nextRoundIndex,
      });
    }
  } else {
    // All rounds complete - update to Finished
    await supabase
      .from("tournaments")
      .update({ status: "Finished" })
      .eq("id", tournament_id);

    return jsonResponse({
      success: true,
      penalties_applied: penaltiesApplied,
      tournament_finished: true,
    });
  }

  return jsonResponse({ success: true, penalties_applied: penaltiesApplied });
}

// ============================================================
// REGENERATE MATCHES
// ============================================================
async function regenerateMatches(supabase: any, body: any) {
  const { tournament_id, round_id } = body;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournament_id)
    .single();

  const { data: round } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", round_id)
    .single();

  if (!round || round.status !== "Live")
    throw new Error("Round must be Live to regenerate");

  // Check no match has been played
  const { data: playedMatches } = await supabase
    .from("matches")
    .select("id")
    .eq("round_id", round_id)
    .eq("status", "Played");

  if (playedMatches && playedMatches.length > 0) {
    throw new Error("Cannot regenerate - some matches already played");
  }

  // Delete existing matches for this round
  await supabase.from("matches").delete().eq("round_id", round_id);

  // Get active players
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("tournament_id", tournament_id)
    .eq("status", "Active")
    .eq("confirmed", true);

  const result = await generateMatchesForRound(
    supabase,
    tournament,
    round,
    players
  );

  return jsonResponse({
    success: true,
    matches_created: result.matchCount,
    byes: result.byes.length,
  });
}

// ============================================================
// START AUCTION
// ============================================================
async function startAuction(supabase: any, body: any) {
  const { tournament_id } = body;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournament_id)
    .single();

  if (tournament.status !== "Finished")
    throw new Error("Tournament must be Finished to start auction");

  const now = new Date();
  const endsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Create auction
  const { data: auction, error: aErr } = await supabase
    .from("auctions")
    .insert({
      tournament_id,
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "Live",
    })
    .select()
    .single();
  if (aErr) throw aErr;

  // Get approved pledges
  const { data: pledges } = await supabase
    .from("pledge_items")
    .select("*")
    .eq("tournament_id", tournament_id)
    .eq("status", "Approved");

  // Create lots
  const lots = (pledges || []).map((p: any) => {
    // Min increment based on estimate
    const estimate = p.estimate_low || 50;
    let minIncrement = 5;
    if (estimate >= 600) minIncrement = 50;
    else if (estimate >= 300) minIncrement = 20;
    else if (estimate >= 100) minIncrement = 10;

    return {
      auction_id: auction.id,
      pledge_item_id: p.id,
      min_increment: minIncrement,
      ends_at: endsAt.toISOString(),
      status: "Live",
    };
  });

  if (lots.length > 0) {
    await supabase.from("auction_lots").insert(lots);
  }

  // Update tournament status
  await supabase
    .from("tournaments")
    .update({ status: "AuctionLive" })
    .eq("id", tournament_id);

  return jsonResponse({
    success: true,
    auction_id: auction.id,
    lots_created: lots.length,
  });
}

// ============================================================
// SETTLE AUCTION
// ============================================================
async function settleAuction(supabase: any, body: any) {
  const { tournament_id } = body;

  const { data: auction } = await supabase
    .from("auctions")
    .select("*")
    .eq("tournament_id", tournament_id)
    .single();
  if (!auction) throw new Error("No auction found");

  // Get all lots
  const { data: lots } = await supabase
    .from("auction_lots")
    .select("*")
    .eq("auction_id", auction.id)
    .eq("status", "Live");

  let settled = 0;
  for (const lot of lots || []) {
    // End the lot
    await supabase
      .from("auction_lots")
      .update({ status: "Ended" })
      .eq("id", lot.id);

    if (lot.current_winner_player_id && lot.current_bid) {
      // Settle escrow - mark as settled
      await supabase
        .from("escrow_holds")
        .update({ status: "Settled" })
        .eq("lot_id", lot.id)
        .eq("bidder_player_id", lot.current_winner_player_id)
        .eq("status", "Active");

      // Deduct credits from winner
      const { data: winner } = await supabase
        .from("players")
        .select("*")
        .eq("id", lot.current_winner_player_id)
        .single();

      if (winner) {
        await supabase
          .from("players")
          .update({
            credits_balance: winner.credits_balance - lot.current_bid,
          })
          .eq("id", winner.id);

        // Ledger entry
        await supabase.from("credit_ledger_entries").insert({
          tournament_id,
          player_id: winner.id,
          type: "AuctionSettlement",
          amount: -lot.current_bid,
          note: `Auction win settlement`,
        });
      }

      settled++;
    }

    // Release any remaining active escrow holds for other bidders
    await supabase
      .from("escrow_holds")
      .update({ status: "Released", released_at: new Date().toISOString() })
      .eq("lot_id", lot.id)
      .eq("status", "Active");
  }

  // Update auction and tournament
  await supabase
    .from("auctions")
    .update({ status: "Ended" })
    .eq("id", auction.id);
  await supabase
    .from("tournaments")
    .update({ status: "Closed" })
    .eq("id", tournament_id);

  return jsonResponse({ success: true, settled });
}

// ============================================================
// SEED DEMO
// ============================================================
async function seedDemo(supabase: any, body: any) {
  const { tournament_id } = body;

  const demoPlayers = [
    { full_name: "Carlos Mendez", phone: "+34600000001", gender: "male" },
    { full_name: "Maria García", phone: "+34600000002", gender: "female" },
    { full_name: "Juan Pérez", phone: "+34600000003", gender: "male" },
    { full_name: "Ana López", phone: "+34600000004", gender: "female" },
    { full_name: "Pedro Ruiz", phone: "+34600000005", gender: "male" },
    { full_name: "Sofia Torres", phone: "+34600000006", gender: "female" },
    { full_name: "Diego Martín", phone: "+34600000007", gender: "male" },
    { full_name: "Laura Sánchez", phone: "+34600000008", gender: "female" },
  ];

  const pin = "1234";
  const pinHash = hashPin(pin);

  // Create players
  const playerInserts = demoPlayers.map((p) => ({
    tournament_id,
    full_name: p.full_name,
    phone: p.phone,
    pin_hash: pinHash,
    gender: p.gender,
    confirmed: true,
    status: "Active",
  }));

  const { data: createdPlayers, error: pErr } = await supabase
    .from("players")
    .insert(playerInserts)
    .select();
  if (pErr) throw pErr;

  // Create pledges
  const categories = ["food", "drink", "object", "service", "chaos", "food", "drink", "object"];
  const pledgeTitles = [
    "Homemade Paella",
    "Bottle of Rioja",
    "Custom Padel Grip Set",
    "1hr Padel Lesson",
    "Mystery Box of Chaos",
    "Churros & Chocolate",
    "Sangria Pitcher",
    "Signed Padel Ball",
  ];

  const pledgeInserts = createdPlayers.map((p: any, i: number) => ({
    tournament_id,
    pledged_by_player_id: p.id,
    title: pledgeTitles[i],
    category: categories[i],
    description: `A wonderful ${categories[i]} pledge from ${p.full_name}`,
    quantity_text: "1",
    status: "Approved",
    approved: true,
    estimate_low: 50 + i * 20,
    estimate_high: 150 + i * 30,
  }));

  await supabase.from("pledge_items").insert(pledgeInserts);

  // Start tournament
  const startResult = await startTournament(supabase, { tournament_id });
  const startData = await startResult.json();

  return jsonResponse({
    success: true,
    players_created: createdPlayers.length,
    pledges_created: pledgeInserts.length,
    pin_for_all: "1234",
    tournament_started: startData.success,
    ...startData,
  });
}
