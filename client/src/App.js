import React, { useState, useRef, useCallback } from 'react';

const API = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';

const PALETTE = [
  '#C8A97E','#7B9E87','#9B7EA8','#7E9EC8','#C87E7E',
  '#A8C87E','#C8B87E','#7EC8C0','#C87EA8','#8E7EC8',
];

// ─── Vinyl SVG ────────────────────────────────────────────────────────────
function VinylRecord({ spinning, size = 200 }) {
  return (
    <svg viewBox="0 0 200 200" style={{ width: size, height: size }}>
      <circle cx="100" cy="100" r="98" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1"/>
      {[88,76,64,52,40].map(r => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#222" strokeWidth="0.8"/>
      ))}
      <circle cx="100" cy="100" r="26" fill="#C8A97E"/>
      <circle cx="100" cy="100" r="20" fill="#1a1a1a"/>
      <circle cx="100" cy="100" r="4" fill="#C8A97E"/>
      <circle cx="100" cy="100" r="1.5" fill="#0D0D0D"/>
    </svg>
  );
}

// ─── Spinning wheel ───────────────────────────────────────────────────────
function SpinWheel({ onSpin, isLoading, disabled }) {
  const [rotation, setRotation] = useState(0);
  const [animating, setAnimating] = useState(false);

  const doSpin = () => {
    if (animating || disabled || isLoading) return;
    setAnimating(true);
    const deg = rotation + 1440 + Math.random() * 900;
    setRotation(deg);
    setTimeout(() => { setAnimating(false); onSpin(); }, 2600);
  };

  const btnDisabled = animating || disabled || isLoading;

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2rem' }}>
      <div
        onClick={!btnDisabled ? doSpin : undefined}
        style={{
          cursor: btnDisabled ? 'default' : 'pointer',
          transition: 'transform 2.6s cubic-bezier(0.17, 0.67, 0.21, 1.0)',
          transform: `rotate(${rotation}deg)`,
          filter: btnDisabled ? 'brightness(0.6)' : 'brightness(1)',
        }}
      >
        <VinylRecord size={200} />
      </div>

      <button
        onClick={doSpin}
        disabled={btnDisabled}
        style={{
          background: btnDisabled ? '#1f1f1f' : '#C8A97E',
          color: btnDisabled ? '#444' : '#0D0D0D',
          border: 'none', borderRadius: '100px',
          padding: '13px 36px', fontSize: '15px', fontWeight: 600,
          fontFamily: 'Inter, sans-serif', letterSpacing: '0.03em',
          cursor: btnDisabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {isLoading ? '♪  Generating…' : animating ? '⟳  Spinning…' : '⟳  Spin for a Song'}
      </button>
    </div>
  );
}

// ─── Track pill ───────────────────────────────────────────────────────────
function TrackList({ tracks, max = 8 }) {
  const [expanded, setExpanded] = useState(false);
  const show = expanded ? tracks : tracks.slice(0, max);
  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
        {show.map((t, i) => (
          <span key={i} style={{
            background:'#1a1a1a', border:'1px solid #2a2a2a',
            borderRadius:'100px', padding:'3px 10px',
            fontSize:'12px', color:'#888',
          }}>
            {t.title}{t.artist ? ` — ${t.artist}` : ''}
          </span>
        ))}
      </div>
      {tracks.length > max && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop:'8px', background:'none', border:'none',
            color:'#555', fontSize:'12px', cursor:'pointer', padding:0,
          }}
        >
          {expanded ? '↑ Show less' : `+ ${tracks.length - max} more`}
        </button>
      )}
    </div>
  );
}

// ─── Recommendation card ──────────────────────────────────────────────────
function RecCard({ rec, color }) {
  return (
    <div style={{
      background:'#111', border:`1px solid ${color}35`,
      borderRadius:'16px', padding:'1.75rem',
      position:'relative', overflow:'hidden',
      animation:'fadeUp 0.45s ease forwards',
    }}>
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:3,
        background:`linear-gradient(90deg, ${color}, transparent)`,
      }}/>

      <div style={{ display:'flex', gap:'1.25rem', alignItems:'flex-start', marginBottom:'1.25rem' }}>
        <div style={{
          width:72, height:72, borderRadius:'8px', flexShrink:0,
          background:`${color}18`, border:`1px solid ${color}25`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'26px',
        }}>♪</div>
        <div>
          <div style={{ fontFamily:'Playfair Display, serif', fontSize:'21px', fontWeight:700, color:'#F5F0E8', lineHeight:1.2 }}>
            {rec.title}
          </div>
          <div style={{ color:'#999', fontSize:'14px', marginTop:'3px' }}>{rec.artist}</div>
          <div style={{ color:'#555', fontSize:'12px', fontFamily:'JetBrains Mono, monospace', marginTop:'2px' }}>
            {rec.album}{rec.year ? ` · ${rec.year}` : ''}
          </div>
        </div>
      </div>

      {rec.genres?.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'1.25rem' }}>
          {rec.genres.map(g => (
            <span key={g} style={{
              background:`${color}18`, color, border:`1px solid ${color}28`,
              borderRadius:'100px', padding:'2px 10px', fontSize:'12px', fontWeight:500,
            }}>{g}</span>
          ))}
          {rec.vibe && (
            <span style={{
              background:'#ffffff08', color:'#666', border:'1px solid #222',
              borderRadius:'100px', padding:'2px 10px', fontSize:'12px',
            }}>✦ {rec.vibe}</span>
          )}
        </div>
      )}

      <div style={{
        background:'#0D0D0D', borderRadius:'8px', padding:'1rem',
        borderLeft:`3px solid ${color}`,
      }}>
        <div style={{ fontSize:'10px', color:'#444', fontFamily:'JetBrains Mono', letterSpacing:'0.12em', marginBottom:'5px' }}>
          WHY THIS SONG
        </div>
        <div style={{ fontSize:'14px', color:'#a09888', lineHeight:1.65 }}>{rec.why}</div>
      </div>

      {rec.alreadyOwned && (
        <div style={{ marginTop:'0.75rem', fontSize:'13px', color:'#c87e7e', fontStyle:'italic' }}>
          ⚠ Heads up — this might already be in the library
        </div>
      )}

      <a
        href={`https://music.apple.com/search?term=${encodeURIComponent(`${rec.title} ${rec.artist}`)}`}
        target="_blank" rel="noopener noreferrer"
        style={{
          display:'inline-flex', alignItems:'center', gap:'6px',
          marginTop:'1rem', padding:'8px 16px',
          background:'#fa243c', borderRadius:'8px',
          color:'#fff', fontSize:'13px', fontWeight:500,
          textDecoration:'none',
        }}
      >
        ♫ Open in Apple Music
      </a>
    </div>
  );
}

// ─── Playlist sidebar item ────────────────────────────────────────────────
function PlaylistItem({ pl, color, selected, onSelect, onLoadTracks, loading }) {
  return (
    <div
      onClick={() => { onSelect(pl); if (!pl.tracks?.length) onLoadTracks(pl); }}
      style={{
        background: selected ? `${color}12` : '#111',
        border: `1px solid ${selected ? color : '#222'}`,
        borderRadius:'10px', padding:'11px 14px',
        cursor:'pointer', transition:'all 0.15s',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:'10px', minWidth:0 }}>
        <div style={{
          width:8, height:8, borderRadius:'50%', flexShrink:0,
          background: selected ? color : '#333',
        }}/>
        <span style={{
          fontSize:'13px', fontWeight: selected ? 500 : 400,
          color: selected ? '#F5F0E8' : '#777',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{pl.name}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
        {pl.tracks?.length > 0 && (
          <span style={{ fontSize:'11px', color:'#444', fontFamily:'JetBrains Mono' }}>
            {pl.tracks.length}
          </span>
        )}
        {loading && (
          <div style={{
            width:12, height:12, border:`2px solid ${color}`, borderTopColor:'transparent',
            borderRadius:'50%', animation:'spin 0.7s linear infinite',
          }}/>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function App() {
  const [inputVal, setInputVal]         = useState('');
  const [profile, setProfile]           = useState(null);
  const [playlists, setPlaylists]       = useState([]);
  const [selected, setSelected]         = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingTracksId, setLoadingTracksId] = useState(null);
  const [generating, setGenerating]     = useState(false);
  const [rec, setRec]                   = useState(null);
  const [history, setHistory]           = useState([]);
  const [profileErr, setProfileErr]     = useState('');
  const [recErr, setRecErr]             = useState('');
  const recRef = useRef(null);

  const selectedColor = selected
    ? PALETTE[playlists.findIndex(p => p.id === selected.id) % PALETTE.length]
    : PALETTE[0];

  const loadProfile = async () => {
    const u = inputVal.trim();
    if (!u) return;
    setLoadingProfile(true);
    setProfileErr('');
    setProfile(null); setPlaylists([]); setSelected(null); setRec(null);
    try {
      const res = await fetch(`${API}/api/profile/${u}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load profile');
      setProfile(data);
      setPlaylists(data.playlists || []);
      if (!data.playlists?.length) setProfileErr("Profile loaded but no public playlists found. Make sure Brian's playlists are set to public in Apple Music.");
    } catch (e) { setProfileErr(e.message); }
    finally { setLoadingProfile(false); }
  };

  const loadTracks = async (pl) => {
    if (!pl.url) return;
    setLoadingTracksId(pl.id);
    try {
      const res = await fetch(`${API}/api/playlist-tracks?url=${encodeURIComponent(pl.url)}`);
      const data = await res.json();
      const tracks = data.tracks || [];
      setPlaylists(prev => prev.map(p => p.id === pl.id ? {...p, tracks} : p));
      setSelected(prev => prev?.id === pl.id ? {...prev, tracks} : prev);
    } catch {}
    finally { setLoadingTracksId(null); }
  };

  const spin = useCallback(async () => {
    if (!selected) return;
    setGenerating(true); setRec(null); setRecErr('');
    try {
      const res = await fetch(`${API}/api/recommend`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ playlists, targetPlaylist: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Recommendation failed');
      setRec(data.recommendation);
      setHistory(h => [{ ...data.recommendation, playlist: selected.name }, ...h].slice(0, 20));
      setTimeout(() => recRef.current?.scrollIntoView({ behavior:'smooth', block:'nearest' }), 200);
    } catch (e) { setRecErr(e.message); }
    finally { setGenerating(false); }
  }, [playlists, selected]);

  const reset = () => {
    setProfile(null); setInputVal(''); setPlaylists([]); setSelected(null);
    setRec(null); setHistory([]); setProfileErr(''); setRecErr('');
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::placeholder { color:#3a3a3a; }
        input:focus { outline:none; border-color:#C8A97E !important; }
        a:hover { opacity:0.8; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#2a2a2a; border-radius:3px; }
      `}</style>

      {/* Header */}
      <header style={{
        borderBottom:'1px solid #191919', padding:'1.1rem 2rem',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'sticky', top:0, background:'rgba(13,13,13,0.95)',
        backdropFilter:'blur(8px)', zIndex:50,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <VinylRecord size={26} />
          <span style={{ fontFamily:'Playfair Display, serif', fontSize:'19px', fontWeight:700, color:'#F5F0E8', letterSpacing:'-0.01em' }}>
            Vinyl
          </span>
        </div>
        {profile && (
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{
              width:30, height:30, borderRadius:'50%',
              background:'linear-gradient(135deg,#C8A97E,#7a5c30)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'12px', fontWeight:600, color:'#0D0D0D',
            }}>
              {profile.displayName?.[0]?.toUpperCase() || 'B'}
            </div>
            <span style={{ fontSize:'14px', color:'#666' }}>{profile.displayName}</span>
            <button onClick={reset} style={{
              background:'none', border:'1px solid #2a2a2a', borderRadius:'6px',
              padding:'4px 10px', color:'#555', fontSize:'12px', cursor:'pointer',
            }}>← switch</button>
          </div>
        )}
      </header>

      {/* ── Landing ── */}
      {!profile && (
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', minHeight:'calc(100vh - 58px)',
          padding:'2rem', textAlign:'center', animation:'fadeIn 0.5s ease',
        }}>
          <div style={{ marginBottom:'2rem', animation: loadingProfile ? 'spin 2s linear infinite' : 'none', transformOrigin:'center' }}>
            <VinylRecord size={120} />
          </div>

          <h1 style={{
            fontFamily:'Playfair Display, serif',
            fontSize:'clamp(2rem,6vw,3.8rem)',
            fontWeight:700, lineHeight:1.05,
            color:'#F5F0E8', marginBottom:'1rem',
          }}>
            Discover your next<br/>
            <em style={{ color:'#C8A97E' }}>favourite song.</em>
          </h1>

          <p style={{ color:'#555', fontSize:'16px', maxWidth:420, lineHeight:1.7, marginBottom:'2.5rem' }}>
            Built for Brian. Enter an Apple Music username and spin the vinyl — Claude analyzes every playlist to find a perfect track that's not already in the library.
          </p>

          <div style={{ display:'flex', gap:'10px', width:'100%', maxWidth:420 }}>
            <input
              value={inputVal}
              onChange={e => setInputVal(e.target.value.replace(/^@/, ''))}
              onKeyDown={e => e.key === 'Enter' && loadProfile()}
              placeholder="apple music username (e.g. brian_meyer)"
              style={{
                flex:1, background:'#111', border:'1px solid #2a2a2a',
                borderRadius:'10px', padding:'12px 16px',
                color:'#F5F0E8', fontSize:'14px', fontFamily:'Inter',
                transition:'border-color 0.15s',
              }}
            />
            <button
              onClick={loadProfile}
              disabled={loadingProfile || !inputVal.trim()}
              style={{
                background: loadingProfile || !inputVal.trim() ? '#1a1a1a' : '#C8A97E',
                color: loadingProfile || !inputVal.trim() ? '#444' : '#0D0D0D',
                border:'none', borderRadius:'10px',
                padding:'12px 20px', fontSize:'14px', fontWeight:600,
                cursor: loadingProfile ? 'wait' : 'pointer', whiteSpace:'nowrap',
              }}
            >
              {loadingProfile ? '…' : 'Load →'}
            </button>
          </div>

          {profileErr && (
            <div style={{
              marginTop:'1rem', color:'#c87e7e', fontSize:'13px',
              background:'#c87e7e12', border:'1px solid #c87e7e25',
              borderRadius:'8px', padding:'10px 16px', maxWidth:420,
            }}>
              {profileErr}
            </div>
          )}
        </div>
      )}

      {/* ── Dashboard ── */}
      {profile && (
        <div style={{
          maxWidth:1080, margin:'0 auto', padding:'2rem 1.5rem',
          display:'grid', gridTemplateColumns:'280px 1fr',
          gap:'2rem', alignItems:'start', animation:'fadeIn 0.35s ease',
        }}>

          {/* Sidebar */}
          <div style={{ position:'sticky', top:'74px' }}>
            <div style={{ marginBottom:'1.5rem' }}>
              <div style={{ fontSize:'10px', color:'#444', fontFamily:'JetBrains Mono', letterSpacing:'0.12em', marginBottom:'5px' }}>
                LIBRARY
              </div>
              <div style={{ fontFamily:'Playfair Display, serif', fontSize:'20px', color:'#F5F0E8' }}>
                {profile.displayName}
              </div>
              <div style={{ fontSize:'12px', color:'#444', marginTop:'2px' }}>
                {playlists.length} playlist{playlists.length !== 1 ? 's' : ''}
              </div>
            </div>

            {playlists.length > 0 && (
              <div style={{ fontSize:'12px', color:'#444', marginBottom:'10px' }}>
                Choose a playlist to discover songs for:
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'60vh', overflowY:'auto', paddingRight:'4px' }}>
              {playlists.length === 0 ? (
                <div style={{ color:'#444', fontSize:'13px', lineHeight:1.7 }}>
                  No public playlists found. Ask Brian to make his playlists public in Apple Music settings.
                </div>
              ) : playlists.map((pl, i) => {
                const color = PALETTE[i % PALETTE.length];
                return (
                  <PlaylistItem
                    key={pl.id} pl={pl} color={color}
                    selected={selected?.id === pl.id}
                    onSelect={setSelected}
                    onLoadTracks={loadTracks}
                    loading={loadingTracksId === pl.id}
                  />
                );
              })}
            </div>
          </div>

          {/* Main */}
          <div>
            {!selected ? (
              <div style={{
                display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'center', minHeight:420,
                color:'#2a2a2a', textAlign:'center', gap:'1rem',
              }}>
                <div style={{ fontSize:'52px' }}>←</div>
                <div style={{ fontSize:'15px' }}>Pick a playlist</div>
              </div>
            ) : (
              <>
                {/* Playlist header */}
                <div style={{ marginBottom:'2rem' }}>
                  <div style={{ fontSize:'10px', color:'#444', fontFamily:'JetBrains Mono', letterSpacing:'0.12em', marginBottom:'4px' }}>
                    FINDING SONGS FOR
                  </div>
                  <h2 style={{
                    fontFamily:'Playfair Display, serif', fontSize:'26px',
                    color: selectedColor, fontWeight:700, marginBottom:'4px',
                  }}>
                    {selected.name}
                  </h2>
                  {selected.tracks?.length > 0 && (
                    <div style={{ fontSize:'12px', color:'#444', fontFamily:'JetBrains Mono', marginBottom:'1rem' }}>
                      {selected.tracks.length} tracks · checking {playlists.reduce((a, p) => a + (p.tracks?.length || 0), 0)} total songs for duplicates
                    </div>
                  )}
                  {selected.tracks?.length > 0 && (
                    <TrackList tracks={selected.tracks} />
                  )}
                  {loadingTracksId === selected.id && (
                    <div style={{ fontSize:'12px', color:'#555', fontStyle:'italic', marginTop:'8px' }}>
                      Loading tracks…
                    </div>
                  )}
                </div>

                {/* Spin */}
                <div style={{ display:'flex', justifyContent:'center', marginBottom:'2.5rem' }}>
                  <SpinWheel onSpin={spin} isLoading={generating} disabled={generating} />
                </div>

                {/* Error */}
                {recErr && (
                  <div style={{
                    color:'#c87e7e', background:'#c87e7e12', border:'1px solid #c87e7e25',
                    borderRadius:'10px', padding:'12px 16px', fontSize:'13px', marginBottom:'1.5rem',
                  }}>
                    {recErr}
                  </div>
                )}

                {/* Rec */}
                {rec && <div ref={recRef}><RecCard rec={rec} color={selectedColor} /></div>}

                {/* History */}
                {history.length > 1 && (
                  <div style={{ marginTop:'2.5rem' }}>
                    <div style={{ fontSize:'10px', color:'#333', fontFamily:'JetBrains Mono', letterSpacing:'0.12em', marginBottom:'10px' }}>
                      PREVIOUS SPINS
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                      {history.slice(1).map((r, i) => (
                        <div key={i} style={{
                          display:'flex', justifyContent:'space-between',
                          padding:'8px 12px', background:'#111', borderRadius:'8px',
                          border:'1px solid #1a1a1a',
                        }}>
                          <span style={{ fontSize:'13px', color:'#666' }}>
                            {r.title} <span style={{ color:'#444' }}>— {r.artist}</span>
                          </span>
                          <span style={{ fontSize:'11px', color:'#333', fontFamily:'JetBrains Mono' }}>{r.playlist}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
