export const AUDIO_SPEEDS = [1, 1.5, 2] as const;

export function nextAudioSpeed(current: number) {
  const index = AUDIO_SPEEDS.indexOf(current as (typeof AUDIO_SPEEDS)[number]);
  return AUDIO_SPEEDS[(index + 1 + AUDIO_SPEEDS.length) % AUDIO_SPEEDS.length]!;
}

export async function toggleAudioPlayback(audio: Pick<HTMLAudioElement, 'paused' | 'play' | 'pause'>) {
  if (audio.paused) await audio.play();
  else audio.pause();
}

export function formatMediaTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = wholeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function createWaveformBars(seed: string, count = 36) {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return Array.from({ length: count }, (_, index) => {
    value = Math.imul(value ^ (index + 1), 16777619);
    return 20 + ((value >>> 0) % 81);
  });
}

type PendingDownload<T> = {
  key: string;
  priority: number;
  order: number;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export class MediaDownloadQueue {
  private active = 0;
  private sequence = 0;
  private pending: PendingDownload<unknown>[] = [];
  private inFlight = new Map<string, Promise<unknown>>();
  private drainScheduled = false;

  constructor(readonly concurrency = 3) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error('A concorrência da fila de mídia precisa ser um inteiro positivo.');
    }
  }

  get activeCount() {
    return this.active;
  }

  enqueue<T>(key: string, run: () => Promise<T>, priority = 0): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const result = new Promise<T>((accept, decline) => {
      resolve = accept;
      reject = decline;
    });
    this.inFlight.set(key, result);
    this.pending.push({ key, priority, order: this.sequence++, run, resolve: (value) => resolve(value as T), reject });
    if (!this.drainScheduled) {
      this.drainScheduled = true;
      queueMicrotask(() => {
        this.drainScheduled = false;
        this.drain();
      });
    }
    return result;
  }

  private drain() {
    this.pending.sort((a, b) => b.priority - a.priority || a.order - b.order);
    while (this.active < this.concurrency && this.pending.length) {
      const task = this.pending.shift()!;
      this.active++;
      const finish = () => {
          this.active--;
          this.inFlight.delete(task.key);
          this.drain();
      };
      void Promise.resolve().then(task.run).then(
        (value) => { finish(); task.resolve(value); },
        (error) => { finish(); task.reject(error); },
      );
    }
  }
}

export class MediaBlobCache {
  private entries = new Map<string, Blob>();
  private bytes = 0;

  constructor(readonly maxBytes = 32 * 1024 * 1024) {}

  get sizeBytes() {
    return this.bytes;
  }

  get(key: string) {
    const value = this.entries.get(key);
    if (!value) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  delete(key: string) {
    const previous = this.entries.get(key);
    if (!previous) return;
    this.bytes -= previous.size;
    this.entries.delete(key);
  }

  set(key: string, value: Blob) {
    if (value.size > this.maxBytes) return;
    const previous = this.entries.get(key);
    if (previous) {
      this.bytes -= previous.size;
      this.entries.delete(key);
    }
    while (this.bytes + value.size > this.maxBytes && this.entries.size) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.bytes -= this.entries.get(oldest)?.size ?? 0;
      this.entries.delete(oldest);
    }
    this.entries.set(key, value);
    this.bytes += value.size;
  }
}

export class AudioPlaybackCoordinator {
  private active: { id: string; pause: () => void } | null = null;

  start(id: string, pause: () => void) {
    if (this.active?.id !== id) this.active?.pause();
    this.active = { id, pause };
  }

  stop(id: string) {
    if (this.active?.id === id) this.active = null;
  }
}

export const mediaDownloadQueue = new MediaDownloadQueue(3);
export const mediaBlobCache = new MediaBlobCache();
export const audioPlaybackCoordinator = new AudioPlaybackCoordinator();

export function createMediaFilename(kind: 'audio' | 'image' | 'video', contactName: string, sentAt: string, mimeType = '') {
  const person = contactName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36) || 'contato';
  const date = Number.isNaN(new Date(sentAt).getTime()) ? 'data' : new Date(sentAt).toISOString().slice(0, 10);
  const extension = mimeType.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || ({ audio: 'ogg', image: 'jpg', video: 'mp4' }[kind]);
  return `${kind}-${person}-${date}.${extension}`;
}

export function downloadMedia(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const observers = new Map<Element | null, IntersectionObserver>();
const observedElements = new Map<IntersectionObserver, Set<Element>>();
const visibilityHandlers = new WeakMap<Element, () => void>();

export function observeMediaNearViewport(element: Element, root: Element | null, onVisible: () => void) {
  if (typeof IntersectionObserver === 'undefined') {
    onVisible();
    return () => undefined;
  }
  let observer = observers.get(root);
  if (!observer) {
    observer = new IntersectionObserver((entries, currentObserver) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        currentObserver.unobserve(entry.target);
        observedElements.get(currentObserver)?.delete(entry.target);
        const handler = visibilityHandlers.get(entry.target);
        visibilityHandlers.delete(entry.target);
        handler?.();
      }
    }, { root, rootMargin: '600px 0px', threshold: 0.01 });
    observers.set(root, observer);
    observedElements.set(observer, new Set());
  }
  visibilityHandlers.set(element, onVisible);
  observedElements.get(observer)?.add(element);
  observer.observe(element);
  return () => {
    visibilityHandlers.delete(element);
    observer?.unobserve(element);
    const targets = observedElements.get(observer!);
    targets?.delete(element);
    if (targets?.size === 0) {
      observer?.disconnect();
      observedElements.delete(observer!);
      if (observers.get(root) === observer) observers.delete(root);
    }
  };
}
