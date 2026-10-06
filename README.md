# Sports-Card-Builder

A minimal Rogers-AI-powered baseball card builder app with multi-series release support.

It now includes structured sets for:
- Topps Now 2026
- Diamond Kings 2026
- Future Stars 2026
- Front Office Icons 2026
- Pitching Excellence 2026
- Team Spotlight Cards

Including a starter wave:
1. Dave Stieb - Most Underrated Pitcher of the 1980s
2. Jacob deGrom — 100 Wins
3. Orioles 6-Run First Inning Team Spotlight

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

The app uses the existing Rogers AI gateway and does not ask for an external AI key. If Rogers is unavailable, it returns a template-safe draft card using the locked style rules.

Open `http://localhost:3000`.

## ⚡ Auto Card (no input needed)

Tap **⚡ Auto Card** (or **Auto ×3**) and the builder pulls a finished, numbered card front **and** back every time — no upload or typing required. **Pull Another** opens a fresh "pack"; **Download** saves the side you are viewing.

Anything you add only steers the build:

| You type / provide | Effect |
| --- | --- |
| A player name (`Aaron Judge`, `deGrom`, any `First Last`) | Subject of the card |
| A team (`Orioles`, `Red Sox`) | Team colours; a team-only request becomes a team spotlight card |
| `chrome`, `heritage`/`vintage`, `now`/`moment`, `diamond kings`/`painted`, `prospects`/`bowman`, `flagship` | Set design |
| `refractor`, `blue`, `gold`, `orange`, `red`, `black`/`1/1`, `superfractor`, or `/150`, `/50`, `/25`, `/5` | Parallel, with a serial number inside the print run |
| `auto`, `relic`/`patch`, `rookie`/`RC` (or `no auto`, `no relic`) | Hits and badges |
| A year (`1985`) or a quoted headline (`"6-Run First Inning"`) | Card year / NOW headline |
| An uploaded photo | Used as the exact card artwork |

How it works (`public/auto-card.js`):

1. The request is turned into a seeded card spec: subject, set, parallel, serial number, card number (`CRA-AJ`, `DK-12`…), rookie/auto/relic, plus a rarity tier, Value Index and simulated pack odds.
2. Verified stats come from the existing `/v1/card-intel` service when it responds. Stats are never made up; if the service doesn't respond, the back prints only facts the build already has.
3. Artwork, tried in order: your uploaded photo → a free text-to-image model (FLUX via Pollinations) → the project's `/v1/image` reference renderer → procedural painted artwork made in the browser. Because the last step always works, every build finishes.
4. The frame, nameplate, foil serial, RC shield, blue-ink signature, relic window and the stat-table back are drawn on a canvas at 750×1050 (2.5×3.5 in at 300 dpi), so names are always spelled correctly.

Cards carry the product's own brand mark (`INFINITY` by default; set **Brand** in the identity fields to change it). The design follows modern flagship / chrome / heritage / NOW card conventions but does not reproduce Topps, Panini or MLB trademarks or logos.

## Test

```bash
npm test
```
