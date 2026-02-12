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
      case "create_round":
        return await createRound(supabase, body);
      case "generate_matches":
        return await generateMatchesAction(supabase, body);
      case "auto_create_round_and_matches":
        return await autoCreateRoundAndMatches(supabase, body);
      case "end_round_now":
        return await endRoundNow(supabase, body);
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
      case "settle_bets":
        return await settleBetsForMatch(supabase, body);
      case "auto_match_remaining":
        return await autoMatchRemaining(supabase, body);
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

  const { data: tournament, error: tErr } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournament_id)
    .single();
  if (tErr) throw new Error(`Tournament not found: ${tErr.message}`);
  if (tournament.status !== "SignupOpen") throw new Error("Tournament must be in SignupOpen status");

  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("*")
    .eq("tournament_id", tournament_id)
    .eq("confirmed", true)
    .eq("status", "Active");
  if (pErr) throw pErr;

  // Allow starting with fewer players (minimum 4 for at least one match)
  if (players.length < 4) {
    throw new Error(`Need at least 4 confirmed players (have ${players.length})`);
  }

  const roundsCount = calculateRoundsCount(players.length);

  await supabase
    .from("tournaments")
    .update({ status: "Live", rounds_count: roundsCount })
    .eq("id", tournament_id);

  // Grant starting credits (skip players who already have a StartingGrant from join)
  const { data: existingGrants } = await supabase
    .from("credit_ledger_entries")
    .select("player_id")
    .eq("tournament_id", tournament_id)
    .eq("type", "StartingGrant");
  const alreadyGranted = new Set((existingGrants || []).map((e: any) => e.player_id));

  const playersNeedingGrant = players.filter((p: any) => !alreadyGranted.has(p.id));
  if (playersNeedingGrant.length > 0) {
    const creditEntries = playersNeedingGrant.map((p: any) => ({
      tournament_id,
      player_id: p.id,
      type: "StartingGrant",
      amount: tournament.starting_credits,
      note: "Starting credits",
    }));
    await supabase.from("credit_ledger_entries").insert(creditEntries);
  }

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

  for (const p of players) {
    await supabase
      .from("players")
      .update({
        credits_balance: tournament.starting_credits + tournament.participation_bonus,
      })
      .eq("id", p.id);
  }

  const matchResult = await generateMatchesForRound(supabase, tournament, round, players);

  // Link pre-tournament pledges (round_id IS NULL) to Round 1
  await supabase
    .from("pledge_items")
    .update({ round_id: round.id })
    .eq("tournament_id", tournament_id)
    .is("round_id", null);

  return jsonResponse({
    success: true,
    rounds_count: roundsCount,
    matches_created: matchResult.matchCount,
    byes: matchResult.byes.length,
  });
}

// ============================================================
// CREATE ROUND (standalone - no matches yet)
// ============================================================
async function createRound(supabase: any, body: any) {
  const { tournament_id } = body;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournament_id)
    .single();
  if (!tournament) throw new Error("Tournament not found");
  if (tournament.status !== "Live") throw new Error("Tournament must be Live");

  // Check no existing Live round
  const { data: liveRounds } = await supabase
    .from("rounds")
    .select("id")
    .eq("tournament_id", tournament_id)
    .eq("status", "Live");
  if (liveRounds && liveRounds.length > 0) throw new Error("A live round already exists");

  // Get completed rounds count
  const { data: allRounds } = await supabase
    .from("rounds")
    .select("*")
    .eq("tournament_id", tournament_id)
    .eq("is_playoff", false);
  const nextIndex = (allRounds || []).length + 1;

  const roundsCount = tournament.rounds_count || calculateRoundsCount(0);
  if (nextIndex > roundsCount) throw new Error("All rounds already completed");

  const now = new Date();
  const endAt = new Date(now.getTime() + tournament.round_duration_days * 24 * 60 * 60 * 1000);

  const { data: round, error: rErr } = await supabase
    .from("rounds")
    .insert({
      tournament_id,
      index: nextIndex,
      start_at: now.toISOString(),
      end_at: endAt.toISOString(),
      status: "Live",
    })
    .select()
    .single();
  if (rErr) throw rErr;

  // Grant participation bonus
  const { data: activePlayers } = await supabase
    .from("players")
    .select("*")
    .eq("tournament_id", tournament_id)
    .eq("status", "Active")
    .eq("confirmed", true);

  if (activePlayers && activePlayers.length > 0) {
    const bonusEntries = activePlayers.map((p: any) => ({
      tournament_id,
      player_id: p.id,
      round_id: round.id,
      type: "ParticipationBonus",
      amount: tournament.participation_bonus,
      note: `Round ${nextIndex} participation bonus`,
    }));
    await supabase.from("credit_ledger_entries").insert(bonusEntries);

    for (const p of activePlayers) {
      await supabase
        .from("players")
        .update({ credits_balance: p.credits_balance + tournament.participation_bonus })
        .eq("id", p.id);
    }
  }

  return jsonResponse({
    success: true,
    round_index: nextIndex,
    round_id: round.id,
    ends_at: endAt.toISOString(),
  });
}

// ============================================================
// GENERATE MATCHES (standalone - for existing round with no matches)
// ============================================================
async function generateMatchesAction(supabase: any, body: any) {
  const { tournament_id, round_id } = body;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournament_id)
    .single();
  if (!tournament) throw new Error("Tournament not found");

  const { data: round } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", round_id)
    .single();
  if (!round) throw new Error("Round not found");
  if (round.status !== "Live") throw new Error("Round must be Live");

  // Check if matches already exist
  const { data: existingMatches } = await supabase
    .from("matches")
    .select("id")
    .eq("round_id", round_id);
  if (existingMatches && existingMatches.length > 0) {
    throw new Error("Matches already exist for this round. Use regenerate instead.");
  }

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("tournament_id", tournament_id)
    .eq("status", "Active")
    .eq("confirmed", true);

  if (!players || players.length < 4) {
    throw new Error(`Need at least 4 confirmed active players (have ${players?.length || 0})`);
  }

  const result = await generateMatchesForRound(supabase, tournament, round, players);

  return jsonResponse({
    success: true,
    matches_created: result.matchCount,
    byes: result.byes.length,
  });
}

// ============================================================
// AUTO CREATE ROUND + MATCHES (one-click)
// ============================================================
async function autoCreateRoundAndMatches(supabase: any, body: any) {
  const { tournament_id } = body;

  // First create the round
  const roundResult = await createRound(supabase, body);
  const roundData = await roundResult.json();
  if (!roundData.success) return jsonResponse(roundData, 400);

  // Then generate matches
  const matchResult = await generateMatchesAction(supabase, {
    tournament_id,
    round_id: roundData.round_id,
  });
  const matchData = await matchResult.json();

  return jsonResponse({
    success: true,
    round_index: roundData.round_index,
    round_id: roundData.round_id,
    ends_at: roundData.ends_at,
    matches_created: matchData.matches_created,
    byes: matchData.byes,
  });
}

// ============================================================
// END ROUND NOW (admin override)
// ============================================================
async function endRoundNow(supabase: any, body: any) {
  const { tournament_id, round_id } = body;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournament_id)
    .single();
  if (!tournament) throw new Error("Tournament not found");

  const { data: round } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", round_id)
    .single();
  if (!round) throw new Error("Round not found");
  if (round.status !== "Live") throw new Error("Round must be Live to end");

  // Set end_at to now so check_advance_round treats it as expired
  const now = new Date();
  await supabase
    .from("rounds")
    .update({ end_at: now.toISOString() })
    .eq("id", round_id);

  // Now run the advance logic which handles penalties + next round creation
  return await checkAdvanceRound(supabase, { tournament_id });
}

// ============================================================
// GENERATE MATCHES FOR A ROUND (internal helper)
// ============================================================
async function generateMatchesForRound(
  supabase: any,
  tournament: any,
  round: any,
  players: any[]
) {
  const { data: pastMatches } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournament.id)
    .eq("is_bye", false);

  const partnerHistory = new Map<string, Set<string>>();
  for (const m of pastMatches || []) {
    if (m.team_a_player1_id && m.team_a_player2_id) {
      if (!partnerHistory.has(m.team_a_player1_id))
        partnerHistory.set(m.team_a_player1_id, new Set());
      if (!partnerHistory.has(m.team_a_player2_id))
        partnerHistory.set(m.team_a_player2_id, new Set());
      partnerHistory.get(m.team_a_player1_id)!.add(m.team_a_player2_id);
      partnerHistory.get(m.team_a_player2_id)!.add(m.team_a_player1_id);
    }
    if (m.team_b_player1_id && m.team_b_player2_id) {
      if (!partnerHistory.has(m.team_b_player1_id))
        partnerHistory.set(m.team_b_player1_id, new Set());
      if (!partnerHistory.has(m.team_b_player2_id))
        partnerHistory.set(m.team_b_player2_id, new Set());
      partnerHistory.get(m.team_b_player1_id)!.add(m.team_b_player2_id);
      partnerHistory.get(m.team_b_player2_id)!.add(m.team_b_player1_id);
    }
  }

  const { data: pastByes } = await supabase
    .from("matches")
    .select("bye_player_id")
    .eq("tournament_id", tournament.id)
    .eq("is_bye", true);
  const byeHistory = new Set((pastByes || []).map((b: any) => b.bye_player_id));

  let activePlayers = shuffleArray(players);
  const byes: any[] = [];

  while (activePlayers.length % 4 !== 0) {
    const noBye = activePlayers.filter((p) => !byeHistory.has(p.id));
    const byePlayer =
      noBye.length > 0
        ? noBye[noBye.length - 1]
        : activePlayers[activePlayers.length - 1];
    byes.push(byePlayer);
    activePlayers = activePlayers.filter((p) => p.id !== byePlayer.id);
  }

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

  const matches: any[] = [];
  for (let i = 0; i < activePlayers.length; i += 4) {
    const group = activePlayers.slice(i, i + 4);
    // Safety: never create a match with fewer than 4 players
    if (group.length < 4) {
      console.warn(`Skipping incomplete group of ${group.length} players`);
      break;
    }
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

    if (partnerHistory.get(p1A.id)?.has(p2A.id)) score -= 10;
    if (partnerHistory.get(p1B.id)?.has(p2B.id)) score -= 10;

    if (p1A.gender && p2A.gender && p1A.gender !== p2A.gender) score += 3;
    if (p1B.gender && p2B.gender && p1B.gender !== p2B.gender) score += 3;

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

  const isTeamA =
    match.team_a_player1_id === player_id ||
    match.team_a_player2_id === player_id;

  const absoluteSetsA = player_id ? (isTeamA ? sets_a : sets_b) : sets_a;
  const absoluteSetsB = player_id ? (isTeamA ? sets_b : sets_a) : sets_b;

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

  // Per-set euro scoring system
  const winPerSet = tournament.euros_per_set_win || 200; // cents
  const losePerSet = tournament.euros_per_set_loss || 200; // cents
  const allowNegative = tournament.allow_negative_balance || false;

  const allPlayerIds = [
    match.team_a_player1_id,
    match.team_a_player2_id,
    match.team_b_player1_id,
    match.team_b_player2_id,
  ].filter(Boolean);

  const teamAIds = [match.team_a_player1_id, match.team_a_player2_id].filter(Boolean);
  const teamBIds = [match.team_b_player1_id, match.team_b_player2_id].filter(Boolean);

  // Calculate per-player net based on sets
  // Team A won absoluteSetsA sets, lost absoluteSetsB sets
  // Team A players: gain = absoluteSetsA * winPerSet, loss = absoluteSetsB * losePerSet
  const teamANet = (absoluteSetsA * winPerSet) - (absoluteSetsB * losePerSet);
  const teamBNet = (absoluteSetsB * winPerSet) - (absoluteSetsA * losePerSet);

  const ledgerEntries: any[] = [];

  // Record per-player ledger entries
  for (const pid of teamAIds) {
    if (teamANet !== 0) {
      ledgerEntries.push({
        tournament_id: match.tournament_id,
        player_id: pid,
        match_id,
        round_id: match.round_id,
        type: teamANet > 0 ? "MatchPayout" : "MatchStake",
        amount: teamANet,
        note: `Sets ${absoluteSetsA}-${absoluteSetsB}: ${teamANet > 0 ? '+' : ''}${(teamANet / 100).toFixed(0)}€`,
      });
    }
  }

  for (const pid of teamBIds) {
    if (teamBNet !== 0) {
      ledgerEntries.push({
        tournament_id: match.tournament_id,
        player_id: pid,
        match_id,
        round_id: match.round_id,
        type: teamBNet > 0 ? "MatchPayout" : "MatchStake",
        amount: teamBNet,
        note: `Sets ${absoluteSetsB}-${absoluteSetsA}: ${teamBNet > 0 ? '+' : ''}${(teamBNet / 100).toFixed(0)}€`,
      });
    }
  }

  if (ledgerEntries.length > 0) {
    await supabase.from("credit_ledger_entries").insert(ledgerEntries);
  }

  // Update player stats and balance
  for (const pid of allPlayerIds) {
    const isOnTeamA = teamAIds.includes(pid);
    const netCredit = isOnTeamA ? teamANet : teamBNet;
    const isWinnerTeamA = absoluteSetsA > absoluteSetsB;
    const isWinner = (isWinnerTeamA && isOnTeamA) || (!isWinnerTeamA && !isOnTeamA);

    const { data: currentPlayer } = await supabase
      .from("players")
      .select("*")
      .eq("id", pid)
      .single();

    if (currentPlayer) {
      const setsWon = isOnTeamA ? absoluteSetsA : absoluteSetsB;
      const setsLost = isOnTeamA ? absoluteSetsB : absoluteSetsA;

      let newBalance = currentPlayer.credits_balance + netCredit;
      if (!allowNegative && newBalance < 0) newBalance = 0;

      await supabase
        .from("players")
        .update({
          credits_balance: newBalance,
          matches_played: currentPlayer.matches_played + 1,
          sets_won: currentPlayer.sets_won + setsWon,
          sets_lost: currentPlayer.sets_lost + setsLost,
          match_wins: currentPlayer.match_wins + (isWinner && !is_unfinished ? 1 : 0),
          match_losses: currentPlayer.match_losses + (!isWinner && !is_unfinished ? 1 : 0),
        })
        .eq("id", pid);
    }
  }

  await checkRoundCompletion(supabase, match.round_id, match.tournament_id);

  // Auto-settle bets on this match
  await autoSettleBets(supabase, match_id, match.tournament_id, absoluteSetsA, absoluteSetsB);

  return jsonResponse({ success: true, teamANet, teamBNet });
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
    await supabase
      .from("rounds")
      .update({ status: "Completed" })
      .eq("id", roundId);
  }
}

// ============================================================
// CHECK AND ADVANCE ROUND
// ============================================================
async function checkAdvanceRound(supabase: any, body: any) {
  const { tournament_id } = body;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournament_id)
    .single();
  if (!tournament) throw new Error("Tournament not found");

  const { data: liveRounds } = await supabase
    .from("rounds")
    .select("*")
    .eq("tournament_id", tournament_id)
    .eq("status", "Live");

  if (!liveRounds || liveRounds.length === 0) {
    return jsonResponse({ success: true, message: "No live round" });
  }

  const currentRound = liveRounds[0];
  const now = new Date();
  const { data: overdueMatches } = await supabase
    .from("matches")
    .select("*")
    .eq("round_id", currentRound.id)
    .in("status", ["Scheduled", "BookingClaimed"]);

  const isRoundExpired = currentRound.end_at && new Date(currentRound.end_at) <= now;
  let penaltiesApplied = 0;

  if (isRoundExpired && overdueMatches && overdueMatches.length > 0) {
    for (const match of overdueMatches) {
      const playerIds = [
        match.team_a_player1_id,
        match.team_a_player2_id,
        match.team_b_player1_id,
        match.team_b_player2_id,
      ].filter(Boolean);

      await supabase
        .from("matches")
        .update({ status: "AutoResolved" })
        .eq("id", match.id);

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

      await generateMatchesForRound(supabase, tournament, newRound, activePlayers);

      return jsonResponse({
        success: true,
        penalties_applied: penaltiesApplied,
        new_round: nextRoundIndex,
      });
    }
  } else {
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

  const { data: playedMatches } = await supabase
    .from("matches")
    .select("id")
    .eq("round_id", round_id)
    .eq("status", "Played");

  if (playedMatches && playedMatches.length > 0) {
    throw new Error("Cannot regenerate - some matches already played");
  }

  await supabase.from("matches").delete().eq("round_id", round_id);

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
  const { tournament_id, duration_hours } = body;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournament_id)
    .single();

  // Allow starting auction from Finished OR already-finished states
  // Don't block if admin wants to re-launch
  if (!["Finished", "AuctionLive", "Closed"].includes(tournament.status) && tournament.status !== "Live") {
    throw new Error("Tournament should be Finished to start auction");
  }

  const hours = duration_hours || 24;
  const now = new Date();
  const endsAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const { data: auction, error: aErr } = await supabase
    .from("auctions")
    .insert({
      tournament_id,
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "Live",
      duration_hours: Math.max(1, Math.round(hours)),
    })
    .select()
    .single();
  if (aErr) throw aErr;

  const { data: pledges } = await supabase
    .from("pledge_items")
    .select("*")
    .eq("tournament_id", tournament_id)
    .eq("status", "Approved");

  const lots = (pledges || []).map((p: any) => {
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

  await supabase
    .from("tournaments")
    .update({ status: "AuctionLive" })
    .eq("id", tournament_id);

  return jsonResponse({
    success: true,
    auction_id: auction.id,
    lots_created: lots.length,
    duration_hours: hours,
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
    .maybeSingle();
  if (!auction) return jsonResponse({ error: "No auction found for this tournament. Create an auction first." }, 400);

  const { data: lots } = await supabase
    .from("auction_lots")
    .select("*")
    .eq("auction_id", auction.id)
    .eq("status", "Live");

  let settled = 0;
  for (const lot of lots || []) {
    await supabase
      .from("auction_lots")
      .update({ status: "Ended" })
      .eq("id", lot.id);

    if (lot.current_winner_player_id && lot.current_bid) {
      await supabase
        .from("escrow_holds")
        .update({ status: "Settled" })
        .eq("lot_id", lot.id)
        .eq("bidder_player_id", lot.current_winner_player_id)
        .eq("status", "Active");

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

    await supabase
      .from("escrow_holds")
      .update({ status: "Released", released_at: new Date().toISOString() })
      .eq("lot_id", lot.id)
      .eq("status", "Active");
  }

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

// ============================================================
// AUTO-SETTLE BETS (called after match result)
// ============================================================
async function autoSettleBets(
  supabase: any,
  matchId: string,
  tournamentId: string,
  setsA: number,
  setsB: number,
) {
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("payout_multiplier, bank_balance")
    .eq("id", tournamentId)
    .single();

  if (!tournament) return;

  const multiplier = Number(tournament.payout_multiplier) || 2.0;
  const winner = setsA > setsB ? "team_a" : "team_b";

  const { data: pendingBets } = await supabase
    .from("match_bets")
    .select("*")
    .eq("match_id", matchId)
    .eq("status", "Pending");

  if (!pendingBets || pendingBets.length === 0) return;

  let bankChange = 0;

  for (const bet of pendingBets) {
    const isWinner = bet.predicted_winner === winner;
    const payout = isWinner ? Math.round(bet.stake * multiplier) : 0;
    const now = new Date().toISOString();

    // Update bet
    await supabase
      .from("match_bets")
      .update({
        status: isWinner ? "Won" : "Lost",
        payout: isWinner ? payout : 0,
        settled_at: now,
      })
      .eq("id", bet.id);

    if (isWinner) {
      // Credit payout to player
      const { data: player } = await supabase
        .from("players")
        .select("credits_balance")
        .eq("id", bet.player_id)
        .single();

      if (player) {
        await supabase
          .from("players")
          .update({ credits_balance: player.credits_balance + payout })
          .eq("id", bet.player_id);
      }

      await supabase.from("credit_ledger_entries").insert({
        tournament_id: tournamentId,
        player_id: bet.player_id,
        match_id: matchId,
        round_id: bet.round_id,
        type: "BetPayout",
        amount: payout,
        note: `Bet won! ${multiplier}x payout`,
      });

      bankChange -= payout;
    } else {
      // Losing bet: stake already deducted, goes to bank
      bankChange += bet.stake;
    }
  }

  // Update bank balance
  await supabase
    .from("tournaments")
    .update({ bank_balance: tournament.bank_balance + bankChange })
    .eq("id", tournamentId);

  console.log(`Settled ${pendingBets.length} bets for match ${matchId}. Bank change: ${bankChange}`);
}

// ============================================================
// SETTLE BETS (manual admin action for specific match)
// ============================================================
async function settleBetsForMatch(supabase: any, body: any) {
  const { match_id } = body;

  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", match_id)
    .single();

  if (!match) throw new Error("Match not found");
  if (match.status !== "Played") throw new Error("Match must be played first");

  await autoSettleBets(supabase, match_id, match.tournament_id, match.sets_a, match.sets_b);

  return jsonResponse({ success: true });
}

// ============================================================
// AUTO-MATCH REMAINING PLAYERS (late joiners)
// ============================================================
async function autoMatchRemaining(supabase: any, body: any) {
  const { tournament_id, round_id } = body;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournament_id)
    .single();
  if (!tournament) throw new Error("Tournament not found");

  const { data: round } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", round_id)
    .single();
  if (!round || round.status !== "Live") throw new Error("Round must be Live");

  // Get all active confirmed players
  const { data: allPlayers } = await supabase
    .from("players")
    .select("*")
    .eq("tournament_id", tournament_id)
    .eq("status", "Active")
    .eq("confirmed", true);

  // Get players already in matches for this round
  const { data: existingMatches } = await supabase
    .from("matches")
    .select("team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id, bye_player_id, is_bye")
    .eq("round_id", round_id);

  const matchedPlayerIds = new Set<string>();
  for (const m of existingMatches || []) {
    if (m.is_bye && m.bye_player_id) matchedPlayerIds.add(m.bye_player_id);
    if (m.team_a_player1_id) matchedPlayerIds.add(m.team_a_player1_id);
    if (m.team_a_player2_id) matchedPlayerIds.add(m.team_a_player2_id);
    if (m.team_b_player1_id) matchedPlayerIds.add(m.team_b_player1_id);
    if (m.team_b_player2_id) matchedPlayerIds.add(m.team_b_player2_id);
  }

  const unmatchedPlayers = (allPlayers || []).filter((p: any) => !matchedPlayerIds.has(p.id));

  if (unmatchedPlayers.length < 4) {
    return jsonResponse({ success: true, message: `Only ${unmatchedPlayers.length} unmatched players (need at least 4)`, matches_created: 0 });
  }

  const result = await generateMatchesForRound(supabase, tournament, round, unmatchedPlayers);

  // Grant participation bonus to newly matched players (if they haven't received one)
  for (const p of unmatchedPlayers) {
    const { data: existing } = await supabase
      .from("credit_ledger_entries")
      .select("id")
      .eq("player_id", p.id)
      .eq("round_id", round_id)
      .eq("type", "ParticipationBonus")
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabase.from("credit_ledger_entries").insert({
        tournament_id,
        player_id: p.id,
        round_id: round_id,
        type: "ParticipationBonus",
        amount: tournament.participation_bonus,
        note: `Round ${round.index} participation bonus (late join)`,
      });
      await supabase
        .from("players")
        .update({ credits_balance: p.credits_balance + tournament.participation_bonus })
        .eq("id", p.id);
    }
  }

  return jsonResponse({
    success: true,
    unmatched_count: unmatchedPlayers.length,
    matches_created: result.matchCount,
    byes: result.byes.length,
  });
}
