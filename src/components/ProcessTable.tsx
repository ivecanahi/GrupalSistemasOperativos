// ============================================================
// TABLA DE PROCESOS — CRUD completo con soporte de E/S y colas
// ============================================================
// Componente principal para que el usuario ingrese, edite y
// elimine procesos. Incluye formulario para agregar procesos
// con múltiples operaciones de E/S y selector de cola (SJF/RR).
// Validación completa de campos antes de guardar.

import { useState } from 'react';
import type { ProcessInput, QueueAssignment } from '../types/scheduling';
import { normalizeIoOperations } from '../core/ioOperations';

interface ProcessTableProps {
  processes: ProcessInput[];     // Lista actual de procesos
  onChange: (processes: ProcessInput[]) => void; // Para actualizar la lista
  colorMap: Map<string, string>; // Colores asignados a cada proceso
}

// Borrador de una operación de E/S (strings para el formulario)
interface IoOperationDraft { after: string; duration: string; }

// Borrador del formulario de proceso
interface DraftForm {
  id: string;
  arrivalTime: string;
  burstTime: string;
  queue: QueueAssignment;
  ioOperations: IoOperationDraft[];
}

type ScalarField = 'id' | 'arrivalTime' | 'burstTime';

const EMPTY_DRAFT: DraftForm = { id: '', arrivalTime: '', burstTime: '', queue: 'SJF', ioOperations: [] };

// Valida el formulario: IDs únicos, números positivos, E/S consistentes
function validateDraft(draft: DraftForm, processes: ProcessInput[], excludeId?: string): string | null {
  if (draft.id.trim() === '') return 'El nombre del proceso no puede estar vacío';
  if (processes.some(p => p.id === draft.id && p.id !== excludeId))
    return 'Ya existe un proceso con ese nombre';

  const arrivalTime = Number(draft.arrivalTime);
  if (draft.arrivalTime.trim() === '' || !Number.isFinite(arrivalTime)) return 'El tiempo de llegada debe ser un número';
  if (arrivalTime < 0) return 'El tiempo de llegada no puede ser negativo';

  const burstTime = Number(draft.burstTime);
  if (draft.burstTime.trim() === '' || !Number.isFinite(burstTime)) return 'La ráfaga de CPU debe ser un número';
  if (burstTime <= 0) return 'La ráfaga de CPU debe ser mayor que 0';

  const afters: number[] = [];
  for (const op of draft.ioOperations) {
    const afterBlank = op.after.trim() === '';
    const durationBlank = op.duration.trim() === '';
    if (afterBlank && durationBlank) continue;
    if (afterBlank !== durationBlank) return 'Cada operación de E/S necesita el momento y la duración completos';

    const after = Number(op.after);
    if (!Number.isFinite(after) || after <= 0) return 'El momento de la E/S debe ser un número mayor que 0';
    if (after > burstTime) return 'El momento de la E/S no puede superar la ráfaga de CPU';

    const duration = Number(op.duration);
    if (!Number.isFinite(duration) || duration <= 0) return 'La duración de la E/S debe ser un número mayor que 0';
    afters.push(after);
  }

  // Los momentos de E/S deben ser únicos
  const sortedAfters = [...afters].sort((a, b) => a - b);
  for (let i = 1; i < sortedAfters.length; i++) {
    if (sortedAfters[i] === sortedAfters[i - 1]) return 'Los momentos de E/S no pueden repetirse';
  }
  return null;
}

// Convierte el borrador a un ProcessInput válido
function toProcessInput(draft: DraftForm): ProcessInput {
  const ops = draft.ioOperations
    .filter(op => op.after.trim() !== '' || op.duration.trim() !== '')
    .map(op => ({ after: Number(op.after), duration: Number(op.duration) }));
  return {
    id: draft.id, name: draft.id,
    arrivalTime: Number(draft.arrivalTime), burstTime: Number(draft.burstTime),
    queue: draft.queue,
    ioOperations: ops.length > 0 ? ops : undefined,
  };
}

// Formatea las operaciones de E/S para mostrar en tabla
function formatIoOperations(process: ProcessInput): string {
  const ops = normalizeIoOperations(process);
  if (ops.length === 0) return '—';
  return ops.map(op => `${op.after}→${op.duration}`).join(', ');
}

// Selector de cola (SJF/RR)
function QueueSelect({ idPrefix, label, value, onChange }: {
  idPrefix: 'add' | 'edit'; label: string; value: QueueAssignment; onChange: (v: QueueAssignment) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={`${idPrefix}-queue`}>{label}</label>
      <select id={`${idPrefix}-queue`} value={value} onChange={e => onChange(e.target.value as QueueAssignment)}>
        <option value="SJF">SJF</option>
        <option value="RR">RR</option>
      </select>
    </div>
  );
}

// Input con label
function LabeledInput({ idPrefix, field, label, draft, onFieldChange }: {
  idPrefix: string; field: ScalarField; label: string; draft: DraftForm; onFieldChange: (f: ScalarField, v: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={`${idPrefix}-${field}`}>{label}</label>
      <input id={`${idPrefix}-${field}`} value={draft[field]} onChange={e => onFieldChange(field, e.target.value)} />
    </div>
  );
}

// Editor de lista de operaciones de E/S (añadir/eliminar filas)
function IoOperationsEditor({ idPrefix, testId, ops, onAdd, onRemove, onFieldChange }: {
  idPrefix: 'add' | 'edit'; testId: string; ops: IoOperationDraft[];
  onAdd: () => void; onRemove: (index: number) => void;
  onFieldChange: (index: number, field: keyof IoOperationDraft, value: string) => void;
}) {
  const labelPrefix = idPrefix === 'add' ? '' : 'Editar ';
  return (
    <div className="io-ops-editor" data-testid={testId}>
      {ops.map((op, index) => (
        <div className="io-op-row" key={index}>
          <div className="field">
            <label htmlFor={`${idPrefix}-io-after-${index}`}>{`${labelPrefix}Tras (ms) ${index + 1}`}</label>
            <input id={`${idPrefix}-io-after-${index}`} value={op.after} onChange={e => onFieldChange(index, 'after', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${idPrefix}-io-duration-${index}`}>{`${labelPrefix}Duración (ms) ${index + 1}`}</label>
            <input id={`${idPrefix}-io-duration-${index}`} value={op.duration} onChange={e => onFieldChange(index, 'duration', e.target.value)} />
          </div>
          <button type="button" className="btn btn-ghost io-op-remove" onClick={() => onRemove(index)} aria-label={`${labelPrefix}Eliminar operación de E/S ${index + 1}`}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" onClick={onAdd}>+ Agregar E/S</button>
    </div>
  );
}

// Componente principal de la tabla de procesos
export function ProcessTable({ processes, onChange, colorMap }: ProcessTableProps) {
  const [addDraft, setAddDraft] = useState<DraftForm>(EMPTY_DRAFT);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftForm>(EMPTY_DRAFT);
  const [editError, setEditError] = useState<string | null>(null);

  // Agrega un nuevo proceso validado
  function handleAdd() {
    const message = validateDraft(addDraft, processes);
    if (message) { setAddError(message); return; }
    onChange([...processes, toProcessInput(addDraft)]);
    setAddDraft(EMPTY_DRAFT);
    setAddError(null);
  }

  // Inicia edición inline de un proceso
  function startEdit(process: ProcessInput) {
    setEditingId(process.id);
    setEditDraft({
      id: process.id, arrivalTime: String(process.arrivalTime), burstTime: String(process.burstTime),
      queue: process.queue ?? 'SJF',
      ioOperations: normalizeIoOperations(process).map(op => ({ after: String(op.after), duration: String(op.duration) })),
    });
    setEditError(null);
  }

  function cancelEdit() { setEditingId(null); setEditError(null); }

  // Guarda cambios de edición
  function saveEdit() {
    if (editingId === null) return;
    const message = validateDraft(editDraft, processes, editingId);
    if (message) { setEditError(message); return; }
    onChange(processes.map(p => (p.id === editingId ? toProcessInput(editDraft) : p)));
    setEditingId(null); setEditError(null);
  }

  function remove(id: string) { onChange(processes.filter(p => p.id !== id)); }

  function updateAddField(field: ScalarField, value: string) { setAddDraft({ ...addDraft, [field]: value }); }
  function updateEditField(field: ScalarField, value: string) { setEditDraft({ ...editDraft, [field]: value }); }

  function addIoOp(which: 'add' | 'edit') {
    const op = { after: '', duration: '' };
    if (which === 'add') setAddDraft({ ...addDraft, ioOperations: [...addDraft.ioOperations, op] });
    else setEditDraft({ ...editDraft, ioOperations: [...editDraft.ioOperations, op] });
  }

  function removeIoOp(which: 'add' | 'edit', index: number) {
    const filter = (ops: IoOperationDraft[]) => ops.filter((_, i) => i !== index);
    if (which === 'add') setAddDraft({ ...addDraft, ioOperations: filter(addDraft.ioOperations) });
    else setEditDraft({ ...editDraft, ioOperations: filter(editDraft.ioOperations) });
  }

  function updateIoOp(which: 'add' | 'edit', index: number, field: keyof IoOperationDraft, value: string) {
    const apply = (draft: DraftForm): DraftForm => ({
      ...draft, ioOperations: draft.ioOperations.map((op, i) => (i === index ? { ...op, [field]: value } : op)),
    });
    if (which === 'add') setAddDraft(apply(addDraft));
    else setEditDraft(apply(editDraft));
  }

  return (
    <div className="process-table-wrap">
      <table className="process-table">
        <thead>
          <tr>
            <th>Proceso</th><th>Llegada</th><th>Ráfaga</th><th>Cola</th>
            <th>Operaciones E/S</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {processes.map(process =>
            editingId === process.id ? (
              <tr key={process.id}>
                <td><LabeledInput idPrefix="edit" field="id" label="Editar proceso" draft={editDraft} onFieldChange={updateEditField} /></td>
                <td><LabeledInput idPrefix="edit" field="arrivalTime" label="Editar llegada" draft={editDraft} onFieldChange={updateEditField} /></td>
                <td><LabeledInput idPrefix="edit" field="burstTime" label="Editar ráfaga" draft={editDraft} onFieldChange={updateEditField} /></td>
                <td><QueueSelect idPrefix="edit" label="Editar cola" value={editDraft.queue} onChange={value => setEditDraft({ ...editDraft, queue: value })} /></td>
                <td><IoOperationsEditor idPrefix="edit" testId="edit-io-ops" ops={editDraft.ioOperations} onAdd={() => addIoOp('edit')} onRemove={index => removeIoOp('edit', index)} onFieldChange={(index, field, value) => updateIoOp('edit', index, field, value)} /></td>
                <td className="row-actions">
                  <button className="btn btn-primary" onClick={saveEdit}>Guardar</button>
                  <button className="btn btn-ghost" onClick={cancelEdit}>Cancelar</button>
                </td>
              </tr>
            ) : (
              <tr key={process.id}>
                <td><span className="process-color-dot" style={{ background: colorMap.get(process.id) ?? 'var(--series-1)' }} />{process.id}</td>
                <td>{process.arrivalTime}</td>
                <td>{process.burstTime}</td>
                <td>{process.queue ?? 'SJF'}</td>
                <td>{formatIoOperations(process)}</td>
                <td className="row-actions">
                  <button className="btn btn-ghost" onClick={() => startEdit(process)}>Editar</button>
                  <button className="btn btn-danger" onClick={() => remove(process.id)}>Eliminar</button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {editError && <p role="alert" className="field-error">{editError}</p>}

      {/* Formulario para agregar nuevo proceso */}
      <div className="process-form" id="agregar-proceso">
        <h3 className="process-form-title">Agregar proceso</h3>
        <div className="process-form-fields">
          <LabeledInput idPrefix="add" field="id" label="Nuevo proceso" draft={addDraft} onFieldChange={updateAddField} />
          <LabeledInput idPrefix="add" field="arrivalTime" label="Nueva llegada" draft={addDraft} onFieldChange={updateAddField} />
          <LabeledInput idPrefix="add" field="burstTime" label="Nueva ráfaga" draft={addDraft} onFieldChange={updateAddField} />
          <QueueSelect idPrefix="add" label="Nueva cola" value={addDraft.queue} onChange={value => setAddDraft({ ...addDraft, queue: value })} />
        </div>
        <div className="process-form-io">
          <h4 className="process-form-subtitle">Operaciones de E/S (opcional)</h4>
          <IoOperationsEditor idPrefix="add" testId="add-io-ops" ops={addDraft.ioOperations} onAdd={() => addIoOp('add')} onRemove={index => removeIoOp('add', index)} onFieldChange={(index, field, value) => updateIoOp('add', index, field, value)} />
        </div>
        {addError && <p role="alert" className="field-error">{addError}</p>}
        <div className="process-form-submit">
          <button className="btn btn-primary" onClick={handleAdd}>Agregar</button>
        </div>
      </div>
    </div>
  );
}
