import { Children, lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import { Spinner } from './ui';
const Dock = lazy(() => import('./AttendanceDock').then((module) => ({ default: module.AttendanceDock })));

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
}) {
  const panels = Children.toArray(children);
  return enabled ? (
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
  ) : (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
