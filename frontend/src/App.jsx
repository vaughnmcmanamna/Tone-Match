import { useState, useRef } from "react";
import DEMO_DATA from "./demoData.js";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; color: #e8e2d9; font-family: 'IBM Plex Sans', sans-serif; }

  .app {
    min-height: 100vh;
    background: #0a0a0a;
    background-image:
      radial-gradient(ellipse at 20% 0%, rgba(180,50,20,0.12) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 100%, rgba(100,30,10,0.1) 0%, transparent 50%);
  }

  .header {
    padding: 48px 48px 32px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .logo {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 52px;
    letter-spacing: 3px;
    color: #e8e2d9;
    line-height: 1;
  }

  .logo span { color: #c94a1e; }

  .tagline {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #666;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-top: 6px;
  }

  .main {
    display: grid;
    grid-template-columns: 400px 1fr;
    min-height: calc(100vh - 130px);
  }

  .panel {
    padding: 40px 40px;
    border-right: 1px solid rgba(255,255,255,0.06);
  }

  .panel-right {
    padding: 40px 48px;
    overflow-y: auto;
  }

  .section-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #c94a1e;
    margin-bottom: 20px;
  }

  .song-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 32px; }

  .song-btn {
    width: 100%;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    color: #e8e2d9;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 13px;
    padding: 14px 16px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .song-btn:hover { background: rgba(201,74,30,0.08); border-color: rgba(201,74,30,0.3); }

  .song-btn.active {
    background: rgba(201,74,30,0.12);
    border-color: #c94a1e;
    color: #e8e2d9;
  }

  .song-btn-title {
    display: block;
    font-weight: 500;
  }

  .song-btn-sub {
    display: block;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #555;
    letter-spacing: 1px;
    margin-top: 3px;
  }

  .song-btn.active .song-btn-sub { color: #c94a1e; }

  .demo-note {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #3a3a3a;
    letter-spacing: 1px;
    line-height: 1.7;
    border-top: 1px solid rgba(255,255,255,0.04);
    padding-top: 20px;
  }

  .empty-state { padding-top: 40px; }

  .empty-state-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px;
    letter-spacing: 2px;
    color: #222;
    margin-bottom: 12px;
  }

  .empty-state-sub {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #333;
    line-height: 1.8;
  }

  .result { animation: fadeIn 0.4s ease; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .result-header {
    margin-bottom: 28px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .result-ref {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px;
    letter-spacing: 2px;
    color: #e8e2d9;
  }

  .result-sub {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #555;
    letter-spacing: 2px;
    margin-top: 6px;
  }

  .preview-section {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    padding: 24px;
    margin-bottom: 32px;
  }

  .preview-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #c94a1e;
    margin-bottom: 16px;
  }

  .preview-tracks { display: flex; flex-direction: column; gap: 12px; }

  .track { display: flex; align-items: center; gap: 16px; }

  .track-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #666;
    width: 40px;
    flex-shrink: 0;
  }

  .play-btn {
    width: 36px;
    height: 36px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    color: #e8e2d9;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .play-btn:hover { background: rgba(201,74,30,0.2); border-color: rgba(201,74,30,0.4); }
  .play-btn.playing { background: rgba(201,74,30,0.3); border-color: #c94a1e; }

  .track-bar {
    flex: 1;
    height: 3px;
    background: rgba(255,255,255,0.08);
    position: relative;
    cursor: pointer;
  }

  .track-progress { height: 100%; background: #c94a1e; transition: width 0.1s linear; }

  .md-content h1 {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22px;
    letter-spacing: 2px;
    color: #c94a1e;
    margin: 28px 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(201,74,30,0.2);
  }

  .md-content h2 {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #888;
    margin: 22px 0 10px;
  }

  .md-content h3 {
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: #c94a1e;
    margin: 16px 0 8px;
  }

  .md-content p {
    font-size: 14px;
    line-height: 1.7;
    color: #b0aa9f;
    margin-bottom: 12px;
  }

  .md-content ul, .md-content ol { padding-left: 20px; margin-bottom: 14px; }

  .md-content li {
    font-size: 13px;
    line-height: 1.7;
    color: #b0aa9f;
    margin-bottom: 4px;
    font-family: 'IBM Plex Mono', monospace;
  }

  .md-content strong { color: #e8e2d9; font-weight: 500; }

  .md-content code {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    background: rgba(201,74,30,0.12);
    color: #e8a070;
    padding: 2px 6px;
  }
`;

const GENRE_LABELS = {
  "Crowbar - Planets Collide": "Sludge Metal",
  "Mac DeMarco - Salad Days": "Jangly Indie",
  "Limp Bizkit - It'll Be OK": "Nu-Metal",
  "INXS - Original Sin": "New Wave",
  "Sonic Youth - Teenage Riot": "Noise Rock",
};

function formatInline(text) {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let last = 0, match, key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[0].startsWith('**')) parts.push(<strong key={key++}>{match[2]}</strong>);
    else parts.push(<code key={key++}>{match[3]}</code>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

function renderMarkdown(text) {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('# ')) { elements.push(<h1 key={i}>{line.slice(2)}</h1>); }
    else if (line.startsWith('## ')) { elements.push(<h2 key={i}>{line.slice(3)}</h2>); }
    else if (line.startsWith('### ')) { elements.push(<h3 key={i}>{line.slice(4)}</h3>); }
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(<li key={i}>{formatInline(lines[i].slice(2))}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`}>{items}</ul>);
      continue;
    } else if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i}>{formatInline(lines[i].replace(/^\d+\. /, ''))}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`}>{items}</ol>);
      continue;
    } else if (line.trim() !== '') {
      elements.push(<p key={i}>{formatInline(line)}</p>);
    }
    i++;
  }
  return elements;
}

function AudioPreview({ dryB64, wetB64 }) {
  const [dryProgress, setDryProgress] = useState(0);
  const [wetProgress, setWetProgress] = useState(0);
  const [playingDry, setPlayingDry] = useState(false);
  const [playingWet, setPlayingWet] = useState(false);
  const dryAudioRef = useRef(null);
  const wetAudioRef = useRef(null);

  const b64ToUrl = (b64) => {
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return URL.createObjectURL(new Blob([arr], { type: 'audio/wav' }));
  };

  const playTrack = (type) => {
    const isDry = type === 'dry';
    const ref = isDry ? dryAudioRef : wetAudioRef;
    const otherRef = isDry ? wetAudioRef : dryAudioRef;
    const b64 = isDry ? dryB64 : wetB64;
    const setPlaying = isDry ? setPlayingDry : setPlayingWet;
    const setOtherPlaying = isDry ? setPlayingWet : setPlayingDry;

    if (otherRef.current) { otherRef.current.pause(); otherRef.current.currentTime = 0; }
    setOtherPlaying(false);

    if (!ref.current) {
      ref.current = new Audio(b64ToUrl(b64));
      ref.current.ontimeupdate = () => {
        const pct = (ref.current.currentTime / ref.current.duration) * 100;
        isDry ? setDryProgress(pct) : setWetProgress(pct);
      };
      ref.current.onended = () => { setPlaying(false); isDry ? setDryProgress(0) : setWetProgress(0); };
    }

    if (ref.current.paused) { ref.current.play(); setPlaying(true); }
    else { ref.current.pause(); setPlaying(false); }
  };

  return (
    <div className="preview-section">
      <div className="preview-label">// Tone Preview - Same Riff, Before &amp; After</div>
      <div className="preview-tracks">
        <div className="track">
          <span className="track-label">DRY</span>
          <button className={`play-btn ${playingDry ? 'playing' : ''}`} onClick={() => playTrack('dry')}>
            {playingDry ? '■' : '▶'}
          </button>
          <div className="track-bar">
            <div className="track-progress" style={{ width: `${dryProgress}%` }} />
          </div>
        </div>
        <div className="track">
          <span className="track-label">WET</span>
          <button className={`play-btn ${playingWet ? 'playing' : ''}`} onClick={() => playTrack('wet')}>
            {playingWet ? '■' : '▶'}
          </button>
          <div className="track-bar">
            <div className="track-progress" style={{ width: `${wetProgress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ToneMatcher() {
  const [selected, setSelected] = useState(null);

  const demo = selected !== null ? DEMO_DATA[selected] : null;

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="header">
          <div className="logo">TONE<span>MATCH</span></div>
          <div className="tagline">Guitar Tone Reverse Engineering · Reaper / Free VST Output</div>
        </div>

        <div className="main">
          <div className="panel">
            <div className="section-label">// Select Reference Tone</div>

            <div className="song-list">
              {DEMO_DATA.map((item, i) => (
                <button
                  key={i}
                  className={`song-btn ${selected === i ? 'active' : ''}`}
                  onClick={() => setSelected(i)}
                >
                  <span className="song-btn-title">{item.song}</span>
                  <span className="song-btn-sub">{GENRE_LABELS[item.song] ?? ''}</span>
                </button>
              ))}
            </div>

            <div className="demo-note">
              DEMO MODE — Pre-generated tones.<br />
              Each analysis was produced by Claude<br />
              from the song reference alone.
            </div>
          </div>

          <div className="panel-right">
            {!demo && (
              <div className="empty-state">
                <div className="empty-state-title">AWAITING INPUT</div>
                <div className="empty-state-sub">
                  Select a reference track to see<br />
                  the full Reaper signal chain.<br /><br />
                  Output includes:<br />
                  — Hardware amp/pedal settings<br />
                  — ReaPlugs VST chain with exact values<br />
                  — Free amp sim recommendations<br />
                  — Dry + wet audio preview of the tone<br />
                  — Tuning detection + pitch correction<br />
                  — Genre-specific tips
                </div>
              </div>
            )}

            {demo && (
              <div className="result" key={selected}>
                <div className="result-header">
                  <div className="result-ref">{demo.song}</div>
                  <div className="result-sub">TONE ANALYSIS · REAPER SIGNAL CHAIN</div>
                </div>

                <AudioPreview dryB64={demo.dry} wetB64={demo.wet} />

                <div className="md-content">
                  {renderMarkdown(demo.analysis)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
