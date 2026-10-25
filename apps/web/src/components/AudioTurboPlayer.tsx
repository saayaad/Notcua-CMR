import { useEffect, useRef, useState } from 'react';
import { Select } from './Select';

export function AudioTurboPlayer({ src }: { src: string }) {
  const player = useRef<HTMLAudioElement>(null);
  const context = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const frame = useRef<number | null>(null);
  const silentSince = useRef(0);
  const values = useRef<Float32Array<ArrayBuffer> | null>(null);
  const [speed, setSpeed] = useState('1');
  const [skipSilence, setSkipSilence] = useState(false);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    void context.current?.close();
  }, []);

  const startSilenceMonitor = async (enabled = skipSilence) => {
    const audio = player.current;
    if (!audio || !enabled) return;
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
      if (frame.current !== null) cancelAnimationFrame(frame.current);
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
    }
  };

  const stopSilenceMonitor = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    silentSince.current = 0;
  };

  return (
    <div className="audio-turbo-player">
      <audio ref={player} src={src} controls preload="metadata" onPlay={() => void startSilenceMonitor()} onPause={stopSilenceMonitor} onEnded={stopSilenceMonitor} onRateChange={() => { if (player.current) setSpeed(String(player.current.playbackRate)); }} />
      <div className="audio-turbo-controls">
        <label>Velocidade <Select value={speed} onChange={(event) => {
          const value = event.target.value;
          setSpeed(value);
          if (player.current) player.current.playbackRate = Number(value);
        }}><option value="1">1×</option><option value="1.5">1,5×</option><option value="2">2×</option></Select></label>
        <label className="checkbox"><input type="checkbox" checked={skipSilence} onChange={(event) => {
          setSkipSilence(event.target.checked);
          if (event.target.checked && player.current && !player.current.paused) void startSilenceMonitor(true);
          else stopSilenceMonitor();
        }} />Pular silêncios</label>
      </div>
    </div>
  );
}
