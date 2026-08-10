/**
 * Zero-asset, low-latency audio. Everything is synthesized through WebAudio
 * so there is no network fetch and no decode latency. The context is created
 * lazily on the first user gesture (autoplay policy).
 */
class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  init() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private tone(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; slideTo?: number; delay?: number } = {}
  ) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    g.gain.setValueAtTime(opts.gain ?? 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, gain: number, filterFreq: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  impact() {
    this.tone(160, 0.09, { type: "sine", gain: 0.5, slideTo: 85 });
    this.noise(0.05, 0.18, 900);
  }

  pass(combo: number) {
    this.tone(360 + Math.min(combo, 10) * 55, 0.09, { type: "triangle", gain: 0.24 });
  }

  /** Short "plim" — reward feedback, once per platform consumed (see systems.ts's stepGameplay). */
  coin() {
    this.tone(1046, 0.05, { type: "sine", gain: 0.22 });
    this.tone(1568, 0.09, { type: "sine", gain: 0.18, delay: 0.045 });
  }

  fireOn() {
    this.noise(0.3, 0.3, 2400);
    this.tone(200, 0.35, { type: "sawtooth", gain: 0.16, slideTo: 640 });
  }

  smash() {
    this.noise(0.16, 0.42, 2200);
    this.tone(120, 0.12, { type: "square", gain: 0.2, slideTo: 60 });
  }

  death() {
    this.noise(0.5, 0.5, 500);
    this.tone(220, 0.55, { type: "sawtooth", gain: 0.35, slideTo: 40 });
  }

  cashout() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone(f, 0.16, { type: "triangle", gain: 0.28, delay: i * 0.09 })
    );
  }

  /** "Meta alcançada" — short triumphant shimmer, distinct from cashout. */
  goal() {
    [659, 831, 988].forEach((f, i) =>
      this.tone(f, 0.14, { type: "triangle", gain: 0.26, delay: i * 0.07 })
    );
    this.tone(1976, 0.3, { type: "sine", gain: 0.14, delay: 0.2 });
    this.noise(0.25, 0.12, 3200, 0.18);
  }
}

export const AudioManager = new AudioManagerImpl();
