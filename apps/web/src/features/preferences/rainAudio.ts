/**
 * F4-R09: rain sound, produced locally (no remote audio, per X-06).
 * Primary source is a bundled, loopable recording (public/audio/rain-loop.mp3,
 * ~235KB, well under the spec's 1MB cap) served from this app, not a CDN.
 * Falls back to synthesized pink noise if the file ever fails to load, so
 * the feature never breaks outright.
 * Volume maps as gain = volume^2. Must only ever start from a user gesture
 * (F4-R04, F4-R10).
 */

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let gainNode: GainNode | null = null;
let cachedBuffer: AudioBuffer | null = null;
let bufferPromise: Promise<AudioBuffer> | null = null;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function synthesizeFallback(context: AudioContext): AudioBuffer {
  const seconds = 4;
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const data = buffer.getChannelData(0);
  // Paul Kellet's refined pink noise approximation: used only if the real
  // recording below can't be fetched/decoded (offline, blocked, etc).
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    data[i] = pink * 0.11;
  }
  return buffer;
}

async function loadRainBuffer(context: AudioContext): Promise<AudioBuffer> {
  if (cachedBuffer) return cachedBuffer;
  if (!bufferPromise) {
    bufferPromise = fetch("/audio/rain-loop.mp3")
      .then((res) => {
        if (!res.ok) throw new Error(`rain-loop.mp3 ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((buf) => (cachedBuffer = buf))
      .catch(() => (cachedBuffer = synthesizeFallback(context)));
  }
  return bufferPromise;
}

export function isRainSupported(): boolean {
  return typeof window !== "undefined" && "AudioContext" in window;
}

/** Must be called from a user gesture handler. */
export async function startRain(volume: number, fadeSeconds = 1.5): Promise<void> {
  const context = getContext();
  if (context.state === "suspended") await context.resume();
  stopRain(0); // clean any previous graph

  const buffer = await loadRainBuffer(context);
  source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  gainNode = context.createGain();
  gainNode.gain.setValueAtTime(0, context.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume ** 2, context.currentTime + fadeSeconds);

  source.connect(gainNode).connect(context.destination);
  source.start();
}

export function setRainVolume(volume: number): void {
  if (gainNode && ctx) {
    gainNode.gain.linearRampToValueAtTime(volume ** 2, ctx.currentTime + 0.2);
  }
}

export function stopRain(fadeSeconds = 1): void {
  if (!source || !gainNode || !ctx) return;
  const endTime = ctx.currentTime + fadeSeconds;
  gainNode.gain.linearRampToValueAtTime(0, endTime);
  const s = source;
  s.stop(endTime + 0.05);
  source = null;
  gainNode = null;
}
