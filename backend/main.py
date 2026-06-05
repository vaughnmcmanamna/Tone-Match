"""
ToneMatch — FastAPI Backend
---------------------------
Endpoints:
  POST /analyze   — takes song ref + optional audio, returns tone analysis + effect JSON
  POST /preview   — takes effect JSON + optional ref clip, returns dry + wet audio as base64

Run:
  uvicorn main:app --reload
"""

import io
import json
import os
import base64
import numpy as np
import soundfile as sf
import librosa
import anthropic
from scipy.ndimage import uniform_filter1d

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pedalboard import Pedalboard, Distortion, Reverb, Delay, Chorus, Compressor, PitchShift, LowpassFilter, HighpassFilter

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="ToneMatch API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

SAMPLE_RATE = 44100

# ---------------------------------------------------------------------------
# Effect definitions
# ---------------------------------------------------------------------------
EFFECT_MAP = {
    "distortion": Distortion,
    "distortion2": Distortion,
    "highcut": LowpassFilter,
    "lowcut": HighpassFilter,
    "reverb": Reverb,
    "delay": Delay,
    "chorus": Chorus,
    "compression": Compressor,
}

PARAM_RANGES = {
    "distortion": {"drive_db": (0.0, 60.0)},
    "distortion2": {"drive_db": (0.0, 60.0)},
    "highcut": {"cutoff_frequency_hz": (500.0, 20000.0)},
    "lowcut": {"cutoff_frequency_hz": (20.0, 1000.0)},
    "reverb": {
        "room_size": (0.0, 1.0),
        "damping": (0.0, 1.0),
        "wet_level": (0.0, 1.0),
        "dry_level": (0.0, 1.0),
    },
    "delay": {
        "delay_seconds": (0.01, 2.0),
        "feedback": (0.0, 0.95),
        "mix": (0.0, 1.0),
    },
    "chorus": {
        "rate_hz": (0.1, 10.0),
        "depth": (0.0, 1.0),
        "mix": (0.0, 1.0),
    },
    "compression": {
        "threshold_db": (-60.0, 0.0),
        "ratio": (1.0, 20.0),
        "attack_ms": (0.1, 200.0),
        "release_ms": (10.0, 1000.0),
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def load_dry_sample(effects: dict = None) -> tuple[np.ndarray, int]:
    """
    Load the appropriate local dry sample.
    Distortion tones use dry_sample.wav; clean/ambient tones use clean_riff.wav.
    """
    has_distortion = effects and ("distortion" in effects or "distortion2" in effects)
    filename = "dry_sample.wav" if has_distortion else "clean_riff.wav"
    audio, sr = sf.read(filename)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio.astype(np.float32), sr


def load_uploaded_audio(upload_bytes: bytes) -> tuple[np.ndarray, int]:
    buf = io.BytesIO(upload_bytes)
    audio, sr = sf.read(buf)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio.astype(np.float32), sr


def audio_to_base64(audio: np.ndarray, sr: int) -> str:
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def extract_audio_features(audio: np.ndarray, sr: int) -> dict:
    """
    Extract measurable tonal characteristics from a guitar clip.
    Returns a dict of human-readable measurements to pass to Claude.
    """
    features = {}

    # Overall level
    rms = float(np.sqrt(np.mean(audio ** 2)))
    features["rms_db"] = round(20 * np.log10(rms + 1e-8), 1)

    # Dynamic range — indicator of how compressed the signal is
    frame_rms = librosa.feature.rms(y=audio, frame_length=2048, hop_length=512)[0]
    nonzero = frame_rms[frame_rms > frame_rms.max() * 0.02]
    if len(nonzero) > 1:
        features["dynamic_range_db"] = round(
            20 * np.log10((nonzero.max() + 1e-8) / (nonzero.min() + 1e-8)), 1
        )
    else:
        features["dynamic_range_db"] = 0.0

    # Spectral centroid — brightness (higher = brighter)
    centroid = librosa.feature.spectral_centroid(y=audio, sr=sr)[0].mean()
    features["spectral_centroid_hz"] = round(float(centroid))

    # Spectral rolloff — where 85% of energy sits
    rolloff = librosa.feature.spectral_rolloff(y=audio, sr=sr, roll_percent=0.85)[0].mean()
    features["spectral_rolloff_hz"] = round(float(rolloff))

    # Zero crossing rate — correlates with distortion/high-frequency content
    zcr = librosa.feature.zero_crossing_rate(audio)[0].mean()
    features["zero_crossing_rate"] = round(float(zcr), 4)

    # Spectral contrast per band — peak vs valley difference, reveals distortion character
    contrast = librosa.feature.spectral_contrast(y=audio, sr=sr, n_bands=6)
    features["spectral_contrast_db"] = [round(float(v), 1) for v in contrast.mean(axis=1)]

    # Low / mid / high energy balance
    stft_mag = np.abs(librosa.stft(audio, n_fft=2048))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    mean_mag = stft_mag.mean(axis=1)
    total = mean_mag.sum() + 1e-8
    features["low_energy_pct"] = round(float(mean_mag[freqs < 300].sum() / total * 100), 1)
    features["mid_energy_pct"] = round(float(mean_mag[(freqs >= 300) & (freqs < 3000)].sum() / total * 100), 1)
    features["high_energy_pct"] = round(float(mean_mag[freqs >= 3000].sum() / total * 100), 1)

    # Tuning offset (cents from A440)
    tuning = librosa.estimate_tuning(y=audio, sr=sr)
    features["tuning_offset_cents"] = round(float(tuning * 100), 1)

    return features


def format_features_for_prompt(features: dict) -> str:
    return f"""
Measured audio characteristics from the uploaded reference clip:
- RMS level: {features['rms_db']} dBFS
- Dynamic range: {features['dynamic_range_db']} dB  (lower = heavier compression; typical heavily compressed distorted guitar = 10-20 dB)
- Spectral centroid: {features['spectral_centroid_hz']} Hz  (brightness; typical overdriven guitar = 1500-3500 Hz)
- Spectral rolloff (85%): {features['spectral_rolloff_hz']} Hz
- Zero crossing rate: {features['zero_crossing_rate']}  (higher = more distortion/brightness; clean guitar ~0.05, heavy distortion ~0.3+)
- Frequency energy — Low (<300 Hz): {features['low_energy_pct']}%  |  Mid (300 Hz–3 kHz): {features['mid_energy_pct']}%  |  High (>3 kHz): {features['high_energy_pct']}%
- Spectral contrast by band [sub, low, low-mid, mid, high-mid, high]: {features['spectral_contrast_db']} dB  (higher contrast = more defined peaks, lower = more saturated/compressed)
- Tuning offset: {features['tuning_offset_cents']} cents from A440 (fine-tuning deviation only; use your knowledge for the actual alternate tuning)

Use these measurements to calibrate your analysis. For example:
- Low dynamic range → heavy bus compression or amp squish
- High ZCR → very gainy/saturated tone
- Spectral centroid below 2000 Hz with low highs → dark, mid-heavy sludge tone
- High low-energy % → strong bass presence, possible bass boost or scooped mids
"""


def apply_spectral_match(dry: np.ndarray, dry_sr: int, ref: np.ndarray, ref_sr: int) -> np.ndarray:
    """
    Shape the dry sample's frequency spectrum to match the reference clip.
    Computes the ratio of average magnitude spectra (ref / dry) and applies
    it as a per-frame STFT multiplier — essentially a convolutive EQ match.
    """
    # Resample ref to dry sample rate if needed
    if ref_sr != dry_sr:
        ref = librosa.resample(ref, orig_sr=ref_sr, target_sr=dry_sr)

    n_fft = 2048
    hop = 512

    # Average magnitude spectrum of each signal
    ref_mag = np.abs(librosa.stft(ref, n_fft=n_fft, hop_length=hop)).mean(axis=1)
    dry_mag = np.abs(librosa.stft(dry, n_fft=n_fft, hop_length=hop)).mean(axis=1)

    # EQ curve: frequency-by-frequency gain to apply to dry to match ref
    eq_curve = ref_mag / (dry_mag + 1e-8)

    # Smooth to avoid sharp notches / resonances
    eq_curve = uniform_filter1d(eq_curve, size=25)

    # Clip to ±18 dB range
    eq_curve = np.clip(eq_curve, 0.125, 8.0)

    # Normalise so overall level stays roughly the same
    eq_curve = eq_curve / (eq_curve.mean() + 1e-8)

    # Apply frame-by-frame in STFT domain
    dry_stft = librosa.stft(dry, n_fft=n_fft, hop_length=hop)
    matched_stft = dry_stft * eq_curve[:, np.newaxis]
    matched = librosa.istft(matched_stft, hop_length=hop, length=len(dry))

    return matched.astype(np.float32)


EFFECT_ORDER = ["lowcut", "compression", "distortion", "distortion2", "highcut", "chorus", "delay", "reverb"]

def build_plugins_from_json(effects: dict) -> list:
    """Build a list of pedalboard plugins in a fixed signal-chain order."""
    plugins = []
    for effect_name in EFFECT_ORDER:
        if effect_name not in effects:
            continue
        params = effects[effect_name]
        cls = EFFECT_MAP.get(effect_name)
        if cls is None:
            continue
        ranges = PARAM_RANGES.get(effect_name, {})
        safe_params = {}
        for k, v in params.items():
            if k in ranges:
                lo, hi = ranges[k]
                safe_params[k] = float(np.clip(v, lo, hi))
        try:
            plugins.append(cls(**safe_params))
        except Exception as e:
            print(f"Skipping {effect_name}: {e}")
    return plugins


def apply_effects(audio: np.ndarray, sr: int, effects: dict) -> np.ndarray:
    """
    Apply pitch shift (if any) then pedalboard effects.
    pitch_shift is in semitones; negative = downtune.
    """
    plugins = []

    pitch_shift = effects.get("pitch_shift")
    if pitch_shift is not None and abs(float(pitch_shift)) > 0.05:
        print(f"Applying pitch shift: {pitch_shift} semitones")
        plugins.append(PitchShift(semitones=float(pitch_shift)))

    plugins.extend(build_plugins_from_json(effects))

    board = Pedalboard(plugins)
    wet = board(audio, sr)
    wet = np.clip(wet, -1.0, 1.0)
    return wet.astype(np.float32)


# ---------------------------------------------------------------------------
# Tone presets — established baselines for known artists/genres
# Claude starts from the closest match and adjusts rather than building from scratch
# ---------------------------------------------------------------------------
TONE_PRESETS = {
    "crowbar_sludge": {
        "description": "Crowbar — Kirk Windstein. Boss MT-2 (Level 10, Dist 0) as clean boost into loud amp. BEADF#B tuning. Dark, heavy, mid-forward sludge.",
        "effects": {
            "pitch_shift": -5,
            "lowcut": {"cutoff_frequency_hz": 150.0},
            "compression": {"threshold_db": -22.0, "ratio": 4.0, "attack_ms": 8.0, "release_ms": 120.0},
            "distortion": {"drive_db": 48.0},
            "distortion2": {"drive_db": 28.0},
            "highcut": {"cutoff_frequency_hz": 5500.0},
            "reverb": {"room_size": 0.3, "damping": 0.6, "wet_level": 0.15, "dry_level": 0.9},
        }
    },
    "electric_wizard_doom": {
        "description": "Electric Wizard — Jus Oborn. Fuzz + heavy amp saturation. C standard or lower. Massive low end, heavily fuzzed, psychedelic.",
        "effects": {
            "pitch_shift": -4,
            "lowcut": {"cutoff_frequency_hz": 100.0},
            "compression": {"threshold_db": -18.0, "ratio": 5.0, "attack_ms": 15.0, "release_ms": 200.0},
            "distortion": {"drive_db": 55.0},
            "distortion2": {"drive_db": 38.0},
            "highcut": {"cutoff_frequency_hz": 4500.0},
            "reverb": {"room_size": 0.55, "damping": 0.4, "wet_level": 0.25, "dry_level": 0.85},
        }
    },
    "black_sabbath_doom": {
        "description": "Black Sabbath — Tony Iommi. Laney amp, treble booster. Eb standard (minus one finger). Dark, heavy, defined riff tone.",
        "effects": {
            "pitch_shift": -1,
            "lowcut": {"cutoff_frequency_hz": 120.0},
            "compression": {"threshold_db": -20.0, "ratio": 3.0, "attack_ms": 10.0, "release_ms": 100.0},
            "distortion": {"drive_db": 38.0},
            "distortion2": {"drive_db": 20.0},
            "highcut": {"cutoff_frequency_hz": 6500.0},
            "reverb": {"room_size": 0.25, "damping": 0.5, "wet_level": 0.12, "dry_level": 0.9},
        }
    },
    "sleep_stoner": {
        "description": "Sleep — Matt Pike. Marshall stack, fuzz. Standard or Db. Massive, warm, rolled-off fuzz tone.",
        "effects": {
            "pitch_shift": -1,
            "lowcut": {"cutoff_frequency_hz": 110.0},
            "compression": {"threshold_db": -20.0, "ratio": 4.0, "attack_ms": 12.0, "release_ms": 150.0},
            "distortion": {"drive_db": 50.0},
            "distortion2": {"drive_db": 32.0},
            "highcut": {"cutoff_frequency_hz": 5000.0},
            "reverb": {"room_size": 0.4, "damping": 0.5, "wet_level": 0.2, "dry_level": 0.88},
        }
    },
    "down_sludge": {
        "description": "DOWN — Pepper Keenan / Phil Anselmo. Eb or D standard. Southern sludge, warm and thick but more defined than Crowbar.",
        "effects": {
            "pitch_shift": -2,
            "lowcut": {"cutoff_frequency_hz": 130.0},
            "compression": {"threshold_db": -22.0, "ratio": 3.5, "attack_ms": 8.0, "release_ms": 100.0},
            "distortion": {"drive_db": 42.0},
            "distortion2": {"drive_db": 24.0},
            "highcut": {"cutoff_frequency_hz": 6000.0},
            "reverb": {"room_size": 0.3, "damping": 0.55, "wet_level": 0.15, "dry_level": 0.9},
        }
    },
    "pantera_groove": {
        "description": "Pantera — Dimebag Darrell. Randall amp, Dunlop wah. Db standard. Tight, scooped, aggressive groove metal.",
        "effects": {
            "pitch_shift": -1,
            "lowcut": {"cutoff_frequency_hz": 160.0},
            "compression": {"threshold_db": -25.0, "ratio": 5.0, "attack_ms": 5.0, "release_ms": 80.0},
            "distortion": {"drive_db": 52.0},
            "distortion2": {"drive_db": 30.0},
            "highcut": {"cutoff_frequency_hz": 7000.0},
        }
    },
    "eyehategod_sludge": {
        "description": "Eyehategod — Mike IX / Brian Patton. Filthy, noisy sludge punk. Standard or Eb. Caustic, raw, feedback-prone.",
        "effects": {
            "pitch_shift": -1,
            "lowcut": {"cutoff_frequency_hz": 140.0},
            "compression": {"threshold_db": -16.0, "ratio": 3.0, "attack_ms": 20.0, "release_ms": 180.0},
            "distortion": {"drive_db": 55.0},
            "distortion2": {"drive_db": 40.0},
            "highcut": {"cutoff_frequency_hz": 6000.0},
            "reverb": {"room_size": 0.2, "damping": 0.7, "wet_level": 0.1, "dry_level": 0.92},
        }
    },
    "high_gain_modern": {
        "description": "Modern high-gain metal — Mesa Boogie / 5150 style. Standard or drop D. Tight, scooped, aggressive.",
        "effects": {
            "pitch_shift": 0,
            "lowcut": {"cutoff_frequency_hz": 180.0},
            "compression": {"threshold_db": -28.0, "ratio": 6.0, "attack_ms": 4.0, "release_ms": 60.0},
            "distortion": {"drive_db": 55.0},
            "distortion2": {"drive_db": 35.0},
            "highcut": {"cutoff_frequency_hz": 8000.0},
        }
    },
    "mac_demarco_jangle": {
        "description": "Mac DeMarco / jangly indie / lo-fi clean. Chorus-heavy, slightly detuned, warm and tape-saturated. No distortion.",
        "effects": {
            "pitch_shift": 0,
            "compression": {"threshold_db": -18.0, "ratio": 2.5, "attack_ms": 20.0, "release_ms": 200.0},
            "chorus": {"rate_hz": 0.8, "depth": 0.6, "mix": 0.5},
            "reverb": {"room_size": 0.4, "damping": 0.4, "wet_level": 0.3, "dry_level": 0.85},
            "delay": {"delay_seconds": 0.38, "feedback": 0.25, "mix": 0.18},
        }
    },
    "clean_ambient": {
        "description": "Clean ambient / post-rock clean tones. Reverb-heavy, no distortion. Shoegaze clean, Explosions in the Sky, etc.",
        "effects": {
            "pitch_shift": 0,
            "compression": {"threshold_db": -20.0, "ratio": 2.0, "attack_ms": 30.0, "release_ms": 300.0},
            "chorus": {"rate_hz": 0.5, "depth": 0.4, "mix": 0.3},
            "reverb": {"room_size": 0.75, "damping": 0.3, "wet_level": 0.5, "dry_level": 0.8},
            "delay": {"delay_seconds": 0.5, "feedback": 0.4, "mix": 0.3},
        }
    },
}

PRESETS_FOR_PROMPT = "\n".join(
    f'- "{k}": {v["description"]}'
    for k, v in TONE_PRESETS.items()
)

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = f"""You are an expert guitar tone engineer with deep knowledge of:
- Guitar signal chains, amps, pedals, and recording techniques
- Reaper DAW and its ReaPlugs suite (ReaEQ, ReaComp, ReaDelay, ReaVerb, JS plugins)
- Free VSTs: Ignite Emissary, LePou sims, NadIR, Valhalla Supermassive, TAL-Reverb, CHOW Tape Model
- Hardware amp/pedal setups going into an audio interface
- Crowbar, sludge metal, doom metal, stoner rock tones

## Tone Presets
You have the following established baseline tones to start from. When given a reference, identify the closest preset and use it as your starting point — adjust from there rather than building from scratch. Name the preset you're using.

{PRESETS_FOR_PROMPT}

Specific artist knowledge:
- Kirk Windstein (Crowbar) runs a Boss Metal Zone MT-2 with: Level=10 (max), Distortion=0, all EQ knobs at noon. This means the pedal acts as a CLEAN BOOST — it drives the amp hard with no pedal distortion. All the saturation comes from the amp being overdriven. The MT-2 at these settings adds a subtle mid-scoop and hi-fi sheen even at dist=0. The resulting distortion character is amp saturation: soft, warm, harmonically rich, NOT the harsh transistor clipping of a pedal cranked up.

IMPORTANT — distortion vs amp saturation distinction:
- "distortion" in the JSON controls a hard clipper. Use LOW drive_db values (8–20) for amp saturation character (sounds like a cranked amp), and HIGH values (30+) for pedal-style hard clipping.
- For amp-saturation tones (Crowbar, doom, sludge), ALWAYS pair distortion with compression BEFORE it: set compression with a low threshold and ratio of 3–6:1. The compressor pushes the signal into the distortion evenly, which is how an amp behaves when driven.
- For clean-boost-into-amp tones specifically: compression threshold_db around -30 to -20, ratio 4:1, fast attack (5–15ms), then distortion drive_db 45–55.
- For sludge/doom/crowbar crunch: use TWO distortion stages. distortion (first stage, drive_db 40–50) followed by distortion2 (second stage, drive_db 25–35). The first stage saturates the body, the second adds crunch and harmonic density. This stacking is what separates real amp crunch from just "loud".
- ALWAYS include highcut after distortion stages. Heavy distortion generates high-frequency aliasing that sounds staticky. A real guitar cab naturally rolls off above 5–8kHz. For sludge/doom use highcut at 5000–6500 Hz. For brighter tones 7000–9000 Hz. This is not optional — every distorted tone needs it.
- lowcut (highpass) before distortion: use 120–180 Hz for sludge/doom. Distorting low frequencies below this causes "flub" — wobbly, undefined low-end from intermodulation. Cut it before the distortion stages. The bass guitar fills the low end in the real mix; the guitar tone itself should be tight.
- pitch_shift: this is critical — ALWAYS include it. Without it the dry sample will be in standard tuning and the whole tone will sound wrong.
- Always go heavy on whatever effects ARE appropriate for the tone. Too much > too little. But do NOT add distortion to clean tones — if the reference is clean/jangly/ambient, use NO distortion or distortion2 at all. "Go heavy" means max out the chorus, reverb, delay etc for clean tones, not add gain.

The user plays guitar into a hardware amp/pedals → audio interface → Reaper with free VSTs.

When given a reference tone (by name and/or measured audio features), provide:

1. TONE ANALYSIS — amp character, gain structure, EQ shape, key effects. If audio measurements are provided, use them to calibrate your analysis (e.g. spectral centroid tells you brightness, dynamic range tells you compression, ZCR tells you gain saturation level).
2. HARDWARE CHAIN — physical amp/pedal settings
3. REAPER SIGNAL CHAIN — exact VST chain with specific numeric values
4. KEY CHARACTERISTICS — the 2-3 most defining elements of this tone
5. TIPS — genre-specific advice

Be specific with numbers. "Boost mids" is useless. "ReaEQ: bell boost +4dB at 800Hz, Q=1.2" is useful.
When audio measurements are provided, cross-reference them with your knowledge and call out any surprises.

IMPORTANT: At the very end of your response, output a JSON block in this exact format (and nothing after it):

```json
{{
  "effects": {{
    "pitch_shift": -5,
    "lowcut": {{ "cutoff_frequency_hz": 150.0 }},
    "compression": {{ "threshold_db": -24.0, "ratio": 4.0, "attack_ms": 10.0, "release_ms": 150.0 }},
    "distortion": {{ "drive_db": 48.0 }},
    "distortion2": {{ "drive_db": 30.0 }},
    "highcut": {{ "cutoff_frequency_hz": 6000.0 }},
    "reverb": {{ "room_size": 0.5, "damping": 0.4, "wet_level": 0.25, "dry_level": 0.8 }},
    "delay": {{ "delay_seconds": 0.35, "feedback": 0.3, "mix": 0.2 }}
  }}
}}
```

Effects are applied in this order: lowcut → compression → distortion → distortion2 → highcut → chorus → delay → reverb.
distortion2 is an optional second distortion stage for crunch stacking. highcut simulates cab rolloff — always include it after distortion.
For amp-saturation tones, always include compression before distortion.

Start from the closest preset above and adjust values to match the specific reference. Always output the full effects JSON even if values are unchanged from the preset.
Available effects: distortion, distortion2, highcut, lowcut, reverb, delay, chorus, compression.
Only use parameters listed for each effect, with numeric values only.

pitch_shift: ALWAYS include this. It is the number of semitones to shift the dry guitar sample relative to standard EADGBE tuning. Negative = downtune. Examples:
- Drop D = -2
- Eb standard = -1
- D standard = -2
- C standard = -4
- B standard = -5
- BEADF#B (Crowbar, etc.) = -5
- CGCFAD (C standard 6-string) = -4
- Open G, Open D etc. = calculate semitones from standard E lowest string
If the reference is in standard tuning, use 0."""


# ---------------------------------------------------------------------------
# Preset matching
# ---------------------------------------------------------------------------
_PRESET_KEYWORDS = {
    "crowbar_sludge":      ["crowbar", "windstein", "planets collide", "odd fellows", "sludge"],
    "electric_wizard_doom":["electric wizard", "dopethrone", "wizard", "jus oborn"],
    "black_sabbath_doom":  ["sabbath", "iommi", "ozzy", "dio", "doom", "paranoid"],
    "sleep_stoner":        ["sleep", "matt pike", "dopesmoker", "holy mountain", "stoner"],
    "down_sludge":         ["down", "pepper keenan", "phil anselmo", "nola", "southern"],
    "pantera_groove":      ["pantera", "dimebag", "dime", "groove metal", "vulgar", "cowboys"],
    "eyehategod_sludge":   ["eyehategod", "eye hate god", "mike ix", "brian patton", "sludge punk"],
    "high_gain_modern":    ["meshuggah", "lamb of god", "djent", "modern metal", "5150", "mesa boogie"],
    "mac_demarco_jangle":  ["mac demarco", "demarco", "freaking out", "salad days", "jangly", "lo-fi indie", "lofi indie", "bedroom pop"],
    "clean_ambient":       ["explosions in the sky", "post-rock", "ambient", "shoegaze clean", "godspeed"],
}

def _find_closest_preset(song_ref: str):
    if not song_ref.strip():
        return None
    ref_lower = song_ref.lower()
    for preset_name, keywords in _PRESET_KEYWORDS.items():
        if any(kw in ref_lower for kw in keywords):
            return preset_name, TONE_PRESETS[preset_name]
    return None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/analyze")
async def analyze(
    song_ref: str = Form(""),
    ref_clip: UploadFile = File(None),
    your_riff: UploadFile = File(None),
):
    content_parts = []
    ref_audio_bytes = None

    # Analyze reference clip and extract audio features
    if ref_clip and ref_clip.filename:
        ref_audio_bytes = await ref_clip.read()
        ref_audio, ref_sr = load_uploaded_audio(ref_audio_bytes)
        features = extract_audio_features(ref_audio, ref_sr)
        feature_text = format_features_for_prompt(features)
        content_parts.append({"type": "text", "text": feature_text})

    # Analyze user's own riff if provided
    if your_riff and your_riff.filename:
        riff_bytes = await your_riff.read()
        riff_audio, riff_sr = load_uploaded_audio(riff_bytes)
        riff_features = extract_audio_features(riff_audio, riff_sr)
        riff_feature_text = "\nMeasured audio characteristics from YOUR riff recording:\n"
        riff_feature_text += format_features_for_prompt(riff_features)
        riff_feature_text += "\nCompare these measurements to the reference and give specific delta advice."
        content_parts.append({"type": "text", "text": riff_feature_text})

    # Find the closest preset based on song_ref keywords
    closest_preset = _find_closest_preset(song_ref)
    preset_hint = ""
    if closest_preset:
        name, preset = closest_preset
        preset_hint = (
            f"\nClosest preset match: \"{name}\" — {preset['description']}\n"
            f"Baseline effects JSON to start from:\n{json.dumps(preset['effects'], indent=2)}\n"
            f"Adjust values as needed for this specific reference. Always output the full JSON.\n"
        )

    prompt = ""
    if song_ref.strip():
        prompt += f"Reference: {song_ref.strip()}\n"
    prompt += preset_hint
    prompt += (
        "\nI use Reaper with free VSTs (ReaPlugs, Ignite Emissary, LePou, Valhalla Supermassive) "
        "and a hardware amp/pedal setup into an audio interface.\n"
        "Give me the complete tone matching guide, then the JSON effect block at the end."
    )
    content_parts.append({"type": "text", "text": prompt})

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content_parts}],
    )

    full_text = message.content[0].text

    # Extract JSON block
    effects = {}
    try:
        json_start = full_text.rfind("```json")
        json_end = full_text.rfind("```", json_start + 1)
        if json_start != -1 and json_end != -1:
            json_str = full_text[json_start + 7:json_end].strip()
            parsed = json.loads(json_str)
            effects = parsed.get("effects", {})
            full_text = full_text[:json_start].strip()
    except Exception as e:
        print(f"JSON parse error: {e}")

    return JSONResponse({
        "analysis": full_text,
        "effects": effects,
        "has_ref_clip": ref_audio_bytes is not None,
    })


@app.post("/preview")
async def preview(
    effects: str = Form(...),
    ref_clip: UploadFile = File(None),
):
    """
    Builds the wet preview:
      1. Load local dry sample (dry_sample.wav for distortion, clean_riff.wav for clean)
      2. If ref clip provided, apply spectral EQ matching
      3. Apply pitch shift + effects from Claude's JSON
    Returns both the original dry and the fully processed wet signal.
    """
    effects_dict = json.loads(effects)
    dry, sr = load_dry_sample(effects_dict)

    # Spectral match: shape dry's EQ to match the reference clip
    if ref_clip and ref_clip.filename:
        ref_bytes = await ref_clip.read()
        ref_audio, ref_sr = load_uploaded_audio(ref_bytes)
        print("Applying spectral EQ match to reference clip...")
        spectrally_matched = apply_spectral_match(dry, sr, ref_audio, ref_sr)
    else:
        spectrally_matched = dry

    # Apply pitch shift + pedalboard effects
    wet = apply_effects(spectrally_matched, sr, effects_dict)

    return JSONResponse({
        "dry": audio_to_base64(dry, sr),
        "wet": audio_to_base64(wet, sr),
        "sample_rate": sr,
    })


@app.get("/health")
async def health():
    return {"status": "ok"}
