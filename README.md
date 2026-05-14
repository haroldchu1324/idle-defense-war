# Idle Defense War — Project Structure

## File Layout

```
idw/
├── index.html          ← Main entry point (HTML only, no inline JS/CSS)
├── netlify.toml        ← Auto-deploy config for Netlify
├── css/
│   └── styles.css      ← All styles
└── js/
    ├── supabase.js     ← Supabase client init + RPC adapter
    ├── constants.js    ← Formulas, RESOURCE_DEFS, tier tables
    ├── state.js        ← Global state variables + session broadcast
    ├── auth.js         ← Login, signup, logout, startGame, save/load, offline
    ├── loop.js         ← RAF game loop (tickAll)
    ├── player.js       ← Player level, XP, buffs modal
    ├── resources.js    ← Resource gathering, node cards, collect all, node modal
    ├── research.js     ← Research tree definitions + panel + modal
    ├── inventory.js    ← Inventory / armory panel
    ├── crafting.js     ← Tower definitions + crafting panel
    ├── campaign.js     ← Campaign map + stage select
    ├── battle.js       ← Tower defense battle engine (canvas, waves, towers)
    └── ui.js           ← Section navigation, tab switching, toast
```

## Making changes

| I want to change...         | Edit this file          |
|-----------------------------|-------------------------|
| Login / signup flow         | `js/auth.js`            |
| Save / load / offline       | `js/auth.js`            |
| Resource gathering nodes    | `js/resources.js`       |
| Research tree               | `js/research.js`        |
| Crafting a tower            | `js/crafting.js`        |
| Tower stats / definitions   | `js/crafting.js`        |
| Campaign map layout         | `js/campaign.js`        |
| Battle engine / waves       | `js/battle.js`          |
| Tower targeting / shooting  | `js/battle.js`          |
| Player level / XP           | `js/player.js`          |
| Inventory / armory          | `js/inventory.js`       |
| Resource formulas           | `js/constants.js`       |
| Supabase RPC calls          | `js/supabase.js`        |
| UI navigation / tabs        | `js/ui.js`              |
| Any styling / colors        | `css/styles.css`        |
| HTML structure / layout     | `index.html`            |

## Netlify auto-deploy setup

1. Push this folder to a GitHub repo
2. Go to [app.netlify.com](https://app.netlify.com) → Add new site → Import from Git
3. Select your repo — Netlify detects `netlify.toml` automatically
4. Every `git push` to main auto-deploys

**Supabase redirect URL:** Add your Netlify URL to:
> Supabase Dashboard → Authentication → URL Configuration → Redirect URLs

## Running locally

```bash
python -m http.server 8000
# then open http://localhost:8000
```

Or use VS Code Live Server — just don't open index.html directly as a file (Supabase auth needs HTTP).
