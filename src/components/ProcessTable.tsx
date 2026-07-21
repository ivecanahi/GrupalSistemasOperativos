import { useState } from 'react';
import type { ProcessInput } from '../types/scheduling';

interface ProcessTableProps {
  processes: ProcessInput[];
  onChange: (processes: ProcessInput[]) => void;
}

interface DraftForm {
  id: string;
  name: string;
  arrivalTime: string;
  burstTime: string;
}

const EMPTY_DRAFT: DraftForm = { id: '', name: '', arrivalTime: '', burstTime: '' };

function validateDraft(draft: DraftForm, processes: ProcessInput[], excludeId?: string): string | null {
  if (draft.id.trim() === '') return 'El id no puede estar vacío';
  if (draft.name.trim() === '') return 'El nombre no puede estar vacío';
  if (processes.some(p => p.id === draft.id && p.id !== excludeId)) {
    return 'Ya existe un proceso con ese id';
  }

  const arrivalTime = Number(draft.arrivalTime);
  if (draft.arrivalTime.trim() === '' || !Number.isFinite(arrivalTime)) {
    return 'arrivalTime debe ser un número';
  }
  if (arrivalTime <= 0) return 'arrivalTime debe ser mayor que 0';

  const burstTime = Number(draft.burstTime);
  if (draft.burstTime.trim() === '' || !Number.isFinite(burstTime)) {
    return 'burstTime debe ser un número';
  }
  if (burstTime <= 0) return 'burstTime debe ser mayor que 0';

  return null;
}

function toProcessInput(draft: DraftForm): ProcessInput {
  return {
    id: draft.id,
    name: draft.name,
    arrivalTime: Number(draft.arrivalTime),
    burstTime: Number(draft.burstTime),
  };
}

interface LabeledInputProps {
  idPrefix: string;
  field: keyof DraftForm;
  label: string;
  draft: DraftForm;
  onFieldChange: (field: keyof DraftForm, value: string) => void;
}

function LabeledInput({ idPrefix, field, label, draft, onFieldChange }: LabeledInputProps) {
  const inputId = `${idPrefix}-${field}`;
  return (
    <>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} value={draft[field]} onChange={e => onFieldChange(field, e.target.value)} />
    </>
  );
}

export function ProcessTable({ processes, onChange }: ProcessTableProps) {
  const [addDraft, setAddDraft] = useState<DraftForm>(EMPTY_DRAFT);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftForm>(EMPTY_DRAFT);
  const [editError, setEditError] = useState<string | null>(null);

  function handleAdd() {
    const message = validateDraft(addDraft, processes);
    if (message) {
      setAddError(message);
      return;
    }
    onChange([...processes, toProcessInput(addDraft)]);
    setAddDraft(EMPTY_DRAFT);
    setAddError(null);
  }

  function startEdit(process: ProcessInput) {
    setEditingId(process.id);
    setEditDraft({
      id: process.id,
      name: process.name,
      arrivalTime: String(process.arrivalTime),
      burstTime: String(process.burstTime),
    });
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  function saveEdit() {
    if (editingId === null) return;
    const message = validateDraft(editDraft, processes, editingId);
    if (message) {
      setEditError(message);
      return;
    }
    onChange(processes.map(p => (p.id === editingId ? toProcessInput(editDraft) : p)));
    setEditingId(null);
    setEditError(null);
  }

  function remove(id: string) {
    onChange(processes.filter(p => p.id !== id));
  }

  function updateAddField(field: keyof DraftForm, value: string) {
    setAddDraft({ ...addDraft, [field]: value });
  }

  function updateEditField(field: keyof DraftForm, value: string) {
    setEditDraft({ ...editDraft, [field]: value });
  }

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Id</th>
            <th>Nombre</th>
            <th>Llegada</th>
            <th>Ráfaga</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {processes.map(process =>
            editingId === process.id ? (
              <tr key={process.id}>
                <td>
                  <LabeledInput idPrefix="edit" field="id" label="Editar id" draft={editDraft} onFieldChange={updateEditField} />
                </td>
                <td>
                  <LabeledInput idPrefix="edit" field="name" label="Editar nombre" draft={editDraft} onFieldChange={updateEditField} />
                </td>
                <td>
                  <LabeledInput idPrefix="edit" field="arrivalTime" label="Editar llegada" draft={editDraft} onFieldChange={updateEditField} />
                </td>
                <td>
                  <LabeledInput idPrefix="edit" field="burstTime" label="Editar ráfaga" draft={editDraft} onFieldChange={updateEditField} />
                </td>
                <td>
                  <button onClick={saveEdit}>Guardar</button>
                  <button onClick={cancelEdit}>Cancelar</button>
                </td>
              </tr>
            ) : (
              <tr key={process.id}>
                <td>{process.id}</td>
                <td>{process.name}</td>
                <td>{process.arrivalTime}</td>
                <td>{process.burstTime}</td>
                <td>
                  <button onClick={() => startEdit(process)}>Editar</button>
                  <button onClick={() => remove(process.id)}>Eliminar</button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {editError && <p role="alert">{editError}</p>}

      <div>
        <LabeledInput idPrefix="add" field="id" label="Nuevo id" draft={addDraft} onFieldChange={updateAddField} />
        <LabeledInput idPrefix="add" field="name" label="Nuevo nombre" draft={addDraft} onFieldChange={updateAddField} />
        <LabeledInput idPrefix="add" field="arrivalTime" label="Nueva llegada" draft={addDraft} onFieldChange={updateAddField} />
        <LabeledInput idPrefix="add" field="burstTime" label="Nueva ráfaga" draft={addDraft} onFieldChange={updateAddField} />
        <button onClick={handleAdd}>Agregar</button>
      </div>
      {addError && <p role="alert">{addError}</p>}
    </div>
  );
}
