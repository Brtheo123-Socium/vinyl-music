import React, { useState, useRef, useEffect, useCallback } from 'react';

const API = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';

const PALETTE = [
  '#C8A97E','#7B9E87','#9B7EA8','#7E9EC8','#C87E7E',
  '#A8C87E','#C8B87E','#7EC8C0','#C87EA8','#8E7EC8',
  '#C8A97E','#7B9E87','#9B7EA8','#7E9EC8','#C87E7E',
  '#A8C87E','#C8B87E','#7EC8C0','#C87EA8','#8E7EC8',
];

function VinylRecord({ size = 200 }) {
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

function SpinWheel({ onSpin, isLoading }) {
  const [rotation, setRotation] = useState(0);
  const [animating, setAnimating] = useState(false);

  const doSpin = () => {
    if (animating || isLoading) return;
    setAnimating(true);
    const deg = rotation + 1440 + Math.random() * 900;
    setRotation(deg);
    setTimeout(() => { setAnimating(false); onSpin(); }, 2600);
  };

  const disabled = animating || isLoading;

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2rem' }}>
      <div
        onClick={!disabled ? doSpin : undefined}
        style={{
          cursor: disabled ? 'default' : 'pointer',
          transition: 'transform 2.6s cubic-bezier(0.17,0.67,0.21,1.0)',
          transform: `rotate(${rotation}deg)`,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <VinylRecord size={200} />
      </div>
      <button onClick={doSpin} disabled={disabled} style={{
        background: disabled ? '#1f1f1f' : '#C8A97E',
        color: disabled ? '#444' : '#0D0D0D',
        border: 'none', borderRadius: '100px',
        padding: '13px 36px', fontSize: '15px', fontWeight: 600,
        fontFamily: 'Inter, sans-serif', letterSpacing: '0.03em',
        cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
      }}>
        {isLoading ? '♪  Generating…' : animating ? '⟳  Spinning…' : '⟳  Spin for a Song'}
      </button>
    </div>
  );
}

function RecCard({ rec, color }) {
  return (
    <div style={{
      background:'#111', border:`1px solid ${color}35`,
      borderRadius:'16px', padding:'1.75rem',
      position:'relative', overflow:'hidden',
      animation:'fadeUp 0.45s ease forwards',
    }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg, ${color}, transparent)` }}/>
      <div style={{ display:'flex', gap:'1.25rem', alignItems:'flex-start', marginBottom:'1.25rem' }}>
        <div style={{
          width:72, height:72, borderRadius:'8px', flexShrink:0,
          background:`${color}18`, border:`1px solid ${color}25`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:'26px',
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
      <div style={{ background:'#0D0D0D', borderRadius:'8px', padding:'1rem', borderLeft:`3px solid ${color}` }}>
        <div style={{ fontSize:'10px', color:'#444', fontFamily:'JetBrains Mono', letterSpacing:'0.12em', marginBottom:'5px' }}>WHY THIS SONG</div>
        <div style={{ fontSize:'14px', color:'#a09888', lineHeight:1.65 }}>{rec.why}</div>
      </div>
      {rec.alreadyOwned && (
        <div style={{ marginTop:'0.75rem', fontSize:'13px', color:'#c87e7e', fontStyle:'italic' }}>
          ⚠ This might already be in the library
        </div>
      )}
      <a
        href={`https://music.apple.com/search?term=${encodeURIComponent(`${rec.title} ${rec.artist}`)}`}
        target="_blank" rel="noopener noreferrer"
        style={{
          display:'inline-flex', alignItems:'center', gap:'6px',
          marginTop:'1rem', padding:'8px 16px',
          background:'#fa243c', borderRadius:'8px',
          color:'#fff', fontSize:'13px', fontWeight:500, textDecoration:'none',
        }}
      >♫ Open in Apple Music</a>
    </div>
  );
}

function PlaylistItem({ pl, color, selected, onSelect, loading }) {
  return (
    <div
      onClick={() => onSelect(pl)}
      style={{
        background: selected ? `${color}12` : '#111',
        border: `1px solid ${selected ? color : '#222'}`,
        borderRadius:'10px', padding:'11px 14px',
        cursor:'pointer', transition:'all 0.15s',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:'10px', minWidth:0 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background: selected ? color : '#333' }}/>
        <span style={{
          fontSize:'13px', fontWeight: selected ? 500 : 400,
          color: selected ? '#F5F0E8' : '#777',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{pl.name}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
        {pl.tracks?.length > 0 && (
          <span style={{ fontSize:'11px', color:'#444', fontFamily:'JetBrains Mono' }}>{pl.tracks.length}</span>
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

export default function App() {
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingTracksId, setLoadingTracksId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [rec, setRec] = useState(null);
  const [history, setHistory] = useState([]);
  const [recErr, setRecErr] = useState('');
  const recRef = useRef(null);

  // Load Brian's playlists on mount
  useEffect(() => {
    fetch(`${API}/api/profile/brian_meyer`)
      .then(r => r.json())
      .then(data => setPlaylists(data.playlists || []));
  }, []);

  const selectedColor = selected
    ? PALETTE[playlists.findIndex(p => p.id === selected.id) % PALETTE.length]
    : PALETTE[0];

  const selectPlaylist = useCallback(async (pl) => {
    setSelected(pl);
    setRec(null);
    setRecErr('');

    // Load tracks if not already loaded
    if (!pl.tracks?.length) {
      setLoadingTracksId(pl.id);
      try {
        const res = await fetch(`${API}/api/playlist-tracks?id=${encodeURIComponent(pl.id)}`);
        const data = await res.json();
        const tracks = data.tracks || [];
        setPlaylists(prev => prev.map(p => p.id === pl.id ? { ...p, tracks } : p));
        setSelected(prev => prev?.id === pl.id ? { ...prev, tracks } : prev);
      } catch {}
      finally { setLoadingTracksId(null); }
    }
  }, []);

  const spin = useCallback(async () => {
    if (!selected) return;
    setGenerating(true); setRec(null); setRecErr('');
    try {
      const res = await fetch(`${API}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlists, targetPlaylist: selected, previousRecs: history.map(h => ({ title: h.title, artist: h.artist })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRec(data.recommendation);
      setHistory(h => [{ ...data.recommendation, playlist: selected.name }, ...h].slice(0, 20));
      setTimeout(() => recRef.current?.scrollIntoView({ behavior:'smooth', block:'nearest' }), 200);
    } catch (e) { setRecErr(e.message); }
    finally { setGenerating(false); }
  }, [playlists, selected]);

  return (
    <div style={{ minHeight:'100vh', background:'#0D0D0D', fontFamily:'Inter, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#2a2a2a; border-radius:3px; }
        a:hover { opacity:0.8; }
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
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{
            width:30, height:30, borderRadius:'50%',
            background:'linear-gradient(135deg,#C8A97E,#7a5c30)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'12px', fontWeight:600, color:'0D0D0D',
          }}>BM</div>
          <span style={{ fontSize:'14px', color:'#666' }}>Brian Meyer</span>
        </div>
      </header>

      {/* Hero banner */}
      <div style={{
        borderBottom:'1px solid #191919',
        padding:'2.5rem 2rem',
        background:'#0D0D0D',
        animation:'fadeIn 0.5s ease',
      }}>
        <div style={{ maxWidth:1080, margin:'0 auto' }}>
          <div style={{ fontSize:'11px', color:'#444', fontFamily:'JetBrains Mono', letterSpacing:'0.12em', marginBottom:'8px' }}>
            PERSONAL MUSIC DISCOVERY
          </div>
          <h1 style={{
            fontFamily:'Playfair Display, serif',
            fontSize:'clamp(1.8rem,4vw,3rem)',
            fontWeight:700, lineHeight:1.1, color:'#F5F0E8',
          }}>
            What should Brian listen to<br/>
            <em style={{ color:'#C8A97E' }}>next?</em>
          </h1>
          <p style={{ color:'#555', fontSize:'14px', marginTop:'0.75rem', maxWidth:480 }}>
            {playlists.length} playlists · Pick one and spin the record for a fresh recommendation that's not already in the library.
          </p>
        </div>
      </div>

      {/* Main layout */}
      <div style={{
        maxWidth:1080, margin:'0 auto', padding:'2rem 1.5rem',
        display:'grid', gridTemplateColumns:'280px 1fr',
        gap:'2rem', alignItems:'start',
      }}>

        {/* Sidebar */}
        <div style={{ position:'sticky', top:'74px' }}>
          <div style={{ fontSize:'11px', color:'#444', fontFamily:'JetBrains Mono', letterSpacing:'0.12em', marginBottom:'10px' }}>
            PLAYLISTS
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'70vh', overflowY:'auto', paddingRight:'4px' }}>
            {playlists.map((pl, i) => (
              <PlaylistItem
                key={pl.id} pl={pl}
                color={PALETTE[i % PALETTE.length]}
                selected={selected?.id === pl.id}
                onSelect={selectPlaylist}
                loading={loadingTracksId === pl.id}
              />
            ))}
          </div>
        </div>

        {/* Main content */}
        <div>
          {!selected ? (
            <div style={{
              display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', minHeight:420,
              color:'#2a2a2a', textAlign:'center', gap:'1rem',
            }}>
              <div style={{ fontSize:'52px' }}>←</div>
              <div style={{ fontSize:'15px' }}>Pick a playlist to get started</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom:'2rem' }}>
                <div style={{ fontSize:'10px', color:'#444', fontFamily:'JetBrains Mono', letterSpacing:'0.12em', marginBottom:'4px' }}>
                  FINDING SONGS FOR
                </div>
                <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:'26px', color:selectedColor, fontWeight:700, marginBottom:'4px' }}>
                  {selected.name}
                </h2>
                {loadingTracksId === selected.id && (
                  <div style={{ fontSize:'12px', color:'#555', fontStyle:'italic' }}>Loading tracks…</div>
                )}
                {selected.tracks?.length > 0 && (
                  <div style={{ fontSize:'12px', color:'#444', fontFamily:'JetBrains Mono' }}>
                    {selected.tracks.length} tracks · checking {playlists.reduce((a,p) => a+(p.tracks?.length||0),0)} total songs for duplicates
                  </div>
                )}
              </div>

              <div style={{ display:'flex', justifyContent:'center', marginBottom:'2.5rem' }}>
                <SpinWheel onSpin={spin} isLoading={generating} />
              </div>

              {recErr && (
                <div style={{
                  color:'#c87e7e', background:'#c87e7e12', border:'1px solid #c87e7e25',
                  borderRadius:'10px', padding:'12px 16px', fontSize:'13px', marginBottom:'1.5rem',
                }}>{recErr}</div>
              )}

              {rec && <div ref={recRef}><RecCard rec={rec} color={selectedColor} /></div>}

              {history.length > 1 && (
                <div style={{ marginTop:'2.5rem' }}>
                  <div style={{ fontSize:'10px', color:'#333', fontFamily:'JetBrains Mono', letterSpacing:'0.12em', marginBottom:'10px' }}>
                    PREVIOUS SPINS
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                    {history.slice(1).map((r, i) => (
                      <div key={i} style={{
                        display:'flex', justifyContent:'space-between',
                        padding:'8px 12px', background:'#111', borderRadius:'8px', border:'1px solid #1a1a1a',
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
    </div>
  );
}
