# Primer

Primer is a personal learning-reels app for one person. It is a full-screen, vertical feed of short lessons — text, a diagram, or a video under three minutes — tuned to the topics you pick.

There is no sign-up. Interests, likes, and saves stay in this browser (IndexedDB). API keys stay on the server. If no model key is set, the app runs in demo mode from a built-in sample library.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no `.env` file, you get the sample feed: onboarding, text reels, diagrams, short videos, save, like, go deeper, and already-know.

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Environment

Copy `.env.example` to `.env.local`.

| Variable | Purpose |
| --- | --- |
| `LLM_API_KEY` | Secret for an OpenAI-compatible chat API. Empty means demo mode. |
| `LLM_BASE_URL` | API root. Defaults to `https://api.openai.com/v1`. |
| `LLM_MODEL` | Chat model. Defaults to `gpt-4o-mini`. |
| `YOUTUBE_API_KEY` | YouTube Data API key. Search is server-side. Clips longer than 180 seconds are dropped. If unset, live video cards are skipped. |
| `APP_PASSCODE` | When set, the app requires this passcode and stores an httpOnly cookie for 30 days. Leave empty on your own machine. |
| `GENERATION_DAILY_CAP` | Max live generation calls per UTC day on this server process. Default `40`. |
| `RATE_LIMIT_PER_MINUTE` | Max live generation calls per minute. Default `8`. |
| `ENABLE_AI_IMAGES` | Must be exactly `true` to call an image API. Default off. Diagrams use Mermaid either way. |
| `LLM_IMAGE_MODEL` | Image model used only when `ENABLE_AI_IMAGES=true`. Default `dall-e-3`. |

The daily cap and the short response cache live in memory. On a host that runs more than one instance, each instance counts separately. That is enough for a single-user deploy; it is not a shared billing ledger.

Demo mode does not call the model and does not spend the cap.

## What the feed does

- Onboarding asks for topics. Presets include LLMs, Agentic AI, System Design, RAG, Prompt Engineering, Distributed Systems, Databases, and Cloud/AWS. You can add your own. Each topic has a depth (beginner, intermediate, advanced) and a weight from 1 to 5. Change them later in Settings.
- The feed is mostly text, with a diagram and, when one exists, a short video. Weights decide which topic shows up. After several reels on a topic, later cards aim one level deeper.
- Like, save, share (the system share sheet, or copy), **Deeper** (a short follow-up thread), and **Known** (down-weights that topic).
- Saved reels are on the Saved tab and remain available offline, along with reels already loaded.
- YouTube search uses `videoDuration=short`, then keeps only `contentDetails.duration` of 180 seconds or less. Sample videos are the same length limit: Fireship and one short RAG clip, embedded from `youtube-nocookie.com`.
- Image reels are Mermaid diagrams rendered in the browser, or Wikimedia Commons files with the author and license on the card (the neural-net diagram is CC BY-SA 3.0, Glosser.ca).

## Install on a phone

Use a production build (`npm run build && npm start`) or a deployed HTTPS URL. The dev server does not register the service worker, so it will not offer install.

**Android (Chrome):** open the site, menu, **Install app** or **Add to Home screen**.

**iPhone (Safari):** Share, **Add to Home Screen**. iOS uses the manifest and the apple touch icon. Offline reading uses the saved cache plus IndexedDB; the first open still needs a network.

## Deploy

The app is a Next.js project and deploys to Vercel without a database.

1. Push the repo and import it in Vercel.
2. Set the environment variables above in the project settings. Set `APP_PASSCODE` before the URL is public so strangers cannot spend the model key.
3. Deploy. Vercel serves the route handlers, `manifest.webmanifest`, and `public/sw.js`.

Any host that runs `next start` works the same way. Keys are read only in server code (`process.env` inside route handlers). The browser receives cards, not credentials.
