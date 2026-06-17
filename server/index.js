require('dotenv').config();
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
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

let browserInstance = null;
async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],
    });
  }
  return browserInstance;
}

async function appleGet(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('a[href*="/playlist/"]', { timeout: 8000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    return await page.content();
  } finally {
    await page.close();
  }
}

function extractPlaylists(html) {
  const $ = cheerio.load(html);
  const playlists = [];
  const seen = new Set();

  const raw = $('#__NEXT_DATA__').text();
  if (raw) {
    try {
      const data = JSON.parse(raw);
      function walk(obj, depth) {
        if (depth > 15 || !obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(v => walk(v, depth+1)); return; }
        if (obj.type === 'playlists' && obj.id?.startsWith('pl.') && obj.attributes?.name && !seen.has(obj.id)) {
          seen.add(obj.id);
          const a = obj.attributes;
          playlists.push({ id: obj.id, name: a.name, url: a.url || `https://music.apple.com/us/playlist/${obj.id}`, trackCount: a.trackCount || null, tracks: [] });
          return;
        }
        Object.values(obj).forEach(v => walk(v, depth+1));
      }
      walk(data, 0);
    } catch {}
  }

  $('a[href*="/playlist/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/playlist\/[^/]+\/(pl\.[a-zA-Z0-9]+)/);
    if (!match) return;
    const id = match[1];
    if (seen.has(id)) return;
    seen.add(id);
    const name = $(el).attr('aria-label') || $(el).text().replace(/\s+/g, ' ').trim();
    if (!name) return;
    playlists.push({ id, name, url: href.startsWith('http') ? href : `https://music.apple.com${href}`, trackCount: null, tracks: [] });
  });

  return playlists;
}

function extractTracks(html) {
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
          const key = `${t.name}::${t.byArtist?.name||''}`.toLowerCase();
          if (!seen.has(key)) { seen.add(key); tracks.push({ title: t.name, artist: t.byArtist?.name||'' }); }
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
        if (Array.isArray(obj)) { obj.forEach(v => walk(v, depth+1)); return; }
        if (obj.type === 'songs' && obj.attributes?.name) {
          const key = `${obj.attributes.name}::${obj.attributes.artistName||''}`.toLowerCase();
          if (!seen.has(key)) { seen.add(key); tracks.push({ title: obj.attributes.name, artist: obj.attributes.artistName||'' }); }
          return;
        }
        Object.values(obj).forEach(v => walk(v, depth+1));
      }
      walk(data, 0);
    } catch {}
  }

  return tracks.slice(0, 100);
}

app.get('/api/profile/:username', async (req, res) => {
  try {
    const url = `https://music.apple.com/profile/${req.params.username}`;
    console.log('Fetching profile:', url);
    const html = await appleGet(url);
    const $ = cheerio.load(html);
    const displayName = $('meta[property="og:title"]').attr('content')?.replace(' - Apple Music','').trim() || req.params.username;
    const playlists = extractPlaylists(html);
    console.log(`Found ${playlists.length} playlists`);
    res.json({ displayName, playlists });
  } catch (err) {
    console.error('Profile error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/playlist-tracks', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  try {
    const html = await appleGet(url);
    const tracks = extractTracks(html);
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
  playlists.forEach(pl => (pl.tracks||[]).forEach(t => {
    allOwned.add(t.title?.toLowerCase());
    allOwned.add(`${t.title} ${t.artist}`.toLowerCase());
  }));

  const tasteProfile = playlists.map(pl => {
    const sample = (pl.tracks||[]).slice(0,20).map(t => `"${t.title}" by ${t.artist}`).join(', ');
    return `• "${pl.name}": ${sample||'(no tracks)'}`;
  }).join('\n');

  const targetSongs = (targetPlaylist.tracks||[]).slice(0,30).map(t => `"${t.title}" by ${t.artist}`).join(', ');

  const prompt = `You are a world-class music curator. Analyze this person's Apple Music library and recommend ONE perfect new song for their chosen playlist.

FULL LIBRARY:
${tasteProfile}

TARGET PLAYLIST: "${targetPlaylist.name}"
Current songs: ${targetSongs||'(none)'}

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

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build/index.html')));
}

app.listen(PORT, () => console.log(`🎵 Vinyl running on :${PORT}`));
