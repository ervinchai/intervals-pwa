# Intervals

Self-hosted, installable PWA that runs on a docked iPad as an interactive
kitchen/household wall screen — a "life-OS" hub. Purpose-built screens (no
generic renderer), a [Windmill](https://windmill.dev) backend for all data and
logic, and Home Assistant for events and screen switching.

The Windmill scripts and flows that back this app live in a separate repo,
`intervals-backend`, developed alongside this one.

## Architecture

| Concern           | Choice                                                |
| ----------------- | ----------------------------------------------------- |
| UI                | React 19 + Vite + Tailwind, installed as a PWA         |
| Backend / logic   | Windmill scripts & flows (`intervals-backend` repo)    |
| Data contracts    | Zod schemas in `src/lib/contracts.ts`                  |
| Events / presence | Home Assistant WebSocket                              |
| Deploy            | Cloudflare Pages, build on push                        |

The one seam to the backend is [`src/lib/data.ts`](src/lib/data.ts): each screen
calls a `fetch*` function that either serves a fixture or runs a Windmill script
via `run_wait_result`, validating the result against the Zod contracts. Wiring a
real endpoint is a config flip, not a screen rewrite.

## Running

Runs on mock data out of the box — no Windmill or Home Assistant instance
required.

```bash
npm install
npm run dev
```

## Configuration

Runtime config is fetched from `/config.json` at boot (never bundled, so tokens
stay out of the shipped assets). Copy `public/config.example.json` to
`public/config.json` (gitignored) and fill in:

| Key                 | Meaning                                              |
| ------------------- | ---------------------------------------------------- |
| `windmillBaseUrl`   | Windmill instance URL (no trailing slash)            |
| `windmillWorkspace` | Workspace id the `intervals/` scripts live in        |
| `windmillToken`     | Windmill token, sent as `Authorization: Bearer`      |
| `haBaseUrl`         | Home Assistant URL                                   |
| `haToken`           | HA long-lived token for the WebSocket client         |
| `useMockData`       | Read from `src/mock` instead of calling Windmill     |
| `mockOverrides`     | Per-endpoint override of `useMockData`               |

For the Cloudflare Pages build, `scripts/gen-config.mjs` writes `config.json`
from `WINDMILL_*` / `HA_*` environment variables at build time
(`npm run build:pages`).
