Personal Learning APP

# Primer

Primer is a personal learning-reels app for one person. It is a full-screen, vertical feed of short lessons — text, a Mermaid diagram, or an optional short video — tuned to the topics you pick.

There is no sign-up. Interests, likes, and saves stay in this browser (IndexedDB). The feed is not written at request time. Grok Bot (the owner's desktop assistant) fills a content bank ahead of time, and the app reads that bank. With no keys, demo mode serves the seed in `data/content.json`.

How the client, service worker, IndexedDB, and content routes fit together is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no `.env` file you get demo mode: onboarding, text reels, Mermaid diagrams, save, like, go deeper, and already-know. Nothing calls a model.

If you bind the dev server on `0.0.0.0` and open it at `127.0.0.1`, hot reload stays allowed because `next.config.ts` lists `127.0.0.1` in `allowedDevOrigins`. Without that, Next.js blocks the dev socket and the page can sit on the opening splash.

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

`npm run typecheck` needs the Next.js route types from a prior `npm run dev` or `npm run build`.

## How Grok Bot refills

The bank lives in this app. Locally it is the writable file `data/content.json` (the committed seed). On Vercel, set the Upstash Redis REST variables below so ingest survives a serverless instance. That integration is the old Vercel KV path and works on the free tier.

1. The phone keeps an unread queue in IndexedDB. When that queue drops under `REFILL_UNREAD_THRESHOLD` (default 20), the app `POST`s `/api/content/need-more`.
2. Grok Bot polls `GET /api/content/status` with `Authorization: Bearer $CONTENT_BOT_TOKEN`. `needsRefill` is true when the latest queue report is under the threshold. `deeperTopics` lists topics the reader asked to go further on. Those are a preference for the next refill, not a separate generator.
3. Grok Bot writes the lessons offline and `POST`s `/api/content/ingest` with the same bearer token. A successful ingest replaces cards with the same id and clears the pending signals.
4. The app keeps prefetching `GET /api/content/feed`. New cards show up on the next page.

Demo mode needs none of this. Leave `CONTENT_BOT_TOKEN` empty and the seed bank still serves. Ingest and status stay closed until the token is set.

## Environment

Copy `.env.example` to `.env.local`.

| Variable | Purpose |
| --- | --- |
| `APP_PASSCODE` | When set, the human app requires this passcode and stores an httpOnly cookie for 30 days. Leave empty on your own machine. |
| `CONTENT_BOT_TOKEN` | Bearer token for `POST /api/content/ingest` and `GET /api/content/status`. Separate from the passcode. Empty means demo mode: seed only, ingest closed. |
| `REFILL_UNREAD_THRESHOLD` | Unread cards below this count signal a refill. Default `20`. |
| `KV_REST_API_URL` | Upstash Redis REST URL. With the token, this is the durable bank on Vercel. |
| `KV_REST_API_TOKEN` | Upstash Redis REST token. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are aliases. |
| `CONTENT_DATA_PATH` | Optional path for the JSON file store. Default `data/content.json`. |

There is no `LLM_API_KEY`, `LLM_BASE_URL`, or `LLM_MODEL`. The app does not call an LLM, and it does not generate images. Diagram cards carry Mermaid source and render in the browser.

## What the feed does

- Onboarding asks for topics. Presets include LLMs, Agentic AI, System Design, RAG, Prompt Engineering, Distributed Systems, Databases, and Cloud/AWS. You can add your own. Each topic has a depth (beginner, intermediate, advanced) and a weight from 1 to 5. Change them later in Settings.
- The feed serves cards from the bank in the order they were written, filtered to your topics, skipping ones this browser has already queued. Text reels have a title, bullets or a short body, a takeaway, a topic, and a depth. Diagram reels add Mermaid source.
- Like, save, share (the system share sheet, or copy), **Deeper** (more cards on that topic from the bank, or a note for the next Grok Bot refill), and **Known** (recorded on the refill signal).
- Saved reels are on the Saved tab and remain available offline, along with reels already loaded.
- An optional video card can be ingested with a YouTube id. The player is a `youtube-nocookie.com` iframe. The app does not search YouTube itself.

## Install on a phone

Use a production build (`npm run build && npm start`) or a deployed HTTPS URL. The dev server does not register the service worker, so it will not offer install.

**Android (Chrome):** open the site, menu, **Install app** or **Add to Home screen**.

**iPhone (Safari):** Share, **Add to Home Screen**. iOS uses the manifest and the apple touch icon. Offline reading uses the saved cache plus IndexedDB; the first open still needs a network.

## Deploy

The app is a Next.js project and deploys to Vercel without a database of its own.

1. Push the repo and import it in Vercel.
2. Set `APP_PASSCODE` before the URL is public.
3. Set `CONTENT_BOT_TOKEN` to a long random secret you also give Grok Bot.
4. Attach Upstash Redis (the Vercel Redis / KV integration; the free tier is enough for one person's bank) and keep `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Without them, the deployed filesystem cannot store ingest.
5. Deploy. Vercel serves the route handlers, `manifest.webmanifest`, and `public/sw.js`.

The seed file is still the fallback when Redis has no document yet. Keys are read only in server code. The browser receives cards, not the bot token or the passcode.
