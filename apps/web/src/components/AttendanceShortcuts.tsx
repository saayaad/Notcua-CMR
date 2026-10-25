import { useEffect } from 'react';
import {
  BookOpenCheck,
  MessageSquare,
  Mic,
  Image,
  GitBranch,
  FileText,
  Layers,
  Wallet,
  UserRound,
  CalendarDays,
  StickyNote,
  AlarmClock,
  ArrowRightLeft,
} from 'lucide-react';
import { shortcutOptions, hotkeyMatches } from '../context/attendance';
import { completeOrder } from '../context/hud';
import { usePreferences } from '../context/PreferencesContext';
import { useHudPlacement, HudMoveHandle } from './HudPlacement';
export const shortcutIcons = {
  faq: BookOpenCheck,
  MESSAGE: MessageSquare,
  AUDIO: Mic,
  MEDIA: Image,
  FUNNEL: GitBranch,
  DOCUMENT: FileText,
  MACRO: Layers,
  PIX: Wallet,
  client: UserRound,
  schedule: CalendarDays,
  notes: StickyNote,
  next: AlarmClock,
  transfers: ArrowRightLeft,
};
export function AttendanceShortcuts({ onAction }: { onAction: (id: string) => void }) {
  const { preferences } = usePreferences();
  const placement = useHudPlacement('shortcuts');
  const ids = completeOrder(
    preferences.attendanceShortcutOrder,
    shortcutOptions.map((item) => item.id),
  ).filter((id) => !preferences.attendanceHiddenShortcuts.includes(id));
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const id = ids.find((id) => hotkeyMatches(event, preferences.shortcutKeys[id] ?? ''));
      if (id) {
        event.preventDefault();
        onAction(id);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [ids.join('|'), preferences.shortcutKeys, onAction]);
  if (!ids.length) return null;
  return (
    <div
      className="attendance-shortcuts"
      aria-label="Atalhos do atendimento"
      {...placement.attributes}
      style={placement.style}
    >
      <HudMoveHandle placement={placement} name="atalhos" />
      <div className="attendance-shortcuts-scroll">
        {ids.map((id) => {
          const item = shortcutOptions.find((item) => item.id === id)!;
          const Icon = shortcutIcons[id as keyof typeof shortcutIcons];
          const name = preferences.shortcutLabels[id] || item.name;
          return (
            <button
              key={id}
              title={`${name}${preferences.shortcutKeys[id] ? ' · ' + preferences.shortcutKeys[id] : ''}`}
              onClick={() => onAction(id)}
            >
              <Icon size={15} />
              <span>{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
