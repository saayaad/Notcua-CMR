import { SlidersHorizontal, Move, Palette, PanelsTopLeft } from 'lucide-react';
export function AttendanceSettingsMenu({
  onArrange,
  onHud,
  enabled,
  onClassic,
}: {
  onArrange: () => void;
  onHud: () => void;
  enabled: boolean;
  onClassic: () => void;
}) {
  const run = (event: React.MouseEvent, action: () => void) => {
    event.currentTarget.closest('details')?.removeAttribute('open');
    action();
  };
  return (
    <details className="attendance-settings-menu">
      <summary className="tools-toggle">
        <SlidersHorizontal size={16} />
        <span>Personalizar</span>
      </summary>
      <div className="attendance-settings-options">
        <strong>Personalizar atendimento</strong>
        <button onClick={(event) => run(event, onArrange)}>
          <Move size={16} />
          <span>Habilitar arraste e organizar painéis</span>
        </button>
        <button onClick={(event) => run(event, onHud)}>
          <Palette size={16} />
          <span>HUD, atalhos, botões e aparência</span>
        </button>
        {enabled && (
          <button onClick={(event) => run(event, onClassic)}>
            <PanelsTopLeft size={16} />
            <span>Voltar ao layout clássico</span>
          </button>
        )}
      </div>
    </details>
  );
}
