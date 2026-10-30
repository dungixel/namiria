# Namiria

A turn-based 2D card duel. Two players, 20 shared HP each, six cards in hand, two actions per turn, and everything plays out on a 10-tile strip. Right now you play against a bot; the code is organised so that the match can later move online (Supabase) and be hosted on GitHub Pages.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

**No terminal?** Double-click `Namiria.html` in this folder; it is a self-contained build of the game (rebuild it with `npm run build:single`, output in `dist-single/`).

Other scripts: `npm test` (rules + bot tests), `npm run build`, `npm run preview`, `npm run typecheck`.

## How to play

* Press **Play**. You are paired with a bot instantly. Both of you start on tiles **4** and **6** with **20 HP**.
* Each turn you have **30 seconds** to pick **two cards** from your hand of six (click them, or press `1`-`6`). The first card you click is your 1st action, the second your 2nd. Click a picked card again to take it back. When both players have picked two (or time is up) the cards play out.
* **Everything is public except the choice:** you can see the bot's six cards and its NEXT card, and it can see yours. Only *which two* each of you picked stays hidden until they are played.
* After a turn the used cards are replaced: the NEXT card drops into your hand and a new NEXT is drawn.
* Hover a card to read it (and to preview the tiles it would affect). Hover your HP bar for the unit's stats.

### The cards

| Card | What it does |
| --- | --- |
| **Attack** | Hits the tile exactly *Range* away (toward the enemy) for *Power* damage. Misses if nobody is there. |
| **Special** | The unit's special. Umiro heals 1 HP (max 20). |
| **Step** | Move 1..*Speed* tiles left or right. You choose the tile (10 s) when the card plays. Can't walk through or onto the enemy. |
| **Block** | Stops any attack during that action, even from behind. Doesn't stop specials. |
| **Grab** | Enemy exactly 1 tile away: deals ⌈Power / 2⌉, ignores Block and cancels what the victim was doing that action. Then you pick (10 s) where to throw them: up to 2 tiles from you, either side. The damage lands when they hit the ground, not at the grab. |
| **Change** | Switch to the next unit of your team. |

### Umiro (the only unit for now)

Power 3 · Range 2 · Speed 2 · Special: heal 1 · Passive: **can't be blocked twice** (if the opponent's 1st Block actually stopped one of his attacks and they Block again as their 2nd action, the 2nd Block breaks and the attack lands in full; a 1st Block that blocked nothing doesn't count).

### Order of events inside one action

1. **Change** → 2. **Step** (both players move at the same time; if both pick the same tile they *clash* and bounce back to where they were) → 3. **Block** goes up → 4. **Grab** (both grabbing each other = clash, nothing happens) → 5. **Attack / Special** (simultaneous; damage and healing land together).

So moving first means a Step dodges an Attack or Grab aimed at the tile you left, and a Grab beats Block, Attack and Special but not a Step away.

## Decisions I made where the brief was open

Everything here is a one-line change, mostly in `src/engine/constants.ts` or `units.ts`:

* Board tiles are numbered 1-10; units start on 4 and 6 (so the left player has 3 tiles behind them and the right player 4).
* Attack range is *exact* (Umiro hits 2 away, not 1); attacks always point at the enemy.
* Grab throw range is measured from the grabber (1-2 tiles, either side, the victim's own tile counts as "drop").
* A unit that is grabbed loses its own action in that slot.
* Timeouts: unfilled actions are skipped; an unanswered Step stays put; an unanswered throw drops the enemy where it stands.
* Heal can't exceed 20 HP. A mutual KO is a draw.
* Change cycles to the next of your three units (they are all Umiro, so for now it only moves the "active" pip).
* Card draws come from a shuffled bag (3 Attack, 3 Step, 2 Block, 2 Grab, 2 Special, 1 Change), reshuffled when empty.
* The Grab and Block sprites you provided are the same image, so grabbing and blocking look alike; the fist/shield icon from the card art is shown to tell them apart.

## Project layout

```
src/engine/    Pure TypeScript rules (no React, no browser APIs). The turn resolver is a generator
               that streams "beats" for the UI to animate and asks for decisions (step / throw).
src/bot/       Monte-Carlo bot that simulates its options with the real engine.
src/game/      MatchController: timers, bot lock-in, plays each beat back with animations.
src/ui/        React components (1500x1000 canvas scaled to the window).
src/assets/    Processed art + manifest.json (generated, committed).
Resources/     Your original art (untouched).
scripts/prepare-assets.py   Rebuilds src/assets from Resources/ (pillow, numpy, scipy).
```

### Going online with Supabase (suggested path)

The engine is deterministic: `createGame(seed)` + two `Picks` per player fully determine a turn, and the shuffle RNG state lives inside `GameState`. Because hands are public there is no hidden state to protect except each player's picks, so a simple server-authoritative design works:

1. A `matches` table holds the seed, the current `GameState` JSON, and each player's locked `Picks` for the turn (RLS: you can write only your own picks, and read the other's only after both are in).
2. When both picks are in, an Edge Function runs `resolveSync(state, picks, policy)` from `src/engine` (it can import the same files), where `policy` answers Step/Throw from the players' submitted choices, and writes the new state. Step and throw choices are asked mid-turn, so either submit them as extra rows in a `decisions` table, or switch the resolver to a request/response loop over Realtime.
3. Clients subscribe to the match via Realtime and replay the resulting beats with the existing `MatchController` animations (replace `chooseBotPicks` with "wait for the other player's row").

### GitHub Pages

`vite.config.ts` reads `VITE_BASE`; build with `VITE_BASE=/your-repo-name/ npm run build` and publish `dist/`.
