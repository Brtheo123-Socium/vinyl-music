# 🎵 Vinyl — Music Discovery App

A personal music discovery site that analyzes Apple Music public playlists and recommends new songs that don't overlap with anything already in the library.

## How it works

1. Enter an Apple Music username (profile must be public)
2. The app scrapes their public playlists and track listings
3. Pick a playlist you want a new song for
4. Spin the wheel — Claude AI analyzes their full taste profile and recommends one perfect track that isn't already anywhere in their library
5. Click through to find it on Apple Music

## Local development

```bash
# 1. Clone and install root deps
npm install

# 2. Install client deps
cd client && npm install && cd ..

# 3. Install server deps
cd server && npm install && cd ..

# 4. Set up environment
cp .env.example server/.env
# Edit server/.env and add your ANTHROPIC_API_KEY

# 5. Run both client + server
npm run dev
```

Client runs at http://localhost:3000
Server runs at http://localhost:3001

## Deploy to Render

1. Push this repo to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Set these settings:
   - **Build Command:** `cd client && npm install && npm run build && cd ../server && npm install`
   - **Start Command:** `cd server && node index.js`
   - **Environment:** Node
5. Add environment variable:
   - `ANTHROPIC_API_KEY` = your key from https://console.anthropic.com
   - `NODE_ENV` = production
6. Deploy!

## Notes

- Apple Music profiles must be set to **Public** for the scraper to work
- The scraper reads the HTML of public profile pages — no API key needed
- Recommendations are generated fresh each spin using Claude AI
- Song history is stored in the current session
