let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.25) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Bright two-note chime for a successful scan. */
export function playSuccess() {
  tone(880, 0, 0.12, "sine");
  tone(1320, 0.1, 0.2, "sine");
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(60);
}

/** Low buzz for errors / unknown codes. */
export function playError() {
  tone(220, 0, 0.18, "square", 0.15);
  tone(160, 0.18, 0.25, "square", 0.15);
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([80, 60, 80]);
}

/** Call from a user gesture to unlock audio on iOS. */
export function unlockAudio() {
  audio();
}
