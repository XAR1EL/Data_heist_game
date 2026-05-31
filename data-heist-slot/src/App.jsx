import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
// CONSTANTS & DATA
// ─────────────────────────────────────────────
const COLS = 5;
const ROWS = 5;
const ADMIN_PASS = "0110";

const SYMBOLS = [
  { id: 0,  label: "10",      weight: 65, m5: 0.16, m4: 0.08, m3: 0.04, isLow: true,  color: "#94a3b8" },
  { id: 1,  label: "J",       weight: 60, m5: 0.20, m4: 0.10, m3: 0.05, isLow: true,  color: "#94a3b8" },
  { id: 2,  label: "Q",       weight: 55, m5: 0.24, m4: 0.12, m3: 0.06, isLow: true,  color: "#94a3b8" },
  { id: 3,  label: "K",       weight: 50, m5: 0.28, m4: 0.14, m3: 0.07, isLow: true,  color: "#94a3b8" },
  { id: 4,  label: "A",       weight: 45, m5: 0.32, m4: 0.16, m3: 0.08, isLow: true,  color: "#e2e8f0" },
  { id: 5,  label: "♣",       weight: 35, m5: 0.48, m4: 0.24, m3: 0.12, isLow: false, color: "#00e5ff" },
  { id: 6,  label: "♦",       weight: 32, m5: 0.64, m4: 0.32, m3: 0.16, isLow: false, color: "#f43f5e" },
  { id: 7,  label: "♥",       weight: 30, m5: 0.80, m4: 0.40, m3: 0.20, isLow: false, color: "#f43f5e" },
  { id: 8,  label: "♠",       weight: 28, m5: 0.96, m4: 0.48, m3: 0.24, isLow: false, color: "#a78bfa" },
  { id: 9,  label: "CHIP",    weight: 15, m5: 1.60, m4: 0.80, m3: 0.40, isLow: false, color: "#34d399" },
  { id: 10, label: "GHOST",   weight: 12, m5: 2.00, m4: 1.00, m3: 0.50, isLow: false, color: "#818cf8" },
  { id: 11, label: "BLADE",   weight: 9,  m5: 2.40, m4: 1.20, m3: 0.60, isLow: false, color: "#fb7185" },
  { id: 12, label: "PILL",    weight: 8,  m5: 3.20, m4: 1.60, m3: 0.80, isLow: false, color: "#e879f9" },
  { id: 13, label: "WILD",    weight: 12, m5: 4.00, m4: 2.00, m3: 1.00, isLow: false, color: "#fbbf24" },
  { id: 14, label: "SCATTER", weight: 8,  m5: 0.0,  m4: 0.0,  m3: 0.0,  isLow: false, color: "#f43f5e" },
];

const BASE_MULTIPLIERS = [1, 2, 3, 5];
const FREE_MULTIPLIERS = [2, 4, 6, 10];
const BET_LEVELS = [1, 2, 5, 10, 20, 50, 100];

const REEL_POOL = [];
SYMBOLS.forEach(s => { for (let i = 0; i < s.weight; i++) REEL_POOL.push(s); });

function isWild(id) { return id === 13; }

function getRandomSymbol() {
  const sym = REEL_POOL[Math.floor(Math.random() * REEL_POOL.length)];
  const gold = sym.isLow && Math.random() < 0.30;
  return { ...sym, gold };
}

function checkWin(grid) {
  const result = { basePayout: 0, cells: [], mutations: [], dissolves: [], detail: [] };
  if (!grid || grid.length < COLS || grid.some(col => !col || col.length < ROWS)) return result;

  const scatterCoords = [];
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      if (grid[c][r].id === 14) scatterCoords.push(`${c}_${r}`);

  if (scatterCoords.length >= 3) {
    result.cells.push(...scatterCoords);
    result.dissolves.push(...scatterCoords);
    result.detail.push({ symbolId: 14, ways: 1, length: scatterCoords.length, multiplier: 0, payout: 0 });
  }

  SYMBOLS.forEach(sym => {
    if (isWild(sym.id) || sym.id === 14) return;
    const colIndices = Array.from({ length: COLS }, () => []);
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++)
        if (grid[c][r].id === sym.id || isWild(grid[c][r].id)) colIndices[c].push(r);

    let length = 0;
    for (let c = 0; c < COLS; c++) { if (colIndices[c].length > 0) length++; else break; }

    if (length >= 3) {
      let ways = 1;
      for (let c = 0; c < length; c++) ways *= colIndices[c].length;
      const effectiveWays = ROWS === 5 ? Math.pow(ways, 0.35) : ways;
      const symbolMult = length === 3 ? sym.m3 : length === 4 ? sym.m4 : sym.m5;
      const payout = parseFloat((effectiveWays * symbolMult).toFixed(4));
      result.basePayout += payout;
      result.detail.push({ symbolId: sym.id, ways, length, multiplier: symbolMult, payout });

      for (let c = 0; c < length; c++) {
        colIndices[c].forEach(r => {
          const coord = `${c}_${r}`;
          if (!result.cells.includes(coord)) result.cells.push(coord);
          if (grid[c][r].gold) { if (!result.mutations.includes(coord)) result.mutations.push(coord); }
          else { if (!result.dissolves.includes(coord)) result.dissolves.push(coord); }
        });
      }
    }
  });
  return result;
}

function generateHookGrid(bet, credits, isFreeSpins) {
  const isHighBet = bet >= 20;
  let cat = "lose";
  const r = Math.random();
  if (isFreeSpins) {
    if (r < 0.40) cat = "lose";
    else if (r < 0.70) cat = "micro";
    else if (r < 0.93) cat = "standard";
    else cat = "mega";
  } else if (isHighBet) {
    if (r < 0.80) cat = "lose";
    else if (r < 0.97) cat = "micro";
    else if (r < 0.995) cat = "standard";
    else cat = "mega";
  } else if (bet === 10) {
    if (r < 0.60) cat = "lose";
    else if (r < 0.90) cat = "micro";
    else if (r < 0.99) cat = "standard";
    else cat = "mega";
  } else {
    if (r < 0.45) cat = "lose";
    else if (r < 0.88) cat = "micro";
    else if (r < 0.985) cat = "standard";
    else cat = "mega";
  }

  for (let trial = 0; trial < 120; trial++) {
    const grid = Array.from({ length: COLS }, () =>
      Array.from({ length: ROWS }, () => getRandomSymbol())
    );
    const ev = checkWin(grid);
    const sc = grid.flat().filter(s => s.id === 14).length;
    if (isHighBet && (sc >= 3 || ev.basePayout >= 1.5)) continue;
    if (cat === "lose" && ev.cells.length === 0 && sc < 3) return grid;
    if (cat === "micro" && ev.basePayout >= 0.05 && ev.basePayout < 0.95 && sc < 3) return grid;
    if (cat === "standard" && ev.basePayout >= 0.95 && ev.basePayout < 2.2 && sc < 3) return grid;
    if (cat === "mega" && (ev.basePayout >= 2.2 || sc >= 3)) return grid;
  }

  return Array.from({ length: COLS }, () =>
    Array.from({ length: ROWS }, () => {
      let sym = getRandomSymbol();
      if ((cat === "lose" || isHighBet) && (sym.id === 14 || isWild(sym.id)))
        sym = { ...SYMBOLS[0], gold: false };
      return sym;
    })
  );
}

// ─────────────────────────────────────────────
// AUDIO ENGINE
// ─────────────────────────────────────────────
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.musicNodes = [];
    this.musicRunning = false;
    this.beatInterval = null;
    this._scheduledNodes = [];
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.masterGain);

    this._startMusic();
  }

  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }

  setMusicVolume(on) {
    if (!this.musicGain) return;
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.linearRampToValueAtTime(on ? 0.22 : 0, this.ctx.currentTime + 0.5);
  }

  setSFXVolume(on) {
    if (!this.sfxGain) return;
    this.sfxGain.gain.value = on ? 0.7 : 0;
  }

  _osc(freq, type, start, dur, gainVal, dest) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gainVal, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g);
    g.connect(dest);
    o.start(start);
    o.stop(start + dur + 0.01);
    return o;
  }

  _noise(start, dur, gainVal, dest) {
    const bufLen = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(g);
    g.connect(dest);
    src.start(start);
    src.stop(start + dur + 0.01);
  }

  // ── 1-minute looping techno track ──────────────────────────────────────────
  _startMusic() {
    if (this.musicRunning) return;
    this.musicRunning = true;

    const ctx = this.ctx;
    const dest = this.musicGain;
    const BPM = 128;
    const beat = 60 / BPM;          // 0.469s per beat
    const bar = beat * 4;            // 1.875s per bar
    const loopBars = 32;             // 32 bars ≈ 60s loop

    const scheduleLoop = (startTime) => {
      const t = startTime;

      for (let bar = 0; bar < loopBars; bar++) {
        const bT = t + bar * (beat * 4);

        // ── KICK (four on the floor) ─────────────────────────────
        for (let b = 0; b < 4; b++) {
          const kt = bT + b * beat;
          const kick = ctx.createOscillator();
          const kg = ctx.createGain();
          kick.type = "sine";
          kick.frequency.setValueAtTime(160, kt);
          kick.frequency.exponentialRampToValueAtTime(40, kt + 0.12);
          kg.gain.setValueAtTime(1.2, kt);
          kg.gain.exponentialRampToValueAtTime(0.001, kt + 0.38);
          kick.connect(kg); kg.connect(dest);
          kick.start(kt); kick.stop(kt + 0.4);
        }

        // ── HIHAT closed (16ths on even beats) ──────────────────
        for (let s = 0; s < 16; s++) {
          const ht = bT + s * (beat / 4);
          const vol = s % 4 === 0 ? 0.0 : (s % 2 === 0 ? 0.12 : 0.06);
          if (vol > 0) this._noise(ht, 0.04, vol, dest);
        }

        // ── OPEN HIHAT on 2.5 and 4.5 ─────────────────────────────
        this._noise(bT + beat * 2.5 - beat, 0.18, 0.18, dest);
        this._noise(bT + beat * 3.5, 0.18, 0.18, dest);

        // ── SNARE on 2 and 4 ─────────────────────────────────────
        [1, 3].forEach(b => {
          const st = bT + b * beat;
          this._noise(st, 0.12, 0.45, dest);
          this._osc(180, "triangle", st, 0.08, 0.3, dest);
        });

        // ── BASSLINE (pattern repeats every 2 bars) ──────────────
        const bassPat = [55, 55, 44, 55, 44, 55, 66, 44];
        for (let b = 0; b < 8; b++) {
          const bst = bT + b * (beat / 2);
          const bass = ctx.createOscillator();
          const bg = ctx.createGain();
          bass.type = "sawtooth";
          bass.frequency.value = bassPat[b % bassPat.length];
          bg.gain.setValueAtTime(0.55, bst);
          bg.gain.exponentialRampToValueAtTime(0.001, bst + beat * 0.44);
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.value = 280 + (bar % 8) * 40;
          filter.Q.value = 6;
          bass.connect(filter); filter.connect(bg); bg.connect(dest);
          bass.start(bst); bass.stop(bst + beat * 0.48);
        }

        // ── SYNTH LEAD (starts bar 8, every 4 bars) ──────────────
        if (bar >= 8 && bar % 4 < 2) {
          const leadPat = [220, 165, 196, 220, 165, 174, 196, 220];
          for (let n = 0; n < 8; n++) {
            const lt = bT + n * (beat / 2);
            const lead = ctx.createOscillator();
            const lg = ctx.createGain();
            lead.type = "square";
            lead.frequency.value = leadPat[n % leadPat.length];
            lg.gain.setValueAtTime(0.18, lt);
            lg.gain.exponentialRampToValueAtTime(0.001, lt + beat * 0.3);
            lead.connect(lg); lg.connect(dest);
            lead.start(lt); lead.stop(lt + beat * 0.35);
          }
        }

        // ── ARPEGGIO SWEEP (bars 16-31) ──────────────────────────
        if (bar >= 16) {
          const arpNotes = [440, 554, 659, 880, 659, 554, 440, 369];
          for (let n = 0; n < 8; n++) {
            const at = bT + n * (beat / 2);
            const arp = ctx.createOscillator();
            const ag = ctx.createGain();
            arp.type = "triangle";
            arp.frequency.value = arpNotes[n % arpNotes.length];
            ag.gain.setValueAtTime(0.09, at);
            ag.gain.exponentialRampToValueAtTime(0.001, at + beat * 0.22);
            arp.connect(ag); ag.connect(dest);
            arp.start(at); arp.stop(at + beat * 0.25);
          }
        }

        // ── PAD CHORD WASH (bars 4-8 and 20-28) ─────────────────
        if ((bar >= 4 && bar < 8) || (bar >= 20 && bar < 28)) {
          const chordFreqs = [110, 138.6, 164.8, 220];
          chordFreqs.forEach(f => {
            const pad = ctx.createOscillator();
            const pg = ctx.createGain();
            pad.type = "sine";
            pad.frequency.value = f;
            pg.gain.setValueAtTime(0.0, bT);
            pg.gain.linearRampToValueAtTime(0.07, bT + beat);
            pg.gain.setValueAtTime(0.07, bT + beat * 3);
            pg.gain.linearRampToValueAtTime(0.0, bT + beat * 4);
            pad.connect(pg); pg.connect(dest);
            pad.start(bT); pad.stop(bT + beat * 4 + 0.1);
          });
        }
      }

      // Schedule next loop
      const loopDuration = loopBars * beat * 4;
      setTimeout(() => scheduleLoop(startTime + loopDuration), (loopDuration - 2) * 1000);
    };

    scheduleLoop(ctx.currentTime + 0.1);
  }

  // ── SFX ────────────────────────────────────────────────────────────────────
  playSFX(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.sfxGain;

    switch (name) {
      case "click":
        this._osc(880, "square", t, 0.05, 0.3, d);
        this._osc(440, "square", t + 0.02, 0.04, 0.2, d);
        break;

      case "spin":
        for (let i = 0; i < 6; i++) {
          this._osc(200 + i * 80, "sawtooth", t + i * 0.06, 0.12, 0.15, d);
        }
        this._noise(t, 0.3, 0.08, d);
        break;

      case "drop":
        this._osc(300, "sine", t, 0.06, 0.4, d);
        this._osc(200, "sine", t + 0.03, 0.05, 0.3, d);
        this._noise(t, 0.06, 0.12, d);
        break;

      case "win":
        [440, 554, 659, 880].forEach((f, i) => this._osc(f, "triangle", t + i * 0.06, 0.2, 0.35, d));
        break;

      case "bigwin":
        [220, 277, 330, 440, 554, 659, 880].forEach((f, i) => {
          this._osc(f, "square", t + i * 0.04, 0.3, 0.25, d);
          this._osc(f * 2, "sine", t + i * 0.04, 0.3, 0.15, d);
        });
        this._noise(t, 0.5, 0.2, d);
        break;

      case "mutation":
        [800, 1200, 600, 900].forEach((f, i) => this._osc(f, "sawtooth", t + i * 0.03, 0.08, 0.2, d));
        this._noise(t, 0.15, 0.25, d);
        break;

      case "freespin":
        for (let i = 0; i < 10; i++) {
          this._osc(330 + i * 110, "sine", t + i * 0.05, 0.15, 0.2, d);
          this._osc(440 + i * 88, "triangle", t + i * 0.05 + 0.02, 0.1, 0.15, d);
        }
        break;

      case "fail":
        this._osc(200, "sawtooth", t, 0.1, 0.3, d);
        this._osc(150, "sawtooth", t + 0.08, 0.15, 0.3, d);
        this._noise(t, 0.2, 0.15, d);
        break;
    }
  }
}

const audio = new AudioEngine();

// ─────────────────────────────────────────────
// SYMBOL RENDERER
// ─────────────────────────────────────────────
function SymbolCell({ symbol, isWinning, isMutating, isSpinning, colIdx, rowIdx }) {
  const sym = symbol;
  const coord = `${colIdx}_${rowIdx}`;

  const glowColor = sym.color || "#00e5ff";

  const renderSymbol = () => {
    // Card symbols
    if (sym.id <= 4) {
      return (
        <div style={{
          fontFamily: "'Rajdhani', 'Orbitron', monospace",
          fontSize: sym.id === 4 ? "26px" : "22px",
          fontWeight: 900,
          color: sym.gold ? "#fbbf24" : (isWinning ? "#fff" : "#94a3b8"),
          letterSpacing: "0.05em",
          textShadow: isWinning ? `0 0 12px ${glowColor}, 0 0 24px ${glowColor}` : sym.gold ? "0 0 10px #fbbf24" : "none",
          lineHeight: 1,
        }}>
          {sym.label}
        </div>
      );
    }

    // Suit symbols
    if (sym.id >= 5 && sym.id <= 8) {
      return (
        <div style={{
          fontSize: "28px",
          color: isWinning ? "#fff" : glowColor,
          textShadow: isWinning ? `0 0 16px ${glowColor}, 0 0 32px ${glowColor}` : `0 0 8px ${glowColor}60`,
          lineHeight: 1,
        }}>
          {sym.label}
        </div>
      );
    }

    // CHIP
    if (sym.id === 9) return (
      <svg viewBox="0 0 60 60" style={{ width: 38, height: 38 }}>
        <circle cx="30" cy="30" r="22" fill="none" stroke={isWinning ? "#34d399" : "#1a4a3a"} strokeWidth="3"/>
        <circle cx="30" cy="30" r="14" fill={isWinning ? "#34d39930" : "#0f2a1e"} stroke="#34d399" strokeWidth="2"/>
        <rect x="27" y="8" width="6" height="8" rx="1" fill="#34d399"/>
        <rect x="27" y="44" width="6" height="8" rx="1" fill="#34d399"/>
        <rect x="8" y="27" width="8" height="6" rx="1" fill="#34d399"/>
        <rect x="44" y="27" width="8" height="6" rx="1" fill="#34d399"/>
        <text x="30" y="35" textAnchor="middle" fill="#34d399" fontSize="12" fontWeight="bold" fontFamily="monospace">CPU</text>
        {isWinning && <circle cx="30" cy="30" r="22" fill="none" stroke="#34d399" strokeWidth="1" opacity="0.5"><animate attributeName="r" values="22;28;22" dur="0.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0;0.5" dur="0.8s" repeatCount="indefinite"/></circle>}
      </svg>
    );

    // GHOST
    if (sym.id === 10) return (
      <svg viewBox="0 0 60 60" style={{ width: 38, height: 38 }}>
        <path d="M15 42 Q15 18 30 18 Q45 18 45 42 L45 50 L39 44 L33 50 L27 44 L21 50 Z" fill={isWinning ? "#818cf840" : "#1e1b4b"} stroke="#818cf8" strokeWidth="2"/>
        <circle cx="23" cy="32" r="4" fill="#818cf8" opacity={isWinning ? 1 : 0.7}/>
        <circle cx="37" cy="32" r="4" fill="#818cf8" opacity={isWinning ? 1 : 0.7}/>
        {isWinning && <><ellipse cx="23" cy="32" rx="5" ry="5" fill="none" stroke="#818cf8" strokeWidth="1"><animate attributeName="rx" values="5;8;5" dur="0.6s" repeatCount="indefinite"/></ellipse></>}
      </svg>
    );

    // BLADE
    if (sym.id === 11) return (
      <svg viewBox="0 0 60 60" style={{ width: 38, height: 38 }}>
        <polygon points="30,5 36,28 60,30 36,32 30,55 24,32 0,30 24,28" fill={isWinning ? "#fb718540" : "#3b0d14"} stroke="#fb7185" strokeWidth="1.5"/>
        <polygon points="30,14 34,28 46,30 34,32 30,46 26,32 14,30 26,28" fill={isWinning ? "#fb7185" : "#fb718580"} stroke="none"/>
        {isWinning && <polygon points="30,5 36,28 60,30 36,32 30,55 24,32 0,30 24,28" fill="none" stroke="#fb7185" strokeWidth="1"><animate attributeName="stroke-opacity" values="1;0;1" dur="0.4s" repeatCount="indefinite"/></polygon>}
      </svg>
    );

    // PILL
    if (sym.id === 12) return (
      <svg viewBox="0 0 60 60" style={{ width: 38, height: 38 }}>
        <rect x="10" y="22" width="40" height="16" rx="8" fill="none" stroke="#e879f9" strokeWidth="2"/>
        <rect x="10" y="22" width="20" height="16" rx="8" fill={isWinning ? "#e879f940" : "#2d0533"} style={{ borderRight: "none" }}/>
        <rect x="30" y="22" width="20" height="16" rx="8" fill={isWinning ? "#00e5ff40" : "#001a26"}/>
        <line x1="30" y1="22" x2="30" y2="38" stroke="#e879f9" strokeWidth="1.5"/>
        {isWinning && <rect x="10" y="22" width="40" height="16" rx="8" fill="none" stroke="#e879f9" strokeWidth="3" opacity="0.6"><animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="0.5s" repeatCount="indefinite"/></rect>}
      </svg>
    );

    // WILD
    if (sym.id === 13) return (
      <svg viewBox="0 0 60 60" style={{ width: 40, height: 40 }}>
        <defs>
          <radialGradient id="wildGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff9c4"/>
            <stop offset="40%" stopColor="#fbbf24"/>
            <stop offset="100%" stopColor="#d97706"/>
          </radialGradient>
        </defs>
        <circle cx="30" cy="30" r="20" fill="url(#wildGrad)" opacity={isWinning ? 1 : 0.85}/>
        <circle cx="30" cy="30" r="20" fill="none" stroke="#fbbf24" strokeWidth="2"/>
        <text x="30" y="36" textAnchor="middle" fill="#1a0a00" fontSize="13" fontWeight="900" fontFamily="monospace">WILD</text>
        <circle cx="30" cy="30" r="20" fill="none" stroke="#fbbf24" strokeWidth="1">
          <animate attributeName="r" values="20;26;20" dur="1.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.8;0;0.8" dur="1.2s" repeatCount="indefinite"/>
        </circle>
      </svg>
    );

    // SCATTER
    if (sym.id === 14) return (
      <svg viewBox="0 0 60 60" style={{ width: 38, height: 38 }}>
        <defs>
          <radialGradient id="scatGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fda4af"/>
            <stop offset="100%" stopColor="#f43f5e"/>
          </radialGradient>
        </defs>
        <polygon points="30,4 36,22 55,22 41,33 46,51 30,41 14,51 19,33 5,22 24,22" fill="url(#scatGrad)" stroke="#f43f5e" strokeWidth="1.5" opacity={isWinning ? 1 : 0.8}/>
        <text x="30" y="36" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="900" fontFamily="monospace">FREE</text>
        {isWinning && <polygon points="30,4 36,22 55,22 41,33 46,51 30,41 14,51 19,33 5,22 24,22" fill="none" stroke="#f43f5e" strokeWidth="2"><animate attributeName="stroke-opacity" values="1;0;1" dur="0.4s" repeatCount="indefinite"/></polygon>}
      </svg>
    );

    return <div style={{ color: "#fff", fontSize: 14 }}>{sym.label}</div>;
  };

  const borderColor = isWinning ? sym.color : isMutating ? "#fbbf24" : sym.gold ? "#fbbf2460" : "transparent";
  const bgColor = isWinning ? `${sym.color}15` : isMutating ? "#fbbf2410" : "transparent";
  const boxShadow = isWinning ? `0 0 16px ${sym.color}60, inset 0 0 12px ${sym.color}20` : isMutating ? "0 0 10px #fbbf2440" : "none";

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      border: `1.5px solid ${borderColor}`,
      borderRadius: 6,
      background: bgColor,
      boxShadow,
      transition: "all 0.15s ease",
      animation: isWinning ? "cellPulse 0.4s ease-in-out infinite alternate" : isSpinning ? "cellSpin 0.15s ease-in-out infinite" : "none",
    }}>
      {sym.gold && !isWinning && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 5,
          border: "1px solid #fbbf2480",
          boxShadow: "inset 0 0 8px #fbbf2420",
          pointerEvents: "none",
        }}/>
      )}
      {renderSymbol()}
      {isMutating && (
        <div style={{
          position: "absolute", top: 2, right: 2,
          background: "#fbbf24", color: "#000",
          fontSize: 6, fontWeight: 900, padding: "1px 3px",
          borderRadius: 2, letterSpacing: "0.05em",
          fontFamily: "monospace", animation: "pulse 0.5s infinite",
        }}>
          WILD
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN GAME
// ─────────────────────────────────────────────
export default function DataHeistV2() {
  const [credits, setCredits] = useState(0);
  const [bet, setBet] = useState(1);
  const [lastWin, setLastWin] = useState(0);
  const [roundWin, setRoundWin] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [isFreeSpins, setIsFreeSpins] = useState(false);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [freeSpinsTotalWin, setFreeSpinsTotalWin] = useState(0);
  const [comboIndex, setComboIndex] = useState(0);
  const [totalSpins, setTotalSpins] = useState(0);
  const [totalWagered, setTotalWagered] = useState(0);
  const [totalWon, setTotalWon] = useState(0);
  const [grid, setGrid] = useState([]);
  const [winCells, setWinCells] = useState([]);
  const [mutCells, setMutCells] = useState([]);
  const [colSpinning, setColSpinning] = useState([false, false, false, false, false]);
  const [narrator, setNarrator] = useState("// SYSTEM ONLINE — INSERT CREDITS TO BEGIN");
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [bonusModal, setBonusModal] = useState(false);
  const [endModal, setEndModal] = useState(false);
  const [glitching, setGlitching] = useState(false);
  const [bigWinFlash, setBigWinFlash] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminErr, setAdminErr] = useState("");
  const [adminLogs, setAdminLogs] = useState([]);
  const [customAmount, setCustomAmount] = useState("");
  const [audioReady, setAudioReady] = useState(false);

  const stateRef = useRef({});
  const isProcessing = useRef(false);
  const autoRef = useRef(false);

  // Keep refs synced
  useEffect(() => {
    stateRef.current = { credits, bet, spinning, isFreeSpins, freeSpinsLeft, auto, turbo, comboIndex };
    autoRef.current = auto;
  }, [credits, bet, spinning, isFreeSpins, freeSpinsLeft, auto, turbo, comboIndex]);

  // Init grid
  useEffect(() => {
    let g = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, getRandomSymbol));
    while (checkWin(g).cells.length > 0)
      g = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, getRandomSymbol));
    setGrid(g);
  }, []);

  const initAudio = useCallback(() => {
    if (audioReady) return;
    audio.init();
    setAudioReady(true);
  }, [audioReady]);

  const log = (text) => {
    const time = new Date().toLocaleTimeString();
    setAdminLogs(prev => [{ time, text }, ...prev].slice(0, 100));
  };

  const triggerGlitch = () => {
    setGlitching(true);
    setTimeout(() => setGlitching(false), 600);
  };

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const evaluateCascade = async (currentGrid, comboIdx, accWin) => {
    const winData = checkWin(currentGrid);

    if (winData.cells.length > 0) {
      setWinCells(winData.cells);
      setMutCells(winData.mutations);

      const mults = stateRef.current.isFreeSpins ? FREE_MULTIPLIERS : BASE_MULTIPLIERS;
      const mult = mults[Math.min(comboIdx, mults.length - 1)];
      const rawWin = winData.basePayout * stateRef.current.bet;
      const stepWin = parseFloat((rawWin * mult).toFixed(2));
      const nextRoundWin = parseFloat((accWin + stepWin).toFixed(2));

      if (winData.basePayout >= 8) {
        audio.playSFX("bigwin");
        setBigWinFlash(true);
        setTimeout(() => setBigWinFlash(false), 1200);
        setNarrator(`⚡ OVERLOAD DETECTED — +${stepWin.toFixed(2)} CREDITS SEIZED`);
      } else {
        audio.playSFX("win");
        setNarrator(`▶ CORE CAPTURED [x${mult}] — +${stepWin.toFixed(2)}`);
      }

      setLastWin(stepWin);
      setRoundWin(nextRoundWin);
      setCredits(c => parseFloat((c + stepWin).toFixed(2)));
      if (stateRef.current.isFreeSpins) setFreeSpinsTotalWin(w => parseFloat((w + stepWin).toFixed(2)));

      await wait(stateRef.current.turbo ? 150 : 700);

      // Build next grid
      const nextGrid = [];
      for (let c = 0; c < COLS; c++) {
        const surviving = [];
        for (let r = ROWS - 1; r >= 0; r--) {
          const coord = `${c}_${r}`;
          if (winData.dissolves.includes(coord)) continue;
          else if (winData.mutations.includes(coord)) {
            const suitWildIds = [5, 6, 7, 8];
            const randId = suitWildIds[Math.floor(Math.random() * suitWildIds.length)];
            surviving.unshift({ ...SYMBOLS.find(s => s.id === randId), gold: false });
          } else {
            surviving.unshift(currentGrid[c][r]);
          }
        }
        while (surviving.length < ROWS) surviving.unshift(getRandomSymbol());
        nextGrid.push(surviving);
      }

      audio.playSFX("drop");
      setGrid(nextGrid);
      setWinCells([]);
      setMutCells([]);
      setComboIndex(comboIdx + 1);

      await wait(stateRef.current.turbo ? 100 : 350);

      // Check scatter trigger
      const hasScatter = winData.detail.some(d => d.symbolId === 14);
      if (hasScatter && !stateRef.current.isFreeSpins) {
        audio.playSFX("freespin");
        triggerGlitch();
        setBonusModal(true);
        setNarrator("// FREE NET ENCRYPTION INITIATED — 12 CORES LOADED");
        await wait(2200);
        setBonusModal(false);
        setIsFreeSpins(true);
        setFreeSpinsLeft(12);
        setFreeSpinsTotalWin(0);
      }

      await evaluateCascade(nextGrid, comboIdx + 1, nextRoundWin);
    } else {
      let nextFSLeft = stateRef.current.freeSpinsLeft;
      let nextIsFS = stateRef.current.isFreeSpins;
      let showEnd = false;

      if (stateRef.current.isFreeSpins) {
        nextFSLeft = stateRef.current.freeSpinsLeft - 1;
        if (nextFSLeft <= 0) { nextIsFS = false; showEnd = true; }
      }

      if (showEnd) {
        audio.playSFX("bigwin");
        setEndModal(true);
      }

      setNarrator(nextIsFS
        ? `// FREE SPINS: ${nextFSLeft} REMAINING`
        : "// TERMINAL ARMED — READY FOR NEXT INJECTION");
      log(`Round done. Combos: ${comboIdx}. Payout: +${accWin.toFixed(2)}. Balance: ${stateRef.current.credits.toFixed(2)}`);
      setSpinning(false);
      setIsFreeSpins(nextIsFS);
      setFreeSpinsLeft(nextFSLeft);
      setTotalWon(w => parseFloat((w + accWin).toFixed(2)));
      isProcessing.current = false;

      setTimeout(() => {
        const canAfford = stateRef.current.credits >= stateRef.current.bet || stateRef.current.isFreeSpins;
        if (autoRef.current && canAfford && !isProcessing.current) requestSpin();
        else if (autoRef.current && !canAfford) setAuto(false);
      }, stateRef.current.turbo ? 150 : 800);
    }
  };

  const requestSpin = async () => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    initAudio();
    audio.resume();

    const currBet = stateRef.current.bet;
    const currCreds = stateRef.current.credits;
    const isFS = stateRef.current.isFreeSpins;

    if (currCreds < currBet && !isFS) {
      audio.playSFX("fail");
      triggerGlitch();
      setNarrator("// CRITICAL: INSUFFICIENT CREDITS — CANNOT EXECUTE");
      setAuto(false);
      isProcessing.current = false;
      return;
    }

    setNarrator("// BYPASSING FIREWALL — INITIATING GRID HACK");
    setWinCells([]);
    setMutCells([]);
    setRoundWin(0);
    setComboIndex(0);

    const targetGrid = generateHookGrid(currBet, currCreds, isFS);

    if (!isFS) {
      setCredits(c => parseFloat((c - currBet).toFixed(2)));
      setTotalWagered(w => parseFloat((w + currBet).toFixed(2)));
    }
    setTotalSpins(s => s + 1);
    setSpinning(true);

    const baseDelay = stateRef.current.turbo ? 50 : 280;
    const colDelay = stateRef.current.turbo ? 30 : 110;

    setColSpinning([true, true, true, true, true]);
    audio.playSFX("spin");

    for (let col = 0; col < COLS; col++) {
      const bd = stateRef.current.turbo ? 50 : 280;
      const cd = stateRef.current.turbo ? 30 : 110;
      await wait(bd + col * cd);
      setColSpinning(prev => { const n = [...prev]; n[col] = false; return n; });
      setGrid(prev => { const n = [...prev]; n[col] = targetGrid[col]; return n; });
      audio.playSFX("drop");
    }

    await evaluateCascade(targetGrid, 0, 0);
  };

  const adjustBet = (dir) => {
    if (isProcessing.current) return;
    audio.playSFX("click");
    setBet(prev => {
      const idx = BET_LEVELS.indexOf(prev);
      const next = Math.max(0, Math.min(BET_LEVELS.length - 1, idx + dir));
      return BET_LEVELS[next];
    });
  };

  const toggleAuto = () => {
    audio.playSFX("click");
    initAudio();
    setAuto(prev => {
      const next = !prev;
      if (next && !isProcessing.current) setTimeout(() => { if (autoRef.current && !isProcessing.current) requestSpin(); }, 50);
      return next;
    });
  };

  const toggleSound = () => {
    audio.playSFX("click");
    const next = !soundOn;
    setSoundOn(next);
    audio.setSFXVolume(next);
  };

  const toggleMusic = () => {
    audio.playSFX("click");
    const next = !musicOn;
    setMusicOn(next);
    audio.setMusicVolume(next);
  };

  // Admin
  const submitAdmin = () => {
    if (adminPass === ADMIN_PASS) { setAdminAuth(true); setAdminErr(""); }
    else { setAdminErr("// ACCESS VIOLATION — INVALID KEY"); setAdminPass(""); audio.playSFX("fail"); }
  };

  const adjustCredits = (amount) => {
    setCredits(c => parseFloat(Math.max(0, c + amount).toFixed(2)));
    log(amount > 0 ? `Admin injected +${amount}` : `Admin drained ${Math.abs(amount)}`);
  };

  const activeMults = isFreeSpins ? FREE_MULTIPLIERS : BASE_MULTIPLIERS;

  return (
    <div
      onClick={initAudio}
      style={{
        width: "100vw",
        height: "100vh",
        background: "#02040f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Courier New', monospace",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Global CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&display=swap');

        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

        @keyframes cellPulse {
          from { filter: brightness(1); }
          to { filter: brightness(1.5) saturate(1.8); }
        }
        @keyframes cellSpin {
          from { transform: scaleY(1); opacity: 0.7; }
          to { transform: scaleY(0.85); opacity: 0.5; }
        }
        @keyframes neonFlicker {
          0%,100% { opacity: 1; }
          92% { opacity: 1; }
          93% { opacity: 0.3; }
          94% { opacity: 1; }
          96% { opacity: 0.5; }
          97% { opacity: 1; }
        }
        @keyframes glitch {
          0% { transform: translate(0); clip-path: none; }
          10% { transform: translate(-3px, 1px); clip-path: polygon(0 15%, 100% 15%, 100% 35%, 0 35%); }
          20% { transform: translate(3px, -1px); clip-path: polygon(0 60%, 100% 60%, 100% 80%, 0 80%); }
          30% { transform: translate(0); clip-path: none; }
          100% { transform: translate(0); clip-path: none; }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes bigwinPulse {
          0% { opacity: 0; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1.05); }
          70% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.9); }
        }
        @keyframes borderPulse {
          0%, 100% { box-shadow: 0 0 20px #00e5ff40, 0 0 60px #00e5ff10; }
          50% { box-shadow: 0 0 30px #00e5ff80, 0 0 80px #00e5ff30; }
        }
        @keyframes fsBorderPulse {
          0%, 100% { box-shadow: 0 0 20px #a855f740, 0 0 60px #a855f710; }
          50% { box-shadow: 0 0 40px #a855f790, 0 0 100px #a855f740; }
        }
        @keyframes pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spinRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes floatUp {
          0% { transform: translateY(0) scaleY(1); opacity: 1; }
          100% { transform: translateY(-20px) scaleY(0.8); opacity: 0; }
        }

        .btn-spin {
          transition: all 0.15s ease;
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
        }
        .btn-spin:active { transform: scale(0.93); }

        .btn-control {
          transition: all 0.12s ease;
          cursor: pointer;
          user-select: none;
        }
        .btn-control:active { transform: scale(0.88); }

        input[type="text"], input[type="number"] {
          background: #0a0f1e;
          border: 1px solid #00e5ff40;
          color: #00e5ff;
          padding: 8px 12px;
          border-radius: 4px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 14px;
          outline: none;
          width: 100%;
        }
        input[type="text"]:focus, input[type="number"]:focus {
          border-color: #00e5ff;
          box-shadow: 0 0 8px #00e5ff40;
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0f1e; }
        ::-webkit-scrollbar-thumb { background: #00e5ff40; border-radius: 2px; }
      `}</style>

      {/* CRT scanline overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100,
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
      }}/>

      {/* Moving scan line */}
      <div style={{
        position: "fixed", left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, rgba(0,229,255,0.15), transparent)",
        pointerEvents: "none", zIndex: 101,
        animation: "scanline 4s linear infinite",
      }}/>

      {/* BIG WIN FLASH */}
      {bigWinFlash && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "radial-gradient(ellipse at center, rgba(251,191,36,0.3) 0%, transparent 70%)",
          animation: "bigwinPulse 1.2s ease forwards",
          pointerEvents: "none",
        }}>
          <div style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: "clamp(28px, 8vw, 48px)",
            fontWeight: 900,
            color: "#fbbf24",
            textShadow: "0 0 30px #fbbf24, 0 0 60px #fbbf24, 0 0 120px #fbbf2480",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}>
            OVERLOAD
          </div>
        </div>
      )}

      {/* BONUS MODAL */}
      {bonusModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,0.93)",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(6px)",
        }}>
          <div style={{
            border: "2px solid #f43f5e",
            background: "linear-gradient(135deg, #0f0118, #1a0026)",
            borderRadius: 12,
            padding: "40px 50px",
            textAlign: "center",
            boxShadow: "0 0 60px #f43f5e60",
            animation: "neonFlicker 2s infinite",
          }}>
            <div style={{ color: "#f43f5e", fontSize: 11, letterSpacing: "0.5em", fontFamily: "'Share Tech Mono', monospace", marginBottom: 12 }}>
              !! CRITICAL ALERT !!
            </div>
            <div style={{
              fontFamily: "'Orbitron', monospace", fontSize: 28, fontWeight: 900,
              color: "#fff", textShadow: "0 0 20px #f43f5e, 0 0 40px #f43f5e",
              marginBottom: 10, letterSpacing: "0.1em",
            }}>
              FREE SPINS
            </div>
            <div style={{ color: "#f43f5e", fontSize: 14, fontFamily: "'Share Tech Mono', monospace" }}>
              12 ENCRYPTED CORES LOADED
            </div>
          </div>
        </div>
      )}

      {/* END FREE SPINS MODAL */}
      {endModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,0.95)",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{
            border: "2px solid #a855f7",
            background: "linear-gradient(135deg, #0a0014, #150028)",
            borderRadius: 12,
            padding: "36px 40px",
            textAlign: "center",
            boxShadow: "0 0 60px #a855f760",
            minWidth: 280,
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⬡</div>
            <div style={{
              fontFamily: "'Orbitron', monospace", fontSize: 22, fontWeight: 900,
              color: "#a855f7", textShadow: "0 0 20px #a855f7",
              marginBottom: 4, letterSpacing: "0.08em",
            }}>HEIST COMPLETE</div>
            <div style={{ color: "#64748b", fontSize: 10, letterSpacing: "0.3em", fontFamily: "'Share Tech Mono', monospace", marginBottom: 20 }}>
              ENCRYPTION SEQUENCE FINISHED
            </div>
            <div style={{
              background: "#0a0014", border: "1px solid #a855f740",
              borderRadius: 8, padding: "16px 24px", marginBottom: 20,
            }}>
              <div style={{ color: "#64748b", fontSize: 10, letterSpacing: "0.2em", fontFamily: "'Share Tech Mono', monospace" }}>TOTAL PAYOUT</div>
              <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 30, fontWeight: 900, color: "#a855f7", textShadow: "0 0 16px #a855f7" }}>
                +{freeSpinsTotalWin.toFixed(2)}
              </div>
            </div>
            <button
              className="btn-control"
              onClick={() => { audio.playSFX("click"); setEndModal(false); }}
              style={{
                background: "#a855f7", color: "#000", border: "none",
                borderRadius: 6, padding: "12px 32px",
                fontFamily: "'Orbitron', monospace", fontSize: 12, fontWeight: 900,
                letterSpacing: "0.1em", cursor: "pointer", width: "100%",
              }}
            >
              SYNC TERMINAL
            </button>
          </div>
        </div>
      )}

      {/* ADMIN PANEL */}
      {showAdmin && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 250,
          background: "rgba(0,0,0,0.95)",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            border: "1px solid #00e5ff40",
            background: "#050d1a",
            borderRadius: 10,
            padding: 24,
            width: "min(360px, 92vw)",
            maxHeight: "85vh",
            overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 13, fontWeight: 700, color: "#00e5ff", letterSpacing: "0.15em" }}>
                ADMIN GATEWAY
              </div>
              <button className="btn-control" onClick={() => { setShowAdmin(false); setAdminAuth(false); setAdminPass(""); setAdminErr(""); }}
                style={{ background: "none", border: "1px solid #f43f5e40", color: "#f43f5e", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
                CLOSE
              </button>
            </div>

            {!adminAuth ? (
              <div>
                <div style={{ color: "#64748b", fontSize: 10, letterSpacing: "0.2em", marginBottom: 8, fontFamily: "'Share Tech Mono', monospace" }}>
                  ENTER SECURITY PASSPHRASE
                </div>
                <input type="text" value={adminPass} onChange={e => setAdminPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitAdmin()}
                  placeholder="ACCESS CODE" style={{ marginBottom: 8 }} />
                {adminErr && <div style={{ color: "#f43f5e", fontSize: 10, marginBottom: 8, fontFamily: "'Share Tech Mono', monospace" }}>{adminErr}</div>}
                <button className="btn-control" onClick={submitAdmin}
                  style={{ background: "#00e5ff20", border: "1px solid #00e5ff", color: "#00e5ff", borderRadius: 4, padding: "10px 20px", cursor: "pointer", width: "100%", fontFamily: "'Orbitron', monospace", fontSize: 11, letterSpacing: "0.1em" }}>
                  AUTHENTICATE
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[["CREDITS", credits.toFixed(2)], ["SPINS", totalSpins], ["WAGERED", totalWagered.toFixed(2)], ["WON", totalWon.toFixed(2)]].map(([k, v]) => (
                    <div key={k} style={{ background: "#0a1428", border: "1px solid #00e5ff20", borderRadius: 6, padding: "10px 12px" }}>
                      <div style={{ color: "#64748b", fontSize: 9, letterSpacing: "0.2em", fontFamily: "'Share Tech Mono', monospace" }}>{k}</div>
                      <div style={{ color: "#00e5ff", fontSize: 16, fontWeight: 700, fontFamily: "'Orbitron', monospace" }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: "#64748b", fontSize: 10, marginBottom: 6, fontFamily: "'Share Tech Mono', monospace" }}>INJECT / DRAIN CREDITS</div>
                  <input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)} placeholder="AMOUNT" style={{ marginBottom: 8 }}/>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-control" onClick={() => { adjustCredits(+parseFloat(customAmount || 0)); setCustomAmount(""); }}
                      style={{ flex: 1, background: "#00e5ff15", border: "1px solid #00e5ff60", color: "#00e5ff", borderRadius: 4, padding: "8px", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>
                      + INJECT
                    </button>
                    <button className="btn-control" onClick={() => { adjustCredits(-parseFloat(customAmount || 0)); setCustomAmount(""); }}
                      style={{ flex: 1, background: "#f43f5e15", border: "1px solid #f43f5e60", color: "#f43f5e", borderRadius: 4, padding: "8px", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>
                      - DRAIN
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {[100, 500, 1000].map(amt => (
                    <button key={amt} className="btn-control" onClick={() => adjustCredits(amt)}
                      style={{ flex: 1, background: "#0f2d1a", border: "1px solid #34d39940", color: "#34d399", borderRadius: 4, padding: "8px", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>
                      +{amt}
                    </button>
                  ))}
                </div>
                <button className="btn-control" onClick={() => { setCredits(0); setTotalSpins(0); setTotalWagered(0); setTotalWon(0); setAdminLogs([]); log("System reset."); audio.playSFX("click"); }}
                  style={{ width: "100%", background: "#1a0008", border: "1px solid #f43f5e40", color: "#f43f5e", borderRadius: 4, padding: "8px", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 11, marginBottom: 16 }}>
                  ⚠ RESET ALL DATA
                </button>
                <div style={{ background: "#040a14", border: "1px solid #00e5ff15", borderRadius: 6, padding: 10, maxHeight: 120, overflowY: "auto" }}>
                  {adminLogs.length === 0 ? (
                    <div style={{ color: "#334155", fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }}>// NO EVENTS LOGGED</div>
                  ) : adminLogs.map((l, i) => (
                    <div key={i} style={{ color: "#475569", fontSize: 9, fontFamily: "'Share Tech Mono', monospace", marginBottom: 2 }}>
                      <span style={{ color: "#00e5ff60" }}>[{l.time}]</span> {l.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MAIN GAME CANVAS ─── */}
      <div style={{
        width: "min(420px, 96vw)",
        maxHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "12px 10px",
        position: "relative",
        animation: glitching ? "glitch 0.6s ease" : "none",
      }}>

        {/* HEADER */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(135deg, #050d1a, #0a1428)",
          border: `1px solid ${isFreeSpins ? "#a855f760" : "#00e5ff30"}`,
          borderRadius: 8,
          padding: "10px 14px",
          boxShadow: isFreeSpins ? "0 0 20px #a855f730" : "0 0 16px #00e5ff15",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: isFreeSpins ? "#a855f7" : "#00e5ff",
              boxShadow: `0 0 8px ${isFreeSpins ? "#a855f7" : "#00e5ff"}`,
              animation: "pulse 1.5s infinite",
            }}/>
            <span style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 14, fontWeight: 900,
              background: isFreeSpins
                ? "linear-gradient(90deg, #a855f7, #f43f5e)"
                : "linear-gradient(90deg, #00e5ff, #f43f5e)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "0.2em",
            }}>
              DATA HEIST
            </span>
            {isFreeSpins && (
              <span style={{
                background: "#a855f7", color: "#000",
                fontSize: 8, fontWeight: 900, padding: "2px 6px",
                borderRadius: 3, letterSpacing: "0.1em", fontFamily: "'Share Tech Mono', monospace",
              }}>
                FREE ×{freeSpinsLeft}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn-control" onClick={() => { audio.playSFX("click"); setShowAdmin(true); }}
              style={{ background: "none", border: "1px solid #334155", color: "#475569", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 10, fontFamily: "'Share Tech Mono', monospace" }}>
              ⌘
            </button>
            <button className="btn-control" onClick={toggleMusic}
              style={{ background: "none", border: `1px solid ${musicOn ? "#00e5ff40" : "#33415540"}`, color: musicOn ? "#00e5ff" : "#475569", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 10 }}>
              ♫
            </button>
            <button className="btn-control" onClick={toggleSound}
              style={{ background: "none", border: `1px solid ${soundOn ? "#00e5ff40" : "#33415540"}`, color: soundOn ? "#00e5ff" : "#475569", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 10 }}>
              {soundOn ? "🔊" : "🔇"}
            </button>
          </div>
        </div>

        {/* MULTIPLIER BAR */}
        <div style={{
          background: "#050d1a",
          border: "1px solid #f43f5e30",
          borderRadius: 8,
          padding: "8px 12px",
        }}>
          <div style={{ color: "#f43f5e80", fontSize: 8, letterSpacing: "0.35em", marginBottom: 6, fontFamily: "'Share Tech Mono', monospace" }}>
            CASCADE MULTIPLIERS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
            {activeMults.map((m, i) => {
              const isActive = comboIndex === i || (i === activeMults.length - 1 && comboIndex >= activeMults.length - 1);
              return (
                <div key={i} style={{
                  background: isActive ? "#00e5ff15" : "#0a1428",
                  border: `1.5px solid ${isActive ? "#00e5ff" : "#1e293b"}`,
                  borderRadius: 5,
                  padding: "6px 4px",
                  textAlign: "center",
                  fontFamily: "'Orbitron', monospace",
                  fontSize: 12, fontWeight: 900,
                  color: isActive ? "#00e5ff" : "#334155",
                  boxShadow: isActive ? "0 0 12px #00e5ff40" : "none",
                  transition: "all 0.2s ease",
                  transform: isActive ? "scale(1.05)" : "scale(1)",
                }}>
                  ×{m}
                </div>
              );
            })}
          </div>
        </div>

        {/* NARRATOR */}
        <div style={{
          background: "#020914",
          border: "1px solid #00e5ff15",
          borderRadius: 6,
          padding: "7px 12px",
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 10,
          color: isFreeSpins ? "#a855f7" : "#00e5ffcc",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          minHeight: 28,
          display: "flex",
          alignItems: "center",
          animation: "neonFlicker 8s infinite",
        }}>
          {narrator}
        </div>

        {/* GRID */}
        <div style={{
          background: "linear-gradient(135deg, #020914 0%, #040d1c 100%)",
          border: `2px solid ${isFreeSpins ? "#a855f760" : "#00e5ff25"}`,
          borderRadius: 10,
          padding: 6,
          display: "flex",
          gap: 4,
          position: "relative",
          animation: isFreeSpins ? "fsBorderPulse 2s infinite" : "borderPulse 4s infinite",
          minHeight: 240,
        }}>
          {/* grid bg glow */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 8,
            background: "radial-gradient(ellipse at center, rgba(0,229,255,0.03) 0%, transparent 70%)",
            pointerEvents: "none",
          }}/>

          {grid.map((col, ci) => (
            <div key={ci} style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 3,
              background: "#03091800",
              borderRadius: 6,
              overflow: "hidden",
            }}>
              {col.map((sym, ri) => (
                <div key={`${ci}_${ri}_${sym.id}_${sym.gold}`} style={{
                  flex: 1,
                  minHeight: 40,
                  transition: colSpinning[ci] ? "none" : "transform 0.2s ease",
                  transform: colSpinning[ci] ? `translateY(${ri * 5}px)` : "translateY(0)",
                }}>
                  <SymbolCell
                    symbol={sym}
                    isWinning={winCells.includes(`${ci}_${ri}`)}
                    isMutating={mutCells.includes(`${ci}_${ri}`)}
                    isSpinning={colSpinning[ci]}
                    colIdx={ci}
                    rowIdx={ri}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* STATS ROW */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {[
            { label: "CREDITS", value: credits.toFixed(2), color: "#00e5ff" },
            { label: "BET", value: bet.toFixed(2), color: "#94a3b8" },
            { label: "WIN", value: roundWin.toFixed(2), color: "#f43f5e" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: "#050d1a",
              border: `1px solid ${color}25`,
              borderRadius: 7,
              padding: "8px 6px",
              textAlign: "center",
            }}>
              <div style={{ color: "#475569", fontSize: 8, letterSpacing: "0.25em", fontFamily: "'Share Tech Mono', monospace", marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 15, fontWeight: 700, color, textShadow: `0 0 8px ${color}60` }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* CONTROLS */}
        <div style={{
          background: "linear-gradient(135deg, #050d1a, #040b16)",
          border: "1px solid #0f2040",
          borderRadius: 10,
          padding: "12px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}>

          {/* TURBO */}
          <button
            className="btn-control"
            onClick={() => { audio.playSFX("click"); setTurbo(t => !t); }}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              width: 62, height: 54,
              background: turbo ? "#00e5ff15" : "#0a1428",
              border: `2px solid ${turbo ? "#00e5ff" : "#1e293b"}`,
              borderRadius: 8,
              color: turbo ? "#00e5ff" : "#334155",
              boxShadow: turbo ? "0 0 16px #00e5ff40" : "none",
              cursor: "pointer",
              gap: 3,
            }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.05em" }}>TURBO</span>
          </button>

          {/* BET - */}
          <button
            className="btn-control"
            onClick={() => adjustBet(-1)}
            disabled={spinning}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 50, height: 54,
              background: "#0a1428",
              border: "2px solid #00e5ff40",
              borderRadius: 8,
              color: spinning ? "#1e293b" : "#00e5ff",
              fontSize: 22,
              cursor: spinning ? "not-allowed" : "pointer",
              boxShadow: spinning ? "none" : "0 0 10px #00e5ff20",
              opacity: spinning ? 0.4 : 1,
            }}>
            −
          </button>

          {/* SPIN BUTTON */}
          <button
            className="btn-spin"
            onClick={requestSpin}
            disabled={spinning}
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              background: isFreeSpins
                ? "radial-gradient(circle, #3b1454, #1a0730)"
                : spinning
                ? "radial-gradient(circle, #1a0a1e, #0f0518)"
                : "radial-gradient(circle, #00263a, #001829)",
              border: `3px solid ${isFreeSpins ? "#a855f7" : spinning ? "#f43f5e" : "#00e5ff"}`,
              boxShadow: isFreeSpins
                ? "0 0 30px #a855f780, 0 0 60px #a855f740, inset 0 0 20px #a855f720"
                : spinning
                ? "0 0 20px #f43f5e60, inset 0 0 10px #f43f5e20"
                : "0 0 30px #00e5ff60, 0 0 60px #00e5ff30, inset 0 0 20px #00e5ff10",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: spinning ? "not-allowed" : "pointer",
              opacity: spinning ? 0.7 : 1,
              flexShrink: 0,
            }}>
            {spinning ? (
              <span style={{ fontSize: 26, color: "#f43f5e", display: "inline-block", animation: "spinRotate 1s linear infinite" }}>↻</span>
            ) : (
              <span style={{ fontSize: 28, color: isFreeSpins ? "#a855f7" : "#00e5ff", marginLeft: 4 }}>▶</span>
            )}
          </button>

          {/* BET + */}
          <button
            className="btn-control"
            onClick={() => adjustBet(1)}
            disabled={spinning}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 50, height: 54,
              background: "#0a1428",
              border: "2px solid #00e5ff40",
              borderRadius: 8,
              color: spinning ? "#1e293b" : "#00e5ff",
              fontSize: 22,
              cursor: spinning ? "not-allowed" : "pointer",
              boxShadow: spinning ? "none" : "0 0 10px #00e5ff20",
              opacity: spinning ? 0.4 : 1,
            }}>
            +
          </button>

          {/* AUTO */}
          <button
            className="btn-control"
            onClick={toggleAuto}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              width: 62, height: 54,
              background: auto ? "#f43f5e15" : "#0a1428",
              border: `2px solid ${auto ? "#f43f5e" : "#1e293b"}`,
              borderRadius: 8,
              color: auto ? "#f43f5e" : "#334155",
              boxShadow: auto ? "0 0 16px #f43f5e40" : "none",
              cursor: "pointer",
              gap: 3,
            }}>
            <span style={{ fontSize: 18, display: "inline-block", animation: auto ? "spinRotate 1.5s linear infinite" : "none" }}>⟳</span>
            <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.05em" }}>AUTO</span>
          </button>
        </div>

        {/* FOOTER */}
        <div style={{
          textAlign: "center",
          color: "#1e293b",
          fontSize: 8,
          fontFamily: "'Share Tech Mono', monospace",
          letterSpacing: "0.3em",
        }}>
          DATA HEIST v2.0 // CYBERNETIC SYSTEMS ONLINE
        </div>
      </div>
    </div>
  );
}
