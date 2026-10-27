import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BookOpenCheck,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Link,
  MoreHorizontal,
  Pencil,
  Redo2,
  RefreshCw,
  Scissors,
  Star,
  TextSelect,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useApi } from './ApiContext';
import { menuPosition, safeMenuUrl } from './context-menu-utils';
import './context-menu.css';

export type MenuAction = {
  label: string;
  run: () => void | Promise<unknown>;
  disabled?: boolean;
  danger?: boolean;
};
type MenuState = {
  x: number;
  y: number;
  target: HTMLElement;
  returnFocus: HTMLElement;
  actions: MenuAction[];
  title: string;
};
const Context = createContext<
  (title: string, actions: MenuAction[]) => (event: ReactMouseEvent<HTMLElement>) => void
>(() => () => undefined);
export const useContextMenu = () => useContext(Context);

function ActionIcon({ label }: { label: string }) {
  const Icon = /^copiar/i.test(label)
    ? Copy
    : /^recortar/i.test(label)
      ? Scissors
      : /^colar/i.test(label)
        ? ClipboardPaste
        : /^desfazer/i.test(label)
          ? Undo2
          : /^refazer/i.test(label)
            ? Redo2
            : /^selecionar/i.test(label)
              ? TextSelect
              : /^voltar/i.test(label)
                ? ArrowLeft
                : /^atualizar/i.test(label)
                  ? RefreshCw
                  : /^editar/i.test(label)
                    ? Pencil
                    : /favorit/i.test(label)
                      ? Star
                      : /^excluir|^apagar/i.test(label)
                        ? Trash2
                        : /^baixar/i.test(label)
                          ? Download
                          : /^visualizar/i.test(label)
                            ? Eye
                            : /outra aba/i.test(label)
                              ? ExternalLink
                              : /resposta padrão/i.test(label)
                                ? BookOpenCheck
                                : /transcrev|analisar/i.test(label)
                                  ? FileText
                                  : /link/i.test(label)
                                    ? Link
                                    : MoreHorizontal;
  return <Icon size={14} aria-hidden="true" />;
}

function editable(target: HTMLElement) {
  return target.closest<HTMLElement>('input, textarea, [contenteditable="true"]');
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const { notify } = useApi();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const copy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      notify('Copiado.');
    },
    [notify],
  );

  const open = useCallback(
    (target: HTMLElement, x: number, y: number, title = 'Noctua', actions: MenuAction[] = []) => {
      const doc = target.ownerDocument;
      const win = doc.defaultView!;
      const selection = doc.getSelection()?.toString() || '';
      const field = editable(target) as HTMLInputElement | HTMLTextAreaElement | null;
      // Passwords and special native controls retain their secure browser behavior.
      if (
        field?.tagName === 'INPUT' &&
        !['text', 'search', 'email', 'url', 'tel'].includes((field as HTMLInputElement).type)
      )
        return false;
      const extras: MenuAction[] = [];
      if (field) {
        const start = field.selectionStart;
        const end = field.selectionEnd;
        const selected =
          field.isContentEditable || start === null ? selection : field.value.slice(start ?? 0, end ?? 0);
        const range =
          field.isContentEditable && doc.getSelection()?.rangeCount
            ? doc.getSelection()!.getRangeAt(0).cloneRange()
            : null;
        const restore = () => {
          field.focus();
          if (range) {
            doc.getSelection()?.removeAllRanges();
            doc.getSelection()?.addRange(range);
          } else if (start !== null && end !== null) {
            try {
              field.setSelectionRange(start, end);
            } catch {
              /* Email inputs do not expose a selection range. */
            }
          }
        };
        const readOnly = field.hasAttribute('readonly') || field.hasAttribute('disabled');
        for (const [command, label] of [
          ['undo', 'Desfazer'],
          ['redo', 'Refazer'],
        ] as const) {
          extras.push({
            label,
            disabled: readOnly || !doc.queryCommandEnabled(command),
            run: () => {
              restore();
              if (!doc.execCommand(command)) throw new Error('native-edit');
            },
          });
        }
        extras.push({ label: 'Copiar', disabled: !selected, run: () => copy(selected) });
        extras.push({
          label: 'Recortar',
          disabled: !selected || readOnly,
          run: async () => {
            await copy(selected);
            restore();
            if (!doc.execCommand('delete')) throw new Error('native-edit');
          },
        });
        extras.push({
          label: 'Colar',
          disabled: readOnly,
          run: async () => {
            const text = await win.navigator.clipboard.readText();
            if (!text) return;
            restore();
            if (!doc.execCommand('insertText', false, text)) throw new Error('native-edit');
          },
        });
        extras.push({
          label: 'Selecionar tudo',
          run: () => {
            field.focus();
            if (field.isContentEditable) {
              const r = doc.createRange();
              r.selectNodeContents(field);
              doc.getSelection()?.removeAllRanges();
              doc.getSelection()?.addRange(r);
            } else field.select();
          },
        });
      } else {
        if (selection) extras.push({ label: 'Copiar seleção', run: () => copy(selection) });
        const link = target.closest<HTMLAnchorElement>('a[href]');
        const href = link && safeMenuUrl(link.href, doc.baseURI);
        if (href) {
          extras.push({
            label: 'Abrir link em outra aba',
            run: () => {
              win.open(href, '_blank', 'noopener,noreferrer');
            },
          });
          extras.push({ label: 'Copiar link', run: () => copy(href) });
        }
        const image = target.closest<HTMLImageElement>('img');
        const src = image && safeMenuUrl(image.currentSrc || image.src, doc.baseURI);
        if (src) {
          extras.push({
            label: 'Abrir imagem em outra aba',
            run: () => {
              win.open(src, '_blank', 'noopener,noreferrer');
            },
          });
          extras.push({ label: 'Copiar endereço da imagem', run: () => copy(src) });
          const imageUrl = new URL(src);
          if (imageUrl.protocol === 'blob:' || imageUrl.origin === win.location.origin) {
            extras.push({
              label: 'Baixar imagem',
              run: () => {
                const anchor = doc.createElement('a');
                anchor.href = src;
                anchor.download = 'noctua-imagem';
                doc.body.append(anchor);
                anchor.click();
                anchor.remove();
              },
            });
          }
        }
        if (!actions.length) {
          const region = target.closest<HTMLElement>(
            'article, .message-bubble, .resource-card, .kanban-card, [data-context-region]',
          );
          const buttons = region ? Array.from(region.querySelectorAll<HTMLButtonElement>('button')) : [];
          const direct = target.closest<HTMLButtonElement>('button');
          if (!region && direct) buttons.push(direct);
          for (const button of buttons.slice(0, 9)) {
            const label = button.getAttribute('aria-label') || button.title || button.textContent?.trim();
            if (
              label &&
              !button.hasAttribute('data-rfd-drag-handle-draggable-id') &&
              !/^arrast/i.test(label) &&
              button.getClientRects().length
            )
              extras.push({
                label,
                disabled: button.disabled,
                danger: /^(excluir|apagar|desativar)/i.test(label),
                run: () => button.click(),
              });
          }
        }
        const text = target.closest('.message-text')?.textContent;
        if (text) extras.push({ label: 'Copiar mensagem', run: () => copy(text) });
      }
      const general: MenuAction[] = [
        ...(win.history.length > 1
          ? [{ label: 'Voltar à página anterior', run: () => win.history.back() }]
          : []),
        { label: 'Atualizar página', run: () => win.location.reload() },
        { label: 'Copiar endereço desta página', run: () => copy(win.location.href) },
      ];
      const unique = [...actions, ...extras, ...general].filter(
        (action, index, all) => all.findIndex((a) => a.label === action.label) === index,
      );
      const rect = target.getBoundingClientRect();
      setMenu({
        target,
        returnFocus:
          target.closest<HTMLElement>(
            'button, a[href], input, textarea, [tabindex], [contenteditable="true"]',
          ) ||
          target.querySelector<HTMLElement>('button, a[href], [tabindex]') ||
          (doc.activeElement as HTMLElement),
        x: x || rect.left + Math.min(rect.width / 2, 40),
        y: y || rect.top + Math.min(rect.height, 30),
        title: field ? 'Editar texto' : title,
        actions: unique,
      });
      return true;
    },
    [copy],
  );

  const context = useCallback(
    (title: string, actions: MenuAction[]) => (event: ReactMouseEvent<HTMLElement>) => {
      if (event.shiftKey || editable(event.target as HTMLElement)) return;
      if (open(event.target as HTMLElement, event.clientX, event.clientY, title, actions)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [open],
  );

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.shiftKey ||
        !(event.target instanceof Element) ||
        ref.current?.contains(event.target)
      )
        return;
      if (open(event.target as HTMLElement, event.clientX, event.clientY)) event.preventDefault();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
      const target = document.activeElement as HTMLElement;
      if (!target) return;
      event.preventDefault();
      target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    };
    document.addEventListener('contextmenu', handler);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('contextmenu', handler);
      document.removeEventListener('keydown', keyboard);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const el = ref.current;
    const win = menu.target.ownerDocument.defaultView!;
    try {
      el.showPopover();
    } catch {
      /* Older browsers use the dialog/body portal. */
    }
    const rect = el.getBoundingClientRect();
    setPosition(menuPosition(menu.x, menu.y, rect.width, rect.height, win.innerWidth, win.innerHeight));
    el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const dismiss = (event: Event) => {
      if (!el.contains(event.target as Node)) setMenu(null);
    };
    const resize = () => setMenu(null);
    menu.target.ownerDocument.addEventListener('pointerdown', dismiss, true);
    menu.target.ownerDocument.addEventListener('scroll', dismiss, true);
    win.addEventListener('resize', resize);
    return () => {
      menu.target.ownerDocument.removeEventListener('pointerdown', dismiss, true);
      menu.target.ownerDocument.removeEventListener('scroll', dismiss, true);
      win.removeEventListener('resize', resize);
    };
  }, [menu]);

  const close = () => {
    menu?.returnFocus?.focus({ preventScroll: true });
    setMenu(null);
  };
  return (
    <Context.Provider value={context}>
      <div
        style={{ display: 'contents' }}
        onContextMenu={(event) => {
          if (
            !event.defaultPrevented &&
            !event.shiftKey &&
            !ref.current?.contains(event.target as Node) &&
            open(event.target as HTMLElement, event.clientX, event.clientY)
          )
            event.preventDefault();
        }}
      >
        {children}
      </div>
      {menu &&
        createPortal(
          <div
            ref={ref}
            className="noctua-context-menu"
            role="menu"
            aria-label={menu.title}
            popover="manual"
            style={position}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(event) => {
              const buttons = Array.from(
                ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [],
              );
              const current = buttons.indexOf(menu.target.ownerDocument.activeElement as HTMLButtonElement);
              if (event.key === 'Escape' || event.key === 'Tab') {
                event.preventDefault();
                close();
              } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const index =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? buttons.length - 1
                      : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
                buttons[index]?.focus();
              } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey)
                buttons
                  .find((button) =>
                    button.textContent?.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()),
                  )
                  ?.focus();
            }}
          >
            <div className="noctua-context-title">
              {menu.title}
              <span>Esc</span>
            </div>
            {menu.actions.map((action) => (
              <button
                type="button"
                role="menuitem"
                key={action.label}
                disabled={action.disabled}
                className={action.danger ? 'context-danger' : ''}
                onClick={() => {
                  close();
                  void Promise.resolve()
                    .then(action.run)
                    .catch(() =>
                      notify(
                        /copiar|colar|recortar/i.test(action.label)
                          ? 'Não foi possível acessar a área de transferência. Use Ctrl+C / Ctrl+V ou Shift + botão direito para abrir o menu do navegador.'
                          : 'Não foi possível concluir esta ação. Tente pelo botão original da página.',
                        true,
                      ),
                    );
                }}
              >
                <ActionIcon label={action.label} />
                <span>{action.label}</span>
              </button>
            ))}
            <small>Shift + botão direito: menu do navegador</small>
          </div>,
          menu.target.closest('dialog[open]') || menu.target.ownerDocument.body,
        )}
    </Context.Provider>
  );
}
