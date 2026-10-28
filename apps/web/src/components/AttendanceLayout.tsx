import { Children, Component, lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { Spinner } from './ui';
const Dock = lazy(() => import('./AttendanceDock').then((module) => ({ default: module.AttendanceDock })));
class DockRecovery extends Component<{ children: ReactNode; onRecover: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    const outdatedPage = /fetch dynamically imported module|loading chunk|importing a module script failed/i.test(this.state.error.message);
    return (
      <section className="operation-empty" role="alert">
        <h2>{outdatedPage ? 'Atualize o Atendimento' : 'Vamos recuperar o Atendimento'}</h2>
        <p>
          {outdatedPage
            ? 'Uma nova versão foi publicada enquanto esta página estava aberta. Atualize para carregar os painéis recentes.'
            : 'Esta disposição não pôde ser exibida. Suas conversas e arquivos continuam salvos.'}
        </p>
        <button className="button primary" onClick={outdatedPage ? () => window.location.reload() : this.props.onRecover}>
          {outdatedPage ? 'Atualizar página' : 'Recuperar layout clássico'}
        </button>
      </section>
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
