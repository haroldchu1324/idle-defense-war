# Idle Defense War — Server-Authoritative Conversion Package

## What this package contains

- `supabase_server_authoritative.sql` — tables, RLS, and RPC functions.
- `index_server_authoritative.html` — your uploaded game patched so key actions call Supabase RPC.
- `original_uploaded_backup.html` — untouched backup of your upload.

## Install steps

1. Open Supabase → SQL Editor.
2. Paste and run `supabase_server_authoritative.sql`.
3. Open `index_server_authoritative.html` through a local server, not double-clicking:
   ```bash
   python -m http.server 8000
   ```
   Then go to `http://localhost:8000/index_server_authoritative.html`.
4. Log in and test:
   - collect resources
   - unlock node
   - start upgrade
   - craft tower
   - start campaign battle
   - complete/lose battle

## Important security note

This is a strong server-authoritative foundation for resources, crafting, tower consumption, battle rewards, and campaign completion. Browser-only battle simulation can still be spoofed by an advanced attacker, so the next security step would be moving battle simulation itself into an Edge Function or validating a deterministic replay log.

## What changed compared with the original

Your original file saved everything with direct browser `game_saves.save_data` writes. The patched version stops uploading the whole client state and uses RPC functions such as:

- `idw_get_state`
- `idw_collect_resource`
- `idw_unlock_node`
- `idw_start_node_upgrade`
- `idw_craft_tower`
- `idw_start_battle`
- `idw_submit_battle_result`

## Rollback

Use `original_uploaded_backup.html` and restore your old RLS policies on `game_saves` if needed.
