require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Brian's hardcoded playlist library ───────────────────────────────────
const BRIAN_PLAYLISTS = [
  { id: 'pl.u-pMylGkbUYrkpo1', name: '2026 Cuban Musica', url: 'https://music.apple.com/us/playlist/2026-cuban-musica/pl.u-pMylGkbUYrkpo1', tracks: [] },
  { id: 'pl.u-EdAVYJqsX7egJ8', name: '2026 Jen Spreadsheet', url: 'https://music.apple.com/us/playlist/2026-jen-spreadsheet/pl.u-EdAVYJqsX7egJ8', tracks: [] },
  { id: 'pl.u-r2yBYz2F9Y075v', name: '2026 From One Extreme to the Other', url: 'https://music.apple.com/us/playlist/2026-from-one-extreme-to-the-other/pl.u-r2yBYz2F9Y075v', tracks: [] },
  { id: 'pl.u-pMylE6aTYrkpo1', name: 'Mellow 9', url: 'https://music.apple.com/us/playlist/mellow-9/pl.u-pMylE6aTYrkpo1', tracks: [] },
  { id: 'pl.u-r2yBYqXT9Y075v', name: 'Chill 2026', url: 'https://music.apple.com/us/playlist/chill-2026/pl.u-r2yBYqXT9Y075v', tracks: [] },
  { id: 'pl.u-pMylEbEcYrkpo1', name: '2026 St. Barts', url: 'https://music.apple.com/us/playlist/2026-st-barts/pl.u-pMylEbEcYrkpo1', tracks: [] },
  { id: 'pl.u-pMylEbRtYrkpo1', name: '2025 High Energy', url: 'https://music.apple.com/us/playlist/2025-high-energy/pl.u-pMylEbRtYrkpo1', tracks: [] },
  { id: 'pl.u-EdAVRobsX7egJ8', name: '2019 Cayman Islands', url: 'https://music.apple.com/us/playlist/2019-cayman-islands/pl.u-EdAVRobsX7egJ8', tracks: [] },
  { id: 'pl.u-qxylD8lCXVx6rv', name: 'Chill 2025', url: 'https://music.apple.com/us/playlist/chill-2025/pl.u-qxylD8lCXVx6rv', tracks: [] },
  { id: 'pl.u-55D67KyUYk2JMd', name: '2025 Ned', url: 'https://music.apple.com/us/playlist/2025-ned/pl.u-55D67KyUYk2JMd', tracks: [] },
  { id: 'pl.u-4JomGlbFM31Vzx', name: '2024 Croatia', url: 'https://music.apple.com/us/playlist/2024-croatia/pl.u-4JomGlbFM31Vzx', tracks: [] },
  { id: 'pl.u-pMylAdEsYrkpo1', name: 'Party 9-13-18', url: 'https://music.apple.com/us/playlist/party-9-13-18/pl.u-pMylAdEsYrkpo1', tracks: [] },
  { id: 'pl.u-EdAVxjruX7egJ8', name: '2026 Japan', url: 'https://music.apple.com/us/playlist/2026-japan/pl.u-EdAVxjruX7egJ8', tracks: [] },
  { id: 'pl.u-r2yBZjGT9Y075v', name: 'Radiohead: A Moon Shaped Pool', url: 'https://music.apple.com/us/playlist/radiohead-a-moon-shaped-pool/pl.u-r2yBZjGT9Y075v', tracks: [] },
  { id: 'pl.u-06oxNXxTXE5MpR', name: '2026 Soul', url: 'https://music.apple.com/us/playlist/2026-soul/pl.u-06oxNXxTXE5MpR', tracks: [] },
  { id: 'pl.u-MDAWq1Ju40gz9p', name: 'Naomi Shelton & The Gospel Queens', url: 'https://music.apple.com/us/playlist/naomi-shelton-the-gospel-queens-daptone-records/pl.u-MDAWq1Ju40gz9p', tracks: [] },
  { id: 'pl.u-EdAVY3VIX7egJ8', name: '2025 Sirens & Helicopters', url: 'https://music.apple.com/us/playlist/2025-sirens-helicopters/pl.u-EdAVY3VIX7egJ8', tracks: [] },
  { id: 'pl.u-r2yBY8kF9Y075v', name: 'Shazam Songs', url: 'https://music.apple.com/us/playlist/shazam-songs/pl.u-r2yBY8kF9Y075v', tracks: [] },
  { id: 'pl.u-pMylE8jUYrkpo1', name: '2025 No Summer Plans', url: 'https://music.apple.com/us/playlist/2025-no-summer-plans/pl.u-pMylE8jUYrkpo1', tracks: [] },
  { id: 'pl.u-55D670KiYk2JMd', name: 'Shazam Songs (2)', url: 'https://music.apple.com/us/playlist/shazam-songs/pl.u-55D670KiYk2JMd', tracks: [] },
  { id: 'pl.u-4JomG0GuM31Vzx', name: 'Shazam Songs (3)', url: 'https://music.apple.com/us/playlist/shazam-songs/pl.u-4JomG0GuM31Vzx', tracks: [] },
  { id: 'pl.u-4JomGrJIM31Vzx', name: 'Chill 2024', url: 'https://music.apple.com/us/playlist/chill-2024/pl.u-4JomGrJIM31Vzx', tracks: [] },
  { id: 'pl.u-qxylDAYsXVx6rv', name: '2024 Lartusi', url: 'https://music.apple.com/us/playlist/2024-lartusi/pl.u-qxylDAYsXVx6rv', tracks: [] },
  { id: 'pl.u-yZyVlDLCzkml2y', name: 'Chill Ondabeach', url: 'https://music.apple.com/us/playlist/chill-ondabeach/pl.u-yZyVlDLCzkml2y', tracks: [] },
  { id: 'pl.u-XkD0Z3Bi48Lrkv', name: 'Chill Lindsay', url: 'https://music.apple.com/us/playlist/chill-lindsay/pl.u-XkD0Z3Bi48Lrkv', tracks: [] },
  { id: 'pl.u-MDAWmLWT40gz9p', name: '2024 Nicaragua Here I Come', url: 'https://music.apple.com/us/playlist/2024-nicaragua-here-i-come/pl.u-MDAWmLWT40gz9p', tracks: [] },
  { id: 'pl.u-EdAV7XGuX7egJ8', name: '2023 Searching For...', url: 'https://music.apple.com/us/playlist/2023-searching-for/pl.u-EdAV7XGuX7egJ8', tracks: [] },
  { id: 'pl.u-EdAV7XYIX7egJ8', name: 'Chill Techno', url: 'https://music.apple.com/us/playlist/chill-techno/pl.u-EdAV7XYIX7egJ8', tracks: [] },
  { id: 'pl.u-MDAWm79F40gz9p', name: 'Chill Best Of', url: 'https://music.apple.com/us/playlist/chill-best-of/pl.u-MDAWm79F40gz9p', tracks: [] },
  { id: 'pl.u-EdAV7mWsX7egJ8', name: '2023 Berkshires or Bust', url: 'https://music.apple.com/us/playlist/2023-berkshires-or-bust/pl.u-EdAV7mWsX7egJ8', tracks: [] },
  { id: 'pl.u-r2yBLgqF9Y075v', name: '2023 Yikes', url: 'https://music.apple.com/us/playlist/2023-yikes/pl.u-r2yBLgqF9Y075v', tracks: [] },
  { id: 'pl.u-pMylNPvtYrkpo1', name: 'Chill 2023', url: 'https://music.apple.com/us/playlist/chill-2023/pl.u-pMylNPvtYrkpo1', tracks: [] },
  { id: 'pl.u-55D6xRlcYk2JMd', name: '2022 Safari Adventure', url: 'https://music.apple.com/us/playlist/2022-safari-adventure/pl.u-55D6xRlcYk2JMd', tracks: [] },
  { id: 'pl.u-EdAV7bdIX7egJ8', name: '2022 Marrakech', url: 'https://music.apple.com/us/playlist/2022-marrakech/pl.u-EdAV7bdIX7egJ8', tracks: [] },
  { id: 'pl.u-pMylNyLiYrkpo1', name: 'Mellow 8', url: 'https://music.apple.com/us/playlist/mellow-8/pl.u-pMylNyLiYrkpo1', tracks: [] },
  { id: 'pl.u-55D6xD3iYk2JMd', name: '2022 Omicron', url: 'https://music.apple.com/us/playlist/2022-omicrom/pl.u-55D6xD3iYk2JMd', tracks: [] },
  { id: 'pl.u-55D6xpVsYk2JMd', name: 'Chill 2022', url: 'https://music.apple.com/us/playlist/chill-2022/pl.u-55D6xpVsYk2JMd', tracks: [] },
  { id: 'pl.u-4JomrZ9CM31Vzx', name: '2021 Bahamas', url: 'https://music.apple.com/us/playlist/2021-bahamas/pl.u-4JomrZ9CM31Vzx', tracks: [] },
  { id: 'pl.u-4JomrmmtM31Vzx', name: 'High School Playlist', url: 'https://music.apple.com/us/playlist/high-school-playlist/pl.u-4JomrmmtM31Vzx', tracks: [] },
];

// ─── Fetch tracks from a public playlist page ─────────────────────────────
async function fetchPlaylistTracks(playlist) {
  const res = await fetch(playlist.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  if (!res.ok) {
    console.error(`Failed to fetch ${playlist.name}: ${res.status}`);
    return [];
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const tracks = [];
  const seen = new Set();

  // Strategy 1: JSON-LD schema.org (most reliable for playlist pages)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const list = data['@type'] === 'MusicPlaylist' ? data :
        (Array.isArray(data) ? data.find(d => d['@type'] === 'MusicPlaylist') : null);
      if (list?.track) {
        list.track.forEach(t => {
          if (!t.name) return;
          const key = `${t.name}::${t.byArtist?.name || ''}`.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            tracks.push({ title: t.name, artist: t.byArtist?.name || '' });
          }
        });
      }
    } catch {}
  });

  if (tracks.length > 0) {
    console.log(`✓ ${playlist.name}: ${tracks.length} tracks via JSON-LD`);
    return tracks;
  }

  // Strategy 2: __NEXT_DATA__ songs
  const raw = $('#__NEXT_DATA__').text();
  if (raw) {
    try {
      const data = JSON.parse(raw);
      function walk(obj, depth) {
        if (depth > 15 || !obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(v => walk(v, depth + 1)); return; }
        if (obj.type === 'songs' && obj.attributes?.name) {
          const key = `${obj.attributes.name}::${obj.attributes.artistName || ''}`.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            tracks.push({ title: obj.attributes.name, artist: obj.attributes.artistName || '' });
          }
          return;
        }
        Object.values(obj).forEach(v => walk(v, depth + 1));
      }
      walk(data, 0);
    } catch {}
  }

  if (tracks.length > 0) {
    console.log(`✓ ${playlist.name}: ${tracks.length} tracks via __NEXT_DATA__`);
    return tracks;
  }

  console.warn(`✗ ${playlist.name}: 0 tracks found`);
  return [];
}

// ─── Routes ───────────────────────────────────────────────────────────────

// Return Brian's hardcoded playlist list (no scraping needed)
app.get('/api/profile/brian_meyer', async (req, res) => {
  res.json({
    displayName: 'Brian Meyer',
    playlists: BRIAN_PLAYLISTS,
  });
});

// Fetch tracks for a specific playlist by ID
app.get('/api/playlist-tracks', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const playlist = BRIAN_PLAYLISTS.find(p => p.id === id);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  try {
    const tracks = await fetchPlaylistTracks(playlist);
    res.json({ tracks });
  } catch (err) {
    console.error('Track fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// AI recommendation
app.post('/api/recommend', async (req, res) => {
  const { playlists, targetPlaylist } = req.body;
  if (!playlists || !targetPlaylist) return res.status(400).json({ error: 'Missing data' });

  const allOwned = new Set();
  playlists.forEach(pl => (pl.tracks || []).forEach(t => {
    allOwned.add(t.title?.toLowerCase());
    allOwned.add(`${t.title} ${t.artist}`.toLowerCase());
  }));

  const tasteProfile = playlists
    .filter(pl => pl.tracks?.length > 0)
    .map(pl => {
      const sample = pl.tracks.slice(0, 15).map(t => `"${t.title}" by ${t.artist}`).join(', ');
      return `• "${pl.name}": ${sample}`;
    }).join('\n');

  const targetSongs = (targetPlaylist.tracks || []).slice(0, 30)
    .map(t => `"${t.title}" by ${t.artist}`).join(', ');

  const prompt = `You are a world-class music curator. Analyze Brian Meyer's Apple Music library and recommend ONE perfect new song for his chosen playlist.

BRIAN'S FULL LIBRARY:
${tasteProfile || '(loading...)'}

TARGET PLAYLIST: "${targetPlaylist.name}"
Current songs: ${targetSongs || '(none loaded yet)'}

Rules:
- Do NOT recommend any song already in his library
- Match the specific vibe/genre of the target playlist
- Be adventurous and specific — not the most obvious hit
- The playlist name and year are strong clues about theme/mood

Respond ONLY with this JSON (no markdown):
{"title":"Song Title","artist":"Artist Name","album":"Album Name","year":2019,"why":"1-2 sentences why this fits perfectly","vibe":"3-4 word mood","genres":["genre1","genre2"]}`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = msg.content[0].text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    const rec = JSON.parse(match[0]);
    rec.alreadyOwned = allOwned.has(rec.title?.toLowerCase()) ||
      allOwned.has(`${rec.title} ${rec.artist}`.toLowerCase());
    res.json({ recommendation: rec });
  } catch (err) {
    console.error('Recommend error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Debug: test fetching a single playlist
app.get('/api/debug/:id', async (req, res) => {
  const playlist = BRIAN_PLAYLISTS.find(p => p.id === req.params.id) || BRIAN_PLAYLISTS[0];
  const tracks = await fetchPlaylistTracks(playlist);
  res.json({ playlist: playlist.name, trackCount: tracks.length, sample: tracks.slice(0, 5) });
});

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build/index.html')));
}

app.listen(PORT, () => console.log(`🎵 Vinyl running on :${PORT}`));
