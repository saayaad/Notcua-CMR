import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import './select.css';
type Option = { value: string; label: ReactNode; text: string; disabled: boolean; color?: string };
const plain = (node: ReactNode): string =>
  Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child) ? plain(child.props.children) : String(child ?? ''),
    )
    .join('');
function optionsFrom(node: ReactNode, disabled = false): Option[] {
  return Children.toArray(node).flatMap((child) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        value?: unknown;
        disabled?: boolean;
        style?: { color?: string };
        'data-color'?: string;
      }>(child)
    )
      return [];
    if (child.type === 'option')
      return [
        {
          value: String(child.props.value ?? plain(child.props.children)),
          label: child.props.children,
          text: plain(child.props.children),
          disabled: disabled || Boolean(child.props.disabled),
          color: child.props['data-color'] || child.props.style?.color,
        },
      ];
    return optionsFrom(child.props.children, disabled || Boolean(child.props.disabled));
  });
}
const normalized = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function Select({
  children,
  value,
  defaultValue,
  onChange,
  name,
  id,
  className = '',
  style,
  disabled,
  required,
  multiple,
  searchable,
  title,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { searchable?: boolean }) {
  const generated = useId();
  const listId = `select-${generated}`;
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [autoLabel, setAutoLabel] = useState('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [location, setLocation] = useState({ left: 0, top: 0, width: 0, maxHeight: 320 });
  const options = useMemo(() => optionsFrom(children), [children]);
  const initial = () => {
    const entry = defaultValue ?? options.find((option) => !option.disabled)?.value ?? '';
    return Array.isArray(entry) ? entry.map(String) : [String(entry)];
  };
  const [internal, setInternal] = useState(initial);
  const selected =
    value === undefined ? internal : Array.isArray(value) ? value.map(String) : [String(value)];
  const filtered = options.filter(
    (option) =>
      normalized(option.text).includes(normalized(query)) && !((required || multiple) && !option.value),
  );
  const visible = filtered.slice(0, 250);
  const label =
    selected
      .map((value) => options.find((option) => option.value === value)?.text)
      .filter(Boolean)
      .join(', ') || 'Selecione';
  useEffect(() => {
    const label = root.current?.closest('label');
    if (label)
      setAutoLabel(
        Array.from(label.childNodes)
          .filter((node) => !(node instanceof Element && node.contains(root.current)))
          .map((node) => node.textContent ?? '')
          .join(' ')
          .trim(),
      );
  }, [children]);
  const close = () => {
    setOpen(false);
    setQuery('');
    button.current?.focus({ preventScroll: true });
  };
  const emit = (values: string[]) => {
    setInternal(values);
    const target = {
      value: values[0] ?? '',
      name: name ?? '',
      selectedOptions: values.map((value) => ({ value })),
      options: options.map((option) => ({ ...option, selected: values.includes(option.value) })),
    };
    onChange?.({ target, currentTarget: target } as unknown as ChangeEvent<HTMLSelectElement>);
  };
  const choose = (option: Option) => {
    if (option.disabled || disabled) return;
    emit(
      multiple
        ? selected.includes(option.value)
          ? selected.filter((value) => value !== option.value)
          : [...selected, option.value]
        : [option.value],
    );
    if (!multiple) close();
  };
  const place = () => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - 12;
    const height = Math.min(360, Math.max(140, below >= 180 ? below : rect.top - 12));
    setLocation({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 220) - 8)),
      top: below >= 180 ? rect.bottom + 5 : Math.max(8, rect.top - height - 5),
      width: Math.min(window.innerWidth - 16, Math.max(rect.width, 220)),
      maxHeight: height,
    });
  };
  useEffect(() => {
    const form = root.current?.closest('form');
    const reset = () => {
      if (value === undefined) setInternal(initial());
    };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [value, defaultValue]);
  useEffect(() => {
    if (!open) return;
    place();
    const overlay = popup.current;
    if (overlay && 'showPopover' in overlay) {
      try {
        overlay.showPopover();
      } catch {}
    }
    if (searchable || options.length > 7) searchInput.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      if (overlay && 'hidePopover' in overlay) {
        try {
          overlay.hidePopover();
        } catch {}
      }
    };
  }, [open]);
  const keydown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) setOpen(true);
      setActive((index) =>
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? visible.length - 1
            : Math.max(0, Math.min(visible.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))),
      );
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (visible[active]) choose(visible[active]);
    } else if (event.key === ' ' && !open) {
      event.preventDefault();
      setOpen(true);
    }
  };
  return (
    <div ref={root} className={`custom-select ${className}`} style={style}>
      <input
        type="hidden"
        name={name}
        value={multiple ? selected.join(',') : (selected[0] ?? '')}
        disabled={disabled}
      />
      {required && (
        <input
          className="select-validation"
          aria-hidden="true"
          tabIndex={-1}
          required
          disabled={disabled}
          value={selected.filter(Boolean).join(',')}
          onChange={() => undefined}
          onInvalid={(event) => {
            event.preventDefault();
            button.current?.focus();
            setOpen(true);
          }}
        />
      )}
      <button
        ref={button}
        id={id}
        type="button"
        className="select-trigger"
        role="combobox"
        aria-label={ariaLabel || autoLabel}
        aria-labelledby={ariaLabelledBy}
        aria-required={required}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        disabled={disabled}
        title={title || label}
        onKeyDown={keydown}
        onClick={() => {
          setOpen((value) => !value);
          setQuery('');
          setActive(
            Math.max(
              0,
              visible.findIndex((option) => selected.includes(option.value)),
            ),
          );
        }}
        onBlur={rest.onBlur as never}
        onFocus={rest.onFocus as never}
      >
        <span>{label}</span>
        <ChevronDown size={15} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            popover="manual"
            className="select-popover"
            style={{
              left: location.left,
              top: location.top,
              width: location.width,
              maxHeight: location.maxHeight,
            }}
            onKeyDown={keydown}
          >
            {(searchable || options.length > 7) && (
              <label className="select-search">
                <Search size={14} />
                <input
                  ref={searchInput}
                  autoComplete="off"
                  aria-label="Pesquisar opções"
                  placeholder="Pesquisar…"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                />
              </label>
            )}
            <div
              role="listbox"
              id={listId}
              aria-multiselectable={multiple || undefined}
              className="select-options"
            >
              {visible.map((option, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected.includes(option.value)}
                  disabled={option.disabled}
                  key={option.value}
                  className={index === active ? 'keyboard-active' : ''}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  {option.color && <i style={{ background: option.color }} />}
                  <span>{option.label}</span>
                  {selected.includes(option.value) && <Check size={15} />}
                </button>
              ))}
              {!visible.length && <p>Nenhuma opção encontrada.</p>}
              {filtered.length > 250 && <p>Refine a busca para ver mais opções.</p>}
            </div>
            {multiple && (
              <footer>
                <button type="button" onClick={() => emit([])}>
                  <X size={13} />
                  Limpar
                </button>
                <button type="button" onClick={close}>
                  Concluir
                </button>
              </footer>
            )}
          </div>,
          root.current?.closest('dialog') ?? document.body,
        )}
    </div>
  );
}
export function MultiSelect({
  options,
  value,
  onChange,
  label,
  placeholder = 'Nenhuma seleção',
}: {
  options: { value: string; label: string; color?: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <Select
      multiple
      searchable
      aria-label={label}
      value={value.length ? value : ['']}
      onChange={(event) =>
        onChange(
          Array.from(event.target.selectedOptions)
            .map((option) => option.value)
            .filter(Boolean),
        )
      }
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value} data-color={option.color}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
