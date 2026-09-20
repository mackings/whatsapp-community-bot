# WhatsApp Community Bot

Realtime WhatsApp community message ingestion + categorization, with a live dashboard.

## Structure

```
backend/    Node + TypeScript + Baileys — connects to WhatsApp, categorizes messages,
            stores them in SQLite, and serves them over a REST API + WebSocket.
frontend/   React + Vite + TypeScript + Tailwind — realtime dashboard.
```

### Backend layout

```
backend/src/
  config/        env loading
  whatsapp/      Baileys socket, group metadata cache, message parsing/handling
  categorizer/   pluggable message classifier (keyword-based by default)
  db/            SQLite schema + repositories
  api/           Express REST routes + WebSocket broadcaster
  types/         shared domain types
```

### Frontend layout

```
frontend/src/
  api/           REST client + config
  hooks/         useRealtime, useMessages, useGroups, useStats
  components/    layout/, messages/, stats/, ui/
  pages/         Dashboard
```

## Setup

```bash
npm install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Run

```bash
# terminal 1
npm run dev:backend
```

On first run, either:
- scan the printed QR code with WhatsApp (Linked Devices → Link a Device), or
- set `PAIRING_NUMBER` in `backend/.env` to get a pairing code instead.

Use a dedicated/burner WhatsApp number for the bot, not your personal one.

Once connected, **add that bot number as a participant to each WhatsApp group**
you want it to read (a WhatsApp Community is just a set of linked groups — the
bot only sees messages in groups it's actually a member of).

```bash
# terminal 2
npm run dev:frontend
```

Open http://localhost:5173. Messages will appear in the feed in realtime as
they arrive in any group the bot has joined, tagged with a category.

## Categorization

The default categorizer (`backend/src/categorizer/keywordCategorizer.ts`) uses
simple regex rules (question, announcement, urgent, greeting, media, spam,
general). It implements the `Categorizer` interface in
`backend/src/types/index.ts`, so it can be swapped for an LLM-based classifier
later without touching any other code — just implement `categorize()` and
return it from `createCategorizer()` in `backend/src/categorizer/index.ts`.

## Notes

- Baileys is an unofficial WhatsApp Web client, not the official Business API.
  There's a nonzero risk of the linked number being flagged — use a dedicated
  number and avoid bulk/automated outbound messaging.
- Auth session (`backend/auth_info_baileys/`) and the SQLite file
  (`backend/data/`) are gitignored — never commit them, they contain
  session secrets / message content.
