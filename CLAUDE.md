# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A collection of standalone utility tools. No shared build system or dependencies between tools.

## Repository layout

| Path | Purpose |
|------|---------|
| `CompliancyManager/` | Browser-based compliance requirement tracker (vanilla JS, no build step) |
| `PAT/` | Bash script for batch PCAP analysis using tshark |

Each tool has its own README with full details.

## CompliancyManager

Single-page application — `index.html`, `app.js`, `style.css`. No framework, no build step. Open `index.html` directly in a browser or run via Docker.

Key implementation details:
- RFC 4180 CSV parser (character-by-character, handles embedded newlines and BOM)
- State: `rows[]` array as single source of truth; localStorage for persisted edits
- Storage keys: `ct-remarks`, `ct-compliancy`. Values stored as `{ v, h }` where `h` is a hash of the requirement text — stale edits are discarded if the requirement text changes for a reused ID
- Card events handled via delegation on `#cards-area` (not per-element listeners)
- Partial re-renders (`renderStats`, `renderFilterLabels`) preserve textarea focus during editing; full `render()` only on import and clear
- Toast notifications via `showToast(message)`
- Docker: `nginx.conf` provides gzip, cache headers, and SPA routing

## PAT

Single bash script (`analysis.sh`). Run in the directory containing `.pcap` files.

Key implementation details:
- Loads each pcap into `/dev/shm` ramdisk before analysis
- 12 analysis functions run as parallel background jobs, throttled to CPU count
- Uses `wait` (not `wait -n`) after all jobs per pcap before cleanup
- Requires `tshark`; exits with error if not found or no `.pcap` files present
