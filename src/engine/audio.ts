// All sound is generated with Web Audio: no audio files ship with the game.
export type SfxName =
  | 'chime' // alert chime, card open
  | 'alarm' // red warning
  | 'blip' // UI click / call end static
  | 'static' // radio static
  | 'tick' // one clock tick
  | 'success'
  | 'fail'
  | 'thud' // dropped object, wrong slot
  | 'type'; // typewriter

export type AmbientName = 'hum' | 'fans' | 'synth' | 'drone' | 'piano' | 'theme' | 'wind' | 'tick' | 'static' | null;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientNodes: { stop(): void } | null = null;
  private ambientName: AmbientName = null;
  volume = 0.6;
  muted = false;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC() as AudioContext;
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  /** Browsers only allow audio after a user gesture; call this from the first click/key. */
  unlock() {
    const c = this.ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  setVolume(v: number, muted: boolean) {
    this.volume = v;
    this.muted = muted;
    this.applyVolume();
  }

  private applyVolume() {
    if (this.master && this.ctx) this.master.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'square', gain = 0.15, when = 0, slideTo?: number) {
    const c = this.ensure();
    if (!c || !this.master) return;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain = 0.08, filterFreq = 2000) {
    const c = this.ensure();
    if (!c || !this.master) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  sfx(name: SfxName) {
    if (this.muted) return;
    switch (name) {
      case 'chime':
        this.tone(880, 0.25, 'triangle', 0.18);
        this.tone(1320, 0.35, 'triangle', 0.14, 0.12);
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          this.tone(740, 0.16, 'square', 0.12, i * 0.36);
          this.tone(520, 0.16, 'square', 0.12, i * 0.36 + 0.18);
        }
        break;
      case 'blip':
        this.tone(660, 0.05, 'square', 0.08);
        break;
      case 'static':
        this.noise(0.35, 0.12, 3000);
        break;
      case 'tick':
        this.tone(1800, 0.03, 'square', 0.05);
        break;
      case 'success':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.15, i * 0.08));
        break;
      case 'fail':
        this.tone(330, 0.3, 'sawtooth', 0.1, 0, 160);
        break;
      case 'thud':
        this.tone(110, 0.15, 'sine', 0.3, 0, 60);
        break;
      case 'type':
        this.tone(1200 + Math.random() * 200, 0.015, 'square', 0.02);
        break;
    }
  }

  ambient(name: AmbientName) {
    if (name === this.ambientName) return;
    this.ambientName = name;
    this.ambientNodes?.stop();
    this.ambientNodes = null;
    const c = this.ensure();
    if (!c || !this.master || !name) return;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, c.currentTime);
    out.gain.exponentialRampToValueAtTime(1, c.currentTime + 1.5);
    out.connect(this.master);
    const oscs: OscillatorNode[] = [];
    const add = (freq: number, type: OscillatorType, gain: number, lfo?: number) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = c.createGain();
      g.gain.value = gain;
      if (lfo) {
        const l = c.createOscillator();
        const lg = c.createGain();
        l.frequency.value = lfo;
        lg.gain.value = gain * 0.6;
        l.connect(lg).connect(g.gain);
        l.start();
        oscs.push(l);
      }
      o.connect(g).connect(out);
      o.start();
      oscs.push(o);
    };
    let timer: number | undefined;
    switch (name) {
      case 'hum':
        add(55, 'sine', 0.05);
        add(110, 'sine', 0.02, 0.2);
        break;
      case 'fans':
        add(80, 'sawtooth', 0.012, 0.5);
        add(120, 'sine', 0.03);
        break;
      case 'drone':
        add(49, 'sawtooth', 0.02, 0.1);
        add(73.4, 'sine', 0.03, 0.07);
        break;
      case 'wind':
        add(65, 'triangle', 0.02, 0.05);
        break;
      case 'tick':
        timer = window.setInterval(() => this.sfx('tick'), 1000);
        break;
      case 'static':
        timer = window.setInterval(() => this.noise(0.25, 0.03, 2500 + Math.random() * 1500), 600);
        break;
      case 'synth':
      case 'piano':
      case 'theme': {
        // A slow arpeggio; the "theme" is a little brighter than the piano.
        const notes = name === 'theme' ? [262, 330, 392, 494, 392, 330] : name === 'synth' ? [220, 262, 330, 262] : [196, 247, 294, 247];
        let i = 0;
        timer = window.setInterval(() => {
          if (this.muted) return;
          this.tone(notes[i % notes.length], 1.6, name === 'synth' ? 'sawtooth' : 'sine', name === 'synth' ? 0.025 : 0.06);
          i++;
        }, name === 'theme' ? 700 : 1100);
        add(notes[0] / 2, 'sine', 0.02);
        break;
      }
    }
    this.ambientNodes = {
      stop: () => {
        if (timer) clearInterval(timer);
        const now = c.currentTime;
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(out.gain.value, now);
        out.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        oscs.forEach((o) => o.stop(now + 0.9));
      },
    };
  }
}

export const audio = new AudioEngine();
