import { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
export function ReorderList({
  items,
  onChange,
  disabled = false,
  label,
}: {
  items: { id: string; name: string }[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  label: string;
}) {
  const [dragging, setDragging] = useState('');
  const move = (from: number, to: number) => {
    if (from < 0 || to < 0 || to >= items.length || from === to) return;
    const ids = items.map((item) => item.id);
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    onChange(ids);
  };
  return (
    <ol className="reorder-list" aria-label={label}>
      {items.map((item, index) => (
        <li
          key={item.id}
          draggable={!disabled}
          onDragStart={(event) => {
            setDragging(item.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.id);
          }}
          onDragOver={(event) => {
            if (!disabled && dragging) event.preventDefault();
          }}
          onDragEnd={() => setDragging('')}
          onDrop={(event) => {
            event.preventDefault();
            if (!disabled)
              move(
                items.findIndex((row) => row.id === dragging),
                index,
              );
            setDragging('');
          }}
        >
          <GripVertical size={16} className="reorder-grip" aria-hidden="true" />
          <span>{item.name}</span>
          <button
            type="button"
            className="icon-button"
            aria-label={`Subir ${item.name}`}
            disabled={disabled || index === 0}
            onClick={() => move(index, index - 1)}
          >
            <ArrowUp size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`Descer ${item.name}`}
            disabled={disabled || index === items.length - 1}
            onClick={() => move(index, index + 1)}
          >
            <ArrowDown size={16} />
          </button>
        </li>
      ))}
    </ol>
  );
}
