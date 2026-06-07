# Sports-Card-Builder

A minimal Gemini-powered baseball card builder app with multi-series release support.

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
GEMINI_API_KEY=your_key_here npm start
```

If `GEMINI_API_KEY` is not set, the app still returns a template-safe draft card using the locked style rules.

Open `http://localhost:3000`.

## Test

```bash
npm test
```
