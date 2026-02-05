

# Padel Chaos Cup - Implementation Plan

## Overview
A mobile-first web app for running friends padel tournaments with rotating partners, a credits economy, and a climactic 24-hour digital auction. Dark & bold design, playful tone, zero clutter.

---

## Tech Stack
- **Frontend**: React + TypeScript + Tailwind (dark theme)
- **Backend**: Lovable Cloud (Supabase) - Database, Auth, Real-time, Storage
- **Real-time**: Supabase Realtime for live auction bids

---

## Core Screens & Features

### 1. Landing & Authentication
- **Tournament landing page** with title, playful tagline, and join code
- **Join flow**: Name → Phone → Gender (optional) → Avatar upload (optional)
- **PIN reveal screen** (show once, player saves it)
- **Returning player login**: Phone + 4-digit PIN
- Session persists on device

### 2. Player Home (Main Hub)
- **Credits balance** prominently displayed with current rank
- **Next action card** that adapts to tournament status:
  - *Signup phase*: "Confirm participation" button
  - *Live round*: Match card with partner, opponents, deadline countdown
  - *Bye round*: Playful message ("Enjoy the ego boost")
- **Quick actions**: Claim booking, open club link, match chat (phone list), report result
- **Bottom navigation**: Matches | Leaderboard | Players | Auction (when live)

### 3. Match Flow
- **Match card**: Partner + opponents + deadline timer
- **"I'll book it" button** - one tap to claim
- **Phone list** for the 4 players with WhatsApp deep links
- **Result reporting**: Simple set input (Team A: 0-3, Team B: 0-3)
- **Unfinished match toggle** for 1-1 splits
- **Fun confirmation toast** after submission

### 4. Leaderboard
- **Rankings by credits** (primary)
- Tiebreakers: set diff → match wins → fewer no-shows
- **Top 10 preview** on home, full list on dedicated screen
- Clean cards with player avatar, name, credits, position

### 5. Players (Contact List)
- List of all players with phone numbers
- **WhatsApp deep link** for quick messaging
- Status chips: Active / Inactive Warning / Removed

### 6. Auction (24h Grand Finale)
- **Big countdown timer** at top
- **Lot cards**: Image, title, pledged by, estimate range, current bid, bid count
- **Filters**: Ending soon | Most bids | No bids yet
- **Lot detail page**:
  - Current bid + countdown (per-lot if anti-sniping extends)
  - "Place bid" with suggested next bid
  - Bid history (open, transparent)
  - **Real-time updates** via Supabase Realtime
- **Escrow system**: Credits reserved on bid, released instantly if outbid
- **Anti-sniping**: +5 min extension if bid in last 5 min (max 3 per lot)

### 7. Pledge Submission
- During signup phase, each player submits 1 pledge
- Form: Title, category (food/drink/object/service/chaos), quantity, description, optional photo
- Admin approves and sets estimate range before auction starts

---

## Admin Panel (Minimal but Complete)

- **Tournament settings**: Round duration (7-14 days), stake rate, participation bonus, max players
- **Player management**: View list, remove/reinstate
- **Round controls**: Start tournament, regenerate pairings (max 3 tries), manual edit fallback
- **Match oversight**: View overdue matches, auto-resolution logs
- **Pledge management**: Approve items, set estimate ranges
- **Auction controls**: Start/stop auction
- **Export**: Results summary, auction delivery list (for WhatsApp)

---

## Automated Tournament Logic

### Round Generation
- Auto-calculate rounds based on player count (8-12: 3 rounds, 14-18: 4, 20-24: 5)
- Semis + Final always included

### Pairing Rules
- Every active player gets a match each round
- **Never repeat partners** (highest priority)
- Avoid repeated opponents when possible
- Prefer mixed-gender teams (never pair two women unless no alternative)
- Handle odd numbers with bye (player still gets participation bonus)

### Deadlines & Auto-Enforcement
- Configurable round duration (default 10 days)
- In-app nudges at Day 3, Day 7, and 24h remaining
- **Overdue handling**:
  - -50 credits penalty to all 4 players
  - Match marked AutoResolved
  - 2 overdue matches → player removed (diplomatic messaging)

---

## Credits Economy

| Event | Amount |
|-------|--------|
| Starting grant | +1000 |
| Participation bonus (per round) | +50 |
| Match stake (per player) | -20 |
| Win 2-0 | +100% pot split |
| Win 2-1 | +66% pot split |
| Lose 2-1 | +34% pot split |
| Lose 2-0 | +0 |
| Unfinished 1-1 | +50/50 split |
| Overdue penalty | -50 |
| Final winner bonus | +100 |

All movements tracked in credit ledger with full audit trail.

---

## Playoffs
- After Swiss rounds, top 4 go to playoffs
- **Semis**: #1+#4 vs #2+#3
- **Final**: Semi winners
- Champion bonus: +100 credits each to final winners

---

## Design Direction
- **Dark & bold**: Dark backgrounds, vibrant accent colors (neon green/electric blue)
- **Large touch targets**: Buttons sized for thumbs
- **Status chips**: Clear visual states throughout
- **Countdown timers**: Prominent and urgent
- **Playful microcopy**: Witty, lightly roast-y, never cringe
- **Minimal screens**: One primary action per view

---

## Database Tables
- Tournament, Player, Round, Match
- CreditLedgerEntry (full audit trail)
- PledgeItem, Auction, AuctionLot, Bid, EscrowHold

---

## MVP Deliverables
1. Join via invite link with phone/PIN auth
2. Player confirmation + tournament start
3. Auto-generated rounds with smart pairing
4. Booking claims + phone contact list
5. Set-based match reporting with auto credit calculations
6. Live credits leaderboard
7. Pledge submission + admin approval
8. 24h real-time auction with escrow + anti-sniping
9. Results export for WhatsApp sharing
10. Complete admin panel

