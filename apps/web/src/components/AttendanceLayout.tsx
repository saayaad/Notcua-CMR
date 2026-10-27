import { Children, Component, lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { Spinner } from './ui';
const Dock = lazy(() => import('./AttendanceDock').then((module) => ({ default: module.AttendanceDock })));
class DockRecovery extends Component<{ children: ReactNode; onRecover: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="operation-empty" role="alert">
        <h2>Vamos recuperar o Atendimento</h2>
        <p>Esta disposição não pôde ser exibida. Suas conversas e arquivos continuam salvos.</p>
        <button className="button primary" onClick={this.props.onRecover}>
          Recuperar layout clássico
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}

export function AttendanceLayout({
  enabled,
  className,
  style,
  children,
  ...props
}: {
  enabled: boolean;
  className: string;
  style: CSSProperties;
  children: ReactNode;
  toolsOpen: boolean;
  onToolsChange: (open: boolean) => void;
  onClassic: () => void;
  editRequest?: number;
  onEditRequestHandled?: () => void;
}) {
  const panels = Children.toArray(children);
  const { updatePreferences } = usePreferences();
  return enabled ? (
    <DockRecovery
      onRecover={() => {
        updatePreferences({ dockingLayout: '', dockingEnabled: false });
        props.onClassic();
      }}
    >
      <Suspense
        fallback={
          <div className="operation-empty">
            <Spinner />
            Carregando painéis…
          </div>
        }
      >
        <Dock {...props}>{{ list: panels[0], chat: panels[1], tools: panels[2] }}</Dock>
      </Suspense>
    </DockRecovery>
  ) : (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
