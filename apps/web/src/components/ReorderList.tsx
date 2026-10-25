import { useId } from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { Eye, EyeOff, GripVertical, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
type OrderItem = { id: string; name: string; visible?: boolean; locked?: boolean };
export function ReorderList({
  items,
  onChange,
  disabled = false,
  label,
  onVisibilityChange,
  onEdit,
}: {
  items: OrderItem[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  label: string;
  onEdit?: (id: string) => void;
  onVisibilityChange?: (id: string, visible: boolean) => void;
}) {
  const regionId = useId();
  const move = (from: number, to: number) => {
    if (disabled || from < 0 || to < 0 || to >= items.length || from === to) return;
    const ids = items.map((item) => item.id);
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    onChange(ids);
  };
  return (
    <div className="reorder-editor">
      <p className="reorder-help">
        Arraste pela alça ou use as setas para mover.
        {onVisibilityChange && ' Use o olho para mostrar ou ocultar.'}
      </p>
      <DragDropContext
        onDragEnd={({ source, destination }) => {
          if (destination) move(source.index, destination.index);
        }}
      >
        <Droppable droppableId={regionId}>
          {(provided) => (
            <ol
              className="reorder-list"
              aria-label={label}
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {items.map((item, index) => (
                <Draggable
                  key={item.id}
                  draggableId={`${regionId}-${item.id}`}
                  index={index}
                  isDragDisabled={disabled}
                >
                  {(drag, state) => (
                    <li
                      ref={drag.innerRef}
                      {...drag.draggableProps}
                      className={`${state.isDragging ? 'reorder-dragging' : ''} ${item.visible === false ? 'reorder-is-hidden' : ''}`}
                    >
                      <button
                        type="button"
                        className="reorder-handle"
                        {...drag.dragHandleProps}
                        aria-label={`Arrastar ${item.name}`}
                        title="Arraste ou use Espaço e as setas"
                        disabled={disabled}
                      >
                        <GripVertical size={17} />
                      </button>
                      <span>{item.name}</span>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Subir ${item.name}`}
                        disabled={disabled || index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Descer ${item.name}`}
                        disabled={disabled || index === items.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDown size={14} />
                      </button>

                      {onEdit && (
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Configurar ${item.name}`}
                          onClick={() => onEdit(item.id)}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {onVisibilityChange && (
                        <button
                          type="button"
                          className="icon-button reorder-visibility"
                          aria-label={`${item.visible === false ? 'Mostrar' : 'Ocultar'} ${item.name}`}
                          aria-pressed={item.visible !== false}
                          disabled={disabled || item.locked}
                          title={
                            item.locked
                              ? 'Esta ferramenta permanece disponível'
                              : item.visible === false
                                ? 'Mostrar'
                                : 'Ocultar'
                          }
                          onClick={() => onVisibilityChange(item.id, item.visible === false)}
                        >
                          {item.visible === false ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      )}
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ol>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
