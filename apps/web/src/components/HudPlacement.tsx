import { useContext, useRef, useState, useEffect, type CSSProperties, type PointerEvent } from 'react';
import { DockingContext } from '../context/docking';
import { Move } from 'lucide-react';
import { usePreferences, type HudBlockPosition } from '../context/PreferencesContext';
import { snapFloatingPosition } from '../context/hud-placement';
export function useHudPlacement(id: string) {
  const docking = useContext(DockingContext);
  const { preferences, updatePreferences } = usePreferences();
  const [desktop, setDesktop] = useState(() => window.innerWidth > 760);
  useEffect(() => {
    const resize = () => setDesktop(window.innerWidth > 760);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const [draft, setDraft] = useState<HudBlockPosition | null>(null);
  const origin = useRef<{ x: number; y: number; position: HudBlockPosition } | null>(null);
  const saved = preferences.hudBlockPositions[id];
  const position = draft ?? saved;
  const floating = !docking && position?.mode === 'floating' && desktop;
  const style: CSSProperties = floating
    ? {
        position: 'fixed',
        left: `${Math.max(0, Math.min(90, position.x))}vw`,
        top: `${Math.max(0, Math.min(85, position.y))}vh`,
        width: `min(${position.width}vw,calc(100vw - ${position.x}vw - .5rem))`,
        height: `min(${position.height}vh,calc(100dvh - ${position.y}vh - .5rem))`,
        zIndex: 40,
      }
    : {};
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (!floating || !position) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { x: event.clientX, y: event.clientY, position };
  };
  const positionAt = (event: PointerEvent<HTMLButtonElement>) => {
    const previous = origin.current;
    if (!previous) return null;
    return {
      ...previous.position,
      x: Math.max(
        0,
        Math.min(
          100 - previous.position.width,
          previous.position.x + ((event.clientX - previous.x) / window.innerWidth) * 100,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          100 - previous.position.height,
          previous.position.y + ((event.clientY - previous.y) / window.innerHeight) * 100,
        ),
      ),
    };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const next = positionAt(event);
    if (next) setDraft(next);
  };
  const end = (event: PointerEvent<HTMLButtonElement>) => {
    const final = positionAt(event) ?? draft;
    if (final) {
      const snapped = snapFloatingPosition(id, final, preferences.hudBlockPositions);
      updatePreferences({ hudBlockPositions: { ...preferences.hudBlockPositions, [id]: snapped } });
    }
    origin.current = null;
    setDraft(null);
  };
  const cancel = () => {
    origin.current = null;
    setDraft(null);
  };
  return {
    floating,
    style,
    attributes: { 'data-hud-floating': floating ? 'true' : undefined },
    start,
    move,
    end,
    cancel,
  };
}
export function HudMoveHandle({
  placement,
  name,
}: {
  placement: ReturnType<typeof useHudPlacement>;
  name: string;
}) {
  return placement.floating ? (
    <button
      className="hud-free-handle"
      title={`Mover ${name}`}
      aria-label={`Mover ${name}`}
      onPointerDown={placement.start}
      onPointerMove={placement.move}
      onPointerUp={placement.end}
      onPointerCancel={placement.cancel}
    >
      <Move size={14} />
    </button>
  ) : null;
}
