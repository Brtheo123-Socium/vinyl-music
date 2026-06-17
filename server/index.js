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

let cachedToken = null;
let tokenExpiry = 0;

async function getAMToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  try {
    const res = await fetch('https://music.apple.com/us/browse', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
    });
    const html = await res.text();
    const tokenMatch = html.match(/eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6[A-Za-z0-9_\-\.]+/);
    if (tokenMatch) {
      cachedToken = tokenMatch[0];
      tokenExpiry = Date.now() + 3600000;
      console.log('Got AM token');
      return cachedToken;
    }
  } catch (e) { console.error('Token error:', e.message); }
  return null;
}

function walkForPlaylists(obj, playlists, seen, depth) {
  if (depth > 15 || !obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { obj.forEach(v => walkForPlaylists(v, playlists, seen, depth + 1)); return; }
  if (obj.type === 'playlists' && obj.id?.startsWith('pl.') && obj.attributes?.name && !seen.has(obj.id)) {
    seen.add(obj.id);
    const a = obj.attributes;
    playlists.push({ id: obj.id, name: a.name, url: a.url || `https://music.apple.com/us/playlist/${obj.id}`, trackCount: a.trackCount, tracks: [] });
    return;
  }
  Object.values(obj).forEach(v => walkForPlaylists(v, playlists, seen, depth + 1));
}

async function fetchUserProfile(username) {
  const token = await getAMToken();
  const playlists = [];
  const seen = new Set();

  // Try amp-api social endpoint first
  if (token) {
    try {
      const apiRes = await fetch(
        `https://amp-api.music.apple.com/v1/social/profiles/${username}/playlists?limit=100&l=en-US&platform=web`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Origin': 'https://music.apple.com', 'Referer': 'https://music.apple.com/' } }
      );
      if (apiRes.ok) {
        const data = await apiRes.json();
        (data.data || []).forEach(pl => {
          if (!seen.has(pl.id)) {
            seen.add(pl.id);
            playlists.push({ id: pl.id, name: pl.attributes?.name || 'Playlist', url: pl.attributes?.url || `https://music.apple.com/us/playlist/${pl.id}`, trackCount: pl.attributes?.trackCount, tracks: [] });
          }
        });
        console.log(`amp-api found ${playlists.length} playlists`);
      }
    } catch (e) { console.error('amp-api error:', e.message); }
  }

  // Scrape profile page as fallback
  const res = await fetch(`https://music.apple.com/profile/${username}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  if (!res.ok) throw new Error(`Profile not found (${res.status})`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const displayName =
    $('meta[property="og:title"]').attr('content')?.replace(' - Apple Music', '').trim() ||
    $('title').text().replace(' - Apple Music', '').trim() ||
    username;

  // __NEXT_DATA__
  const raw = $('#__NEXT_DATA__').text();
  if (raw) {
    try { walkForPlaylists(JSON.parse(raw), playlists, seen, 0); } catch {}
  }

  // href scan
  $('a[href*="/playlist/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/playlist\/[^/]+\/(pl\.[a-zA-Z0-9]+)/);
    if (!match) return;
    const id = match[1];
    if (seen.has(id)) return;
    seen.add(id);
    const name = $(el).attr('aria-label') || $(el).text().replace(/\s+/g, ' ').trim();
    if (!name) return;
    playlists.push({ id, name, url: href.startsWith('http') ? href : `https://music.apple.com${href}`, tracks: [] });
  });

  return { displayName, playlists };
}

async function fetchPlaylistTracks(playlistUrl, playlistId) {
  const token = await getAMToken();

  if (token && playlistId) {
    try {
      const apiRes = await fetch(
        `https://amp-api.music.apple.com/v1/catalog/us/playlists/${playlistId}?include=tracks&limit=100&l=en-US`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Origin': 'https://music.apple.com', 'Referer': 'https://music.apple.com/' } }
      );
      if (apiRes.ok) {
        const data = await apiRes.json();
        const trackData = data.data?.[0]?.relationships?.tracks?.data || [];
        if (trackData.length > 0) {
          return trackData.map(t => ({ title: t.attributes?.name || '', artist: t.attributes?.artistName || '', album: t.attributes?.albumName || '' }));
        }
      }
    } catch (e) { console.error('Track API error:', e.message); }
  }

  const res = await fetch(playlistUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': 'text/html' }
  });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);
  const tracks = [];
  const seen = new Set();

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const list = data['@type'] === 'MusicPlaylist' ? data : (Array.isArray(data) ? data.find(d => d['@type'] === 'MusicPlaylist') : null);
      if (list?.track) {
        list.track.forEach(t => {
          if (!t.name) return;
          const key = `${t.name}::${t.byArtist?.name || ''}`.toLowerCase();
          if (!seen.has(key)) { seen.add(key); tracks.push({ title: t.name, artist: t.byArtist?.name || '' }); }
        });
      }
    } catch {}
  });

  if (tracks.length > 0) return tracks;

  const raw = $('#__NEXT_DATA__').text();
  if (raw) {
    try {
      const data = JSON.parse(raw);
      function walk(obj, depth) {
        if (depth > 15 || !obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(v => walk(v, depth + 1)); return; }
        if (obj.type === 'songs' && obj.attributes?.name) {
          const key = `${obj.attributes.name}::${obj.attributes.artistName || ''}`.toLowerCase();
          if (!seen.has(key)) { seen.add(key); tracks.push({ title: obj.attributes.name, artist: obj.attributes.artistName || '' }); }
          return;
        }
        Object.values(obj).forEach(v => walk(v, depth + 1));
      }
      walk(data, 0);
    } catch {}
  }

  return tracks.slice(0, 100);
}

app.get('/api/profile/:username', async (req, res) => {
  try {
    console.log('Fetching profile:', req.params.username);
    const result = await fetchUserProfile(req.params.username);
    console.log(`Found ${result.playlists.length} playlists for ${result.displayName}`);
    res.json(result);
  } catch (err) {
    console.error('Profile error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/playlist-tracks', async (req, res) => {
  const { url, id } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  try {
    const tracks = await fetchPlaylistTracks(url, id);
    console.log(`Found ${tracks.length} tracks`);
    res.json({ tracks });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/recommend', async (req, res) => {
  const { playlists, targetPlaylist } = req.body;
  if (!playlists || !targetPlaylist) return res.status(400).json({ error: 'Missing data' });

  const allOwned = new Set();
  playlists.forEach(pl => (pl.tracks || []).forEach(t => {
    allOwned.add(t.title?.toLowerCase());
    allOwned.add(`${t.title} ${t.artist}`.toLowerCase());
  }));

  const tasteProfile = playlists.map(pl => {
    const sample = (pl.tracks || []).slice(0, 20).map(t => `"${t.title}" by ${t.artist}`).join(', ');
    return `• "${pl.name}": ${sample || '(no tracks loaded)'}`;
  }).join('\n');

  const targetSongs = (targetPlaylist.tracks || []).slice(0, 30).map(t => `"${t.title}" by ${t.artist}`).join(', ');

  const prompt = `You are a world-class music curator. Analyze this person's Apple Music library and recommend ONE perfect new song for their chosen playlist.

FULL LIBRARY:
${tasteProfile}

TARGET PLAYLIST: "${targetPlaylist.name}"
Current songs: ${targetSongs || '(none)'}

Rules: Do NOT recommend anything already in their library. Match the vibe of the target playlist. Be specific and adventurous.

Respond ONLY with this JSON (no markdown):
{"title":"Song Title","artist":"Artist Name","album":"Album Name","year":2019,"why":"1-2 sentences why this fits","vibe":"3-4 word mood","genres":["genre1","genre2"]}`;

  try {
    const msg = await anthropic.messages.create({ model: 'claude-opus-4-6', max_tokens: 512, messages: [{ role: 'user', content: prompt }] });
    const raw = msg.content[0].text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');
    const rec = JSON.parse(match[0]);
    rec.alreadyOwned = allOwned.has(rec.title?.toLowerCase()) || allOwned.has(`${rec.title} ${rec.artist}`.toLowerCase());
    res.json({ recommendation: rec });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/debug/:username', async (req, res) => {
  try {
    const url = `https://music.apple.com/profile/${req.params.username}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    const html = await r.text();
    res.json({
      status: r.status,
      length: html.length,
      hasNextData: html.includes('__NEXT_DATA__'),
      hasPl: html.includes('pl.'),
      hasPlaylist: html.includes('playlist'),
      tokenFound: cachedToken ? 'yes' : 'no',
      preview: html.substring(0, 1000),
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build/index.html')));
}

app.listen(PORT, () => console.log(`🎵 Vinyl running on :${PORT}`));
