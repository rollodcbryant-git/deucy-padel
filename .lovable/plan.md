

## Plan: Fix Blitz Tournament bugs

### Bug 1 — Players start with €0, betting impossible
Change initial balance from `0` to `10` in two places in `src/pages/BlitzTournament.tsx`:
- `handleStartTournament` (line 108): `names.map(name => ({ name, balance: 10 }))`
- `handleResetTournament` (line 187): `({ name: p.name, balance: 10 })`

### Bug 2 — Sequential round lock; need round picker

**Round picker UI** (Match tab, above the VS card):
- Render a `Select` dropdown listing all rounds whose `status === 'pending'` plus the currently active round, sorted by `round_index`.
- Each option label: `"Round X — {A1} & {A2} vs {B1} & {B2}"`.
- Pre-selected value = current active round.

**Switching active round** (`handleSwitchRound(newRoundIndex)`):
1. Find currently active round → set its status back to `'pending'`.
2. Find chosen round → set its status to `'active'`.
3. Update tournament `current_round = newRoundIndex`.
4. Reset timer (`setTimerSeconds(round_duration_seconds)`, `setTimerRunning(false)`), clear score inputs and bet selections, then `load()`.

**Score submission auto-advance** (`handleSubmitScore`, lines 162–172):
Replace the `roundIdx + 1` logic with: after marking current round `'completed'`, find the **next pending round** (lowest `round_index` with `status === 'pending'`) from `rounds`. 
- If found: set it `'active'`, update tournament `current_round = nextPending.round_index`.
- If none: set tournament `status = 'finished'`.

**"Tournament creator" gating**:
The `blitz_tournaments` table has no `created_by` field, and these tournaments have no auth tied to them (anonymous play, `players` is just a JSON array of names). To gate the picker without a backend change, I'll treat the **device that created the tournament** as the creator using `localStorage`:
- When `handleStartTournament` succeeds, write `localStorage.setItem('blitz_creator_' + id, '1')`.
- A boolean `isCreator = !!localStorage.getItem('blitz_creator_' + id)` controls whether the round-picker `Select` is rendered. Non-creators see plain read-only text: `"Round X"` (existing display).
- Note: this is a soft client-side gate (RLS allows anyone to update). Acceptable here because the whole blitz format is open/anonymous and matches existing patterns (delete is also open). If you want true server-side enforcement later, we'd add a `created_by_device_id` column.

### Files to edit
- `src/pages/BlitzTournament.tsx` — both bugs, picker UI, creator detection, auto-advance logic.

### Out of scope
No DB migration needed. Schema already supports arbitrary `current_round` updates and per-round `status`.

