import { useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle, MoreHorizontal, Pause, Play, RotateCcw } from 'lucide-react';
import {
  AUDIO_SPEEDS,
  audioPlaybackCoordinator,
  createWaveformBars,
  formatMediaTime,
  nextAudioSpeed,
  toggleAudioPlayback,
} from './media-controls';

export function AudioTurboPlayer({
  src,
  id,
  downloadName,
  onDownload,
  onRetry,
}: {
  src: string;
  id: string;
  downloadName: string;
  onDownload: () => void;
  onRetry: () => void;
}) {
  const player = useRef<HTMLAudioElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const context = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const frame = useRef<number | null>(null);
  const silentSince = useRef(0);
  const values = useRef<Float32Array<ArrayBuffer> | null>(null);
  const [speed, setSpeed] = useState<(typeof AUDIO_SPEEDS)[number]>(1);
  const [skipSilence, setSkipSilence] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const progress = duration ? Math.min(1, currentTime / duration) : 0;
  const bars = createWaveformBars(id);

  useEffect(() => () => {
    audioPlaybackCoordinator.stop(id);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    void context.current?.close();
  }, [id]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const stopSilenceMonitor = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    silentSince.current = 0;
  };

  const startSilenceMonitor = async () => {
    const audio = player.current;
    if (!audio || !skipSilence) return;
    try {
      if (!context.current) {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(audio);
        const meter = audioContext.createAnalyser();
        meter.fftSize = 512;
        source.connect(meter);
        meter.connect(audioContext.destination);
        context.current = audioContext;
        analyser.current = meter;
        values.current = new Float32Array(meter.fftSize);
      }
      await context.current.resume();
      stopSilenceMonitor();
      const scan = (now: number) => {
        const element = player.current;
        const meter = analyser.current;
        const buffer = values.current;
        if (!element || element.paused || !meter || !buffer) return;
        meter.getFloatTimeDomainData(buffer);
        const rms = Math.sqrt(buffer.reduce((sum, value) => sum + value * value, 0) / buffer.length);
        if (rms < 0.008) {
          if (!silentSince.current) silentSince.current = now;
          if (now - silentSince.current > 650 && element.currentTime < element.duration - 0.2) {
            element.currentTime = Math.min(element.duration, element.currentTime + 0.18);
            silentSince.current = now;
          }
        } else silentSince.current = 0;
        frame.current = requestAnimationFrame(scan);
      };
      frame.current = requestAnimationFrame(scan);
    } catch {
      setSkipSilence(false);
      stopSilenceMonitor();
    }
  };

  const togglePlayback = async () => {
    const audio = player.current;
    if (!audio || !ready || failed) return;
    try { await toggleAudioPlayback(audio); } catch { setFailed(true); }
  };

  const seek = (value: number) => {
    if (player.current && Number.isFinite(value)) {
      player.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  return (
    <div className="conversation-audio-player" data-audio-id={id}>
      <audio
        ref={player}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
          setReady(true);
          setFailed(false);
        }}
        onCanPlay={() => { setReady(true); setFailed(false); }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={(event) => {
          const currentAudio = event.currentTarget;
          audioPlaybackCoordinator.start(id, () => currentAudio.pause());
          setPlaying(true);
          void startSilenceMonitor();
        }}
        onPause={() => { audioPlaybackCoordinator.stop(id); setPlaying(false); stopSilenceMonitor(); }}
        onEnded={() => { audioPlaybackCoordinator.stop(id); setPlaying(false); stopSilenceMonitor(); }}
        onError={() => { setFailed(true); setReady(false); setPlaying(false); stopSilenceMonitor(); }}
        onRateChange={(event) => setSpeed(event.currentTarget.playbackRate as (typeof AUDIO_SPEEDS)[number])}
      />
      <button
        type="button"
        className="conversation-audio-play"
        aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
        disabled={!ready || failed}
        onClick={() => void togglePlayback()}
      >
        {failed ? <RotateCcw size={19} /> : playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
      </button>
      <div className="conversation-audio-main">
        {failed ? (
          <div className="conversation-audio-error" role="status">
            <span>Não foi possível abrir este áudio.</span>
            <button type="button" onClick={onRetry}>Tentar novamente</button>
          </div>
        ) : !ready ? (
          <div className="conversation-audio-loading" role="status"><LoaderCircle size={15} /> Carregando áudio…</div>
        ) : (
          <>
            <div className="conversation-audio-wave" aria-hidden="true">
              {bars.map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} className={index / bars.length <= progress ? 'played' : ''} />
              ))}
              <input
                type="range"
                min={0}
                max={Math.max(duration, 0.1)}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                aria-label="Posição do áudio"
                aria-valuetext={`${formatMediaTime(currentTime)} de ${formatMediaTime(duration)}`}
                onChange={(event) => seek(Number(event.target.value))}
              />
            </div>
            <div className="conversation-audio-times"><span>{formatMediaTime(currentTime)}</span><span>{formatMediaTime(duration)}</span></div>
          </>
        )}
      </div>
      <button
        type="button"
        className="conversation-audio-speed"
        aria-label={`Velocidade ${String(speed).replace('.', ',')}x. Alterar velocidade`}
        onClick={() => {
          const next = nextAudioSpeed(speed);
          setSpeed(next);
          if (player.current) player.current.playbackRate = next;
        }}
      >{String(speed).replace('.', ',')}×</button>
      <div className="conversation-audio-menu" ref={menu}>
        <button type="button" className="conversation-audio-menu-trigger" aria-label="Mais opções do áudio" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <MoreHorizontal size={19} />
        </button>
        {menuOpen && (
          <div className="conversation-audio-menu-popover" role="menu">
            <label role="menuitemcheckbox" aria-checked={skipSilence}>
              <input type="checkbox" checked={skipSilence} onChange={(event) => {
                setSkipSilence(event.target.checked);
                if (event.target.checked && player.current && !player.current.paused) void startSilenceMonitor();
                else stopSilenceMonitor();
              }} />
              Pular silêncios
            </label>
            <button type="button" role="menuitem" title={downloadName} onClick={() => { onDownload(); setMenuOpen(false); }}><Download size={15} /> Baixar áudio</button>
          </div>
        )}
      </div>
    </div>
  );
}
