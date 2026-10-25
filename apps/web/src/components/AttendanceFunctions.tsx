import { useHudPlacement, HudMoveHandle } from './HudPlacement';
import { toolboxSections } from './ToolboxWorkspace';
import { completeOrder } from '../context/hud';
import { usePreferences } from '../context/PreferencesContext';
export function AttendanceFunctions({ onAction }: { onAction: (section: string) => void }) {
  const { preferences } = usePreferences();
  const placement = useHudPlacement('functions');
  if (toolboxSections.every((item) => preferences.hudHiddenTools.includes(item.id))) return null;
  return (
    <nav
      className="attendance-functions"
      aria-label="Funções do atendimento"
      {...placement.attributes}
      style={placement.style}
    >
      <HudMoveHandle placement={placement} name="funções" />
      {completeOrder(
        preferences.hudToolOrder,
        toolboxSections.map((item) => item.id),
      )
        .filter((id) => !preferences.hudHiddenTools.includes(id))
        .map((id) => {
          const item = toolboxSections.find((entry) => entry.id === id)!;
          const Icon = item.icon;
          return (
            <button key={id} title={item.name} onClick={() => onAction(id === 'responses' ? 'catalog' : id)}>
              <Icon size={15} />
              <span>{item.name}</span>
            </button>
          );
        })}
    </nav>
  );
}
