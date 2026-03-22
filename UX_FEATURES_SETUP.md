# WhatsApp-style UX features — setup

## Database

From `server/` (PostgreSQL must be running):

```bash
npx prisma migrate deploy
```

Or during development:

```bash
npx prisma migrate dev
```

This adds:

- `MemberChannelState` — per-member unread counts, pin, favorite, `lastReadAt`
- `Channel` — `lastMessageAt`, `lastMessagePreview`, `lastMessageSenderName`
- `Message.receiptStatus` — `SENT` | `DELIVERED` | `SEEN` for sender ticks
- `User.isOnline`, `User.lastSeenAt`
- `ScheduledCall` — scheduled calls with shareable `callLink`

Existing messages are updated from `SENT` to `DELIVERED` by the migration SQL where applicable.

## Environment (optional)

| Variable | Purpose |
|----------|---------|
| `PUBLIC_APP_URL` | Public URL used in scheduled call links (e.g. `https://app.example.com`). Falls back to `CLIENT_URL` then `http://localhost:5173`. |
| `CLIENT_URL` | CORS + call link fallback |

## Socket events (client already wired)

- `presence:update` — `{ userId, isOnline, lastSeenAt? }`
- `server:channel-activity` — refetch channel list (unread + last message)
- `channel:receipts-updated` — refetch messages for open channel (read receipts)
- `scheduled-call:created` / `scheduled-call:deleted`
- `channel:created` — new channel in sidebar

## Routes

- `GET /api/servers/:serverId/channels` — extended payload (unread, pin, favorite, last message preview)
- `POST /api/channels/:channelId/read` — clear unread, update receipts
- `PATCH /api/channels/:channelId/preferences` — `{ isPinned?, isFavorite? }`
- `GET /api/search?q=&serverId=` — messages, channels, users
- `GET /api/servers/:serverId/members` — members + online status
- `GET|POST /api/servers/:serverId/scheduled-calls`, `GET|DELETE /api/scheduled-calls/:id`

## App URLs

- `/call/:id` — scheduled call details (after login)
- `/join-call?serverId=&channelId=` — shareable instant call link landing page

## Read receipts

- New messages are stored as `DELIVERED` once persisted.
- When every other member on the server has `lastReadAt` ≥ message time for that channel, status becomes `SEEN` (blue ✓✓ in the UI).
