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

// ─── Shared fetch helper ───────────────────────────────────────────────────
async function appleGet(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ─── Strategy 1: __NEXT_DATA__ deep search ────────────────────────────────
function extractPlaylistsFromNextData(html) {
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').text();
  if (!raw) return [];

  let data;
  try { data = JSON.parse(raw); } catch { return []; }

  const playlists = [];
  const seen = new Set();

  function walk(obj, depth) {
    if (depth > 15 || !obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(v => walk(v, depth + 1)); return; }

    // Match Apple Music API playlist shape
    if (
      obj.type === 'playlists' &&
      obj.id?.startsWith('pl.') &&
      obj.attributes?.name &&
      !seen.has(obj.id)
    ) {
      seen.add(obj.id);
      const attrs = obj.attributes;
      playlists.push({
        id: obj.id,
        name: attrs.name,
        url: attrs.url || `https://music.apple.com/us/playlist/${encodeURIComponent(attrs.name.toLowerCase().replace(/\s+/g, '-'))}/${obj.id}`,
        trackCount: attrs.trackCount || null,
        artwork: attrs.artwork?.url?.replace('{w}', '300').replace('{h}', '300') || null,
        tracks: [],
      });
      return; // don't recurse into playlist object itself
    }

    Object.values(obj).forEach(v => walk(v, depth + 1));
  }

  walk(data, 0);
  return playlists;
}

// ─── Strategy 2: href link scan ───────────────────────────────────────────
function extractPlaylistsFromLinks(html) {
  const $ = cheerio.load(html);
  const playlists = [];
  const seen = new Set();

  $('a[href*="/playlist/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/playlist\/[^/]+\/(pl\.[a-zA-Z0-9]+)/);
    if (!match) return;
    const id = match[1];
    if (seen.has(id)) return;
    seen.add(id);

    // Try multiple ways to get the name
    const name =
      $(el).attr('aria-label') ||
      $(el).find('[class*="name"], [class*="title"]').first().text().trim() ||
      $(el).text().replace(/\s+/g, ' ').trim() ||
      'Playlist';

    if (!name || name.length < 1) return;

    const fullUrl = href.startsWith('http') ? href : `https://music.apple.com${href}`;
    playlists.push({ id, name, url: fullUrl, trackCount: null, artwork: null, tracks: [] });
  });

  return playlists;
}

// ─── Strategy 3: Embedded JSON blobs ──────────────────────────────────────
function extractPlaylistsFromScripts(html) {
  const $ = cheerio.load(html);
  const playlists = [];
  const seen = new Set();

  $('script:not([src])').each((_, el) => {
    const text = $(el).text();
    if (!text.includes('pl.') || !text.includes('playlist')) return;

    // Find all pl.XXXXX occurrences and surrounding context
    const idPattern = /pl\.[a-zA-Z0-9]{10,}/g;
    let m;
    while ((m = idPattern.exec(text)) !== null) {
      const id = m[0];
      if (seen.has(id)) continue;
      seen.add(id);

      // Try to extract name from nearby JSON
      const snippet = text.substring(Math.max(0, m.index - 200), m.index + 200);
      const nameMatch = snippet.match(/"name"\s*:\s*"([^"]{2,80})"/);
      const name = nameMatch?.[1] || null;

      if (name) {
        playlists.push({ id, name, url: `https://music.apple.com/us/playlist/${id}`, trackCount: null, artwork: null, tracks: [] });
      }
    }
  });

  return playlists;
}

// ─── Profile scraper: combine all strategies ──────────────────────────────
async function scrapeProfile(username) {
  const url = `https://music.apple.com/profile/${username}`;
  const html = await appleGet(url);
  const $ = cheerio.load(html);

  // Display name
  const displayName =
    $('meta[property="og:title"]').attr('content')?.replace(' - Apple Music', '').trim() ||
    $('title').text().replace(' - Apple Music', '').trim() ||
    username;

  // Combine strategies, deduplicate by ID
  const seen = new Set();
  const combined = [];

  for (const pl of [
    ...extractPlaylistsFromNextData(html),
    ...extractPlaylistsFromLinks(html),
    ...extractPlaylistsFromScripts(html),
  ]) {
    if (!seen.has(pl.id)) {
      seen.add(pl.id);
      combined.push(pl);
    }
  }

  return { displayName, playlists: combined, profileUrl: url };
}

// ─── Playlist track scraper ────────────────────────────────────────────────
async function scrapePlaylistTracks(playlistUrl) {
  const html = await appleGet(playlistUrl);
  const $ = cheerio.load(html);
  const tracks = [];
  const seen = new Set();

  // Strategy A: JSON-LD schema.org (most reliable)
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

  if (tracks.length > 0) return tracks;

  // Strategy B: __NEXT_DATA__ track search
  const raw = $('#__NEXT_DATA__').text();
  if (raw) {
    try {
      const data = JSON.parse(raw);
      function findTracks(obj, depth) {
        if (depth > 15 || !obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(v => findTracks(v, depth + 1)); return; }
        if (obj.type === 'songs' && obj.attributes?.name) {
          const key = `${obj.attributes.name}::${obj.attributes.artistName || ''}`.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            tracks.push({ title: obj.attributes.name, artist: obj.attributes.artistName || '' });
          }
          return;
        }
        Object.values(obj).forEach(v => findTracks(v, depth + 1));
      }
      findTracks(data, 0);
    } catch {}
  }

  if (tracks.length > 0) return tracks;

  // Strategy C: DOM scraping fallback
  const selectors = [
    '.songs-list-row .songs-list-row__song-name',
    '[data-testid="track-title"]',
    '.song-name',
    '.tracklist-item__song-name',
    '[class*="track-name"]',
  ];
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const title = $(el).text().trim();
      if (title && !seen.has(title.toLowerCase())) {
        seen.add(title.toLowerCase());
        const artist = $(el).closest('[class*="track"], [class*="song"], [class*="row"]')
          .find('[class*="artist"], [class*="by-line"]').first().text().trim();
        tracks.push({ title, artist });
      }
    });
    if (tracks.length > 0) break;
  }

  return tracks.slice(0, 100);
}

// ─── Routes ───────────────────────────────────────────────────────────────

app.get('/api/profile/:username', async (req, res) => {
  try {
    const result = await scrapeProfile(req.params.username);
    res.json(result);
  } catch (err) {
    console.error('Profile error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/playlist-tracks', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  try {
    const tracks = await scrapePlaylistTracks(url);
    res.json({ tracks });
  } catch (err) {
    console.error('Tracks error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/recommend', async (req, res) => {
  const { playlists, targetPlaylist } = req.body;
  if (!playlists || !targetPlaylist) {
    return res.status(400).json({ error: 'Missing playlists or targetPlaylist' });
  }

  const allOwned = new Set();
  playlists.forEach(pl => {
    (pl.tracks || []).forEach(t => {
      allOwned.add(`${t.title}`.toLowerCase());
      allOwned.add(`${t.title} ${t.artist}`.toLowerCase());
    });
  });

  const tasteProfile = playlists.map(pl => {
    const sample = (pl.tracks || []).slice(0, 20)
      .map(t => `"${t.title}" by ${t.artist}`).join(', ');
    return `• "${pl.name}": ${sample || '(no tracks loaded)'}`;
  }).join('\n');

  const targetSongs = (targetPlaylist.tracks || []).slice(0, 30)
    .map(t => `"${t.title}" by ${t.artist}`).join(', ');

  const prompt = `You are a world-class music curator. Analyze this person's complete Apple Music library and recommend ONE perfect song to add to their chosen playlist.

FULL LIBRARY:
${tasteProfile}

TARGET PLAYLIST: "${targetPlaylist.name}"
Current songs: ${targetSongs || '(none loaded yet)'}

Rules:
- Do NOT recommend any song already in their library
- Match the specific vibe/genre of the target playlist
- Be adventurous — don't just pick the most obvious hit
- Consider the playlist name as a strong clue about its theme

Respond ONLY with this exact JSON (no markdown, no extra text):
{
  "title": "Song Title",
  "artist": "Artist Name",
  "album": "Album Name",
  "year": 2019,
  "why": "1-2 sentences on why this fits this playlist and their taste",
  "vibe": "3-4 word mood tag",
  "genres": ["genre1", "genre2"]
}`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0].text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const rec = JSON.parse(jsonMatch[0]);
    rec.alreadyOwned = allOwned.has(rec.title?.toLowerCase()) || allOwned.has(`${rec.title} ${rec.artist}`.toLowerCase());

    res.json({ recommendation: rec });
  } catch (err) {
    console.error('Recommend error:', err.message);
    res.status(500).json({ error: 'Recommendation failed: ' + err.message });
  }
});

// Production catch-all
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

app.listen(PORT, () => console.log(`🎵 Vinyl running on :${PORT}`));
