import { useState, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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

  .input-group { margin-bottom: 24px; }

  .input-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #888;
    letter-spacing: 1px;
    margin-bottom: 8px;
    display: block;
  }

  .text-input {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    color: #e8e2d9;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 14px;
    padding: 12px 16px;
    outline: none;
    transition: border-color 0.2s;
    height: 44px;
  }

  .text-input:focus { border-color: rgba(201,74,30,0.5); }
  .text-input::placeholder { color: #444; }

  .upload-zone {
    width: 100%;
    border: 1px dashed rgba(255,255,255,0.15);
    padding: 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    background: rgba(255,255,255,0.02);
  }

  .upload-zone:hover, .upload-zone.drag { border-color: rgba(201,74,30,0.5); background: rgba(201,74,30,0.04); }
  .upload-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }

  .upload-icon { font-size: 20px; margin-bottom: 6px; opacity: 0.4; }

  .upload-text {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #666;
    letter-spacing: 1px;
  }

  .upload-filename {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #c94a1e;
    margin-top: 6px;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
  }

  .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.08); }

  .divider-text {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: #444;
    letter-spacing: 2px;
  }

  .submit-btn {
    width: 100%;
    background: #c94a1e;
    border: none;
    color: #fff;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 20px;
    letter-spacing: 3px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 8px;
  }

  .submit-btn:hover:not(:disabled) { background: #e05520; }
  .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    gap: 20px;
  }

  .loading-bar { width: 200px; height: 2px; background: rgba(255,255,255,0.08); overflow: hidden; }

  .loading-bar-inner {
    height: 100%;
    background: #c94a1e;
    animation: loadSlide 1.4s ease-in-out infinite;
    width: 40%;
  }

  @keyframes loadSlide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }

  .loading-text {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #555;
    letter-spacing: 2px;
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

  .preview-loading {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: #555;
    letter-spacing: 1px;
  }

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

  .error-box {
    background: rgba(201,74,30,0.1);
    border: 1px solid rgba(201,74,30,0.3);
    padding: 16px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    color: #e8a070;
  }
`;

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

function AudioPreview({ dryB64, wetB64, loading }) {
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

  if (loading) return (
    <div className="preview-section">
      <div className="preview-label">// Tone Preview</div>
      <div className="preview-loading">Generating audio previews...</div>
    </div>
  );

  if (!dryB64) return null;

  return (
    <div className="preview-section">
      <div className="preview-label">// Tone Preview — Same Riff, Before & After</div>
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
  const [songRef, setSongRef] = useState('');
  const [yourRiff, setYourRiff] = useState(null);
  const [refClip, setRefClip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [effects, setEffects] = useState(null);
  const [dryB64, setDryB64] = useState(null);
  const [wetB64, setWetB64] = useState(null);
  const [error, setError] = useState(null);
  const [dragRef, setDragRef] = useState(false);
  const [dragRiff, setDragRiff] = useState(false);

  const canSubmit = (songRef.trim() || refClip) && !loading;

  const handleSubmit = async () => {
    setLoading(true);
    setResult(null);
    setEffects(null);
    setDryB64(null);
    setWetB64(null);
    setError(null);

    try {
      // Step 1: Analyze
      const formData = new FormData();
      if (songRef.trim()) formData.append('song_ref', songRef.trim());
      if (refClip) formData.append('ref_clip', refClip);
      if (yourRiff) formData.append('your_riff', yourRiff);

      const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Server error');

      setResult(data.analysis);
      setEffects(data.effects);

      // Step 2: Generate previews — send ref clip for tuning detection
      if (data.effects && Object.keys(data.effects).length > 0) {
        setPreviewLoading(true);
        const previewForm = new FormData();
        previewForm.append('effects', JSON.stringify(data.effects));
        if (refClip) previewForm.append('ref_clip', refClip);

        const previewRes = await fetch(`${API_BASE}/preview`, {
          method: 'POST',
          body: previewForm,
        });
        const previewData = await previewRes.json();
        setDryB64(previewData.dry);
        setWetB64(previewData.wet);
        setPreviewLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setPreviewLoading(false);
    } finally {
      setLoading(false);
    }
  };

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
            <div className="section-label">// Reference Tone</div>

            <div className="input-group">
              <label className="input-label">Song / Artist</label>
              <input
                className="text-input"
                value={songRef}
                onChange={e => setSongRef(e.target.value)}
                placeholder="e.g. Crowbar — Planets Collide"
              />
            </div>

            <div className="divider">
              <div className="divider-line" />
              <div className="divider-text">AND / OR</div>
              <div className="divider-line" />
            </div>

            <div className="input-group">
              <label className="input-label">Reference Clip</label>
              <div
                className={`upload-zone ${dragRef ? 'drag' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragRef(true); }}
                onDragLeave={() => setDragRef(false)}
                onDrop={e => { e.preventDefault(); setDragRef(false); setRefClip(e.dataTransfer.files[0]); }}
              >
                <input type="file" accept="audio/*" onChange={e => setRefClip(e.target.files[0])} />
                <div className="upload-icon">♪</div>
                <div className="upload-text">DROP REFERENCE AUDIO OR CLICK</div>
                {refClip && <div className="upload-filename">✓ {refClip.name}</div>}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Your Riff (optional — for comparison)</label>
              <div
                className={`upload-zone ${dragRiff ? 'drag' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragRiff(true); }}
                onDragLeave={() => setDragRiff(false)}
                onDrop={e => { e.preventDefault(); setDragRiff(false); setYourRiff(e.dataTransfer.files[0]); }}
              >
                <input type="file" accept="audio/*" onChange={e => setYourRiff(e.target.files[0])} />
                <div className="upload-icon">🎸</div>
                <div className="upload-text">YOUR RIFF — I'LL COMPARE YOUR TONE</div>
                {yourRiff && <div className="upload-filename">✓ {yourRiff.name}</div>}
              </div>
            </div>

            <button className="submit-btn" onClick={handleSubmit} disabled={!canSubmit}>
              {loading ? 'ANALYSING...' : 'MATCH TONE →'}
            </button>
          </div>

          <div className="panel-right">
            {loading && (
              <div className="loading">
                <div className="loading-bar"><div className="loading-bar-inner" /></div>
                <div className="loading-text">ANALYSING TONE...</div>
              </div>
            )}

            {!loading && !result && !error && (
              <div className="empty-state">
                <div className="empty-state-title">AWAITING INPUT</div>
                <div className="empty-state-sub">
                  Enter a song reference or upload a clip<br />
                  to get your Reaper signal chain.<br /><br />
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

            {error && <div className="error-box">ERROR: {error}</div>}

            {result && !loading && (
              <div className="result">
                <div className="result-header">
                  <div className="result-ref">{songRef || (refClip ? refClip.name : 'Uploaded Clip')}</div>
                  <div className="result-sub">TONE ANALYSIS · REAPER SIGNAL CHAIN</div>
                </div>

                <AudioPreview dryB64={dryB64} wetB64={wetB64} loading={previewLoading} />

                <div className="md-content">
                  {renderMarkdown(result)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}