import { useEffect, useRef, useState } from 'react';
import { Paperclip, Download } from 'lucide-react';
import Modal from './Modal';
import * as api from '../api/client';
import { CATEGORIES } from '../utils';

const emptyForm = {
  name: '',
  category: CATEGORIES[0],
  training_date: '',
  venue: '',
  cost: 0,
  per_diem: false,
  service_entry: 'Not Paid',
  trainer_name: '',
  lpo_number: '',
  description: '',
};

function toFormState(training) {
  if (!training) return emptyForm;
  return {
    name: training.name,
    category: training.category,
    training_date: training.training_date,
    venue: training.venue || '',
    cost: training.cost,
    per_diem: training.per_diem,
    service_entry: training.service_entry || 'Not Paid',
    trainer_name: training.trainer_name || '',
    lpo_number: training.lpo_number || '',
    description: training.description || '',
  };
}

export default function TrainingFormModal({ show, onClose, onSave, training }) {
  const [form, setForm] = useState(() => toFormState(training));
  const [lpoFile, setLpoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (show) {
      setForm(toFormState(training));
      setLpoFile(null);
      setError('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [training, show]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.end_date && form.end_date < form.training_date) {
      setError('End date cannot be before the training date.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('category', form.category);
      fd.append('training_date', form.training_date);
      fd.append('venue', form.venue);
      fd.append('cost', String(parseFloat(form.cost) || 0));
      // Only send per_diem when true — an absent field reads as false on the backend,
      // same as how an unchecked HTML checkbox is simply omitted from a form submit.
      if (form.per_diem) fd.append('per_diem', 'true');
      fd.append('service_entry', form.service_entry);
      fd.append('trainer_name', form.trainer_name);
      fd.append('lpo_number', form.lpo_number);
      fd.append('description', form.description);
      if (lpoFile) fd.append('lpo_attachment', lpoFile);

      await onSave(fd);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={training ? 'Edit Training' : 'New Training'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="trainingForm" className="btn btn-primary" disabled={saving}>
            {training ? 'Save Changes' : 'Create Training'}
          </button>
        </>
      }
    >
      <form id="trainingForm" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <div className="sm:col-span-8">
          <label className="form-label">Training Name *</label>
          <input
            type="text"
            className="form-input"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="sm:col-span-4">
          <label className="form-label">Category *</label>
          <select
            className="form-input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-6">
          <label className="form-label">Training Date *</label>
          <input
            type="date"
            className="form-input"
            required
            value={form.training_date}
            onChange={(e) => {
              const start = e.target.value;
              // Moving the start past an already-picked end would leave the end input
              // holding a silently invalid value, so clear it and make the user re-pick.
              setForm((f) => ({
                ...f,
                training_date: start,
                training_end_date:
                  f.training_end_date && start && f.training_end_date < start ? '' : f.training_end_date,
              }));
            }}
          />
        </div>
        <div className="sm:col-span-6">
          <label className="form-label">Name of Trainer</label>
          <input
            type="text"
            className="form-input"
            value={form.trainer_name}
            onChange={(e) => setForm({ ...form, trainer_name: e.target.value })}
          />
        </div>

        <div className="sm:col-span-6">
          <label className="form-label">Venue</label>
          <input
            type="text"
            className="form-input"
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
          />
        </div>
        <div className="sm:col-span-3">
          <label className="form-label">Cost of Training</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="form-input"
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: e.target.value })}
          />
        </div>
        <div className="sm:col-span-3">
          <label className="form-label">Service Entry</label>
          <select
            className="form-input"
            value={form.service_entry}
            onChange={(e) => setForm({ ...form, service_entry: e.target.value })}
          >
            <option value="Not Paid">Not Paid</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        <div className="sm:col-span-4">
          <label className="form-label">LPO Number</label>
          <input
            type="text"
            className="form-input"
            placeholder="Purchase order no."
            value={form.lpo_number}
            onChange={(e) => setForm({ ...form, lpo_number: e.target.value })}
          />
        </div>
        <div className="sm:col-span-5">
          <label className="form-label">LPO Attachment</label>
          <input
            ref={fileInputRef}
            type="file"
            className="form-input file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt"
            onChange={(e) => setLpoFile(e.target.files?.[0] || null)}
          />
          {training?.lpo_attachment_name && !lpoFile && (
            <a
              href={api.trainingLpoAttachmentDownloadUrl(training.id)}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-[#ff0613] hover:underline"
            >
              <Paperclip className="h-3 w-3" strokeWidth={2} />
              {training.lpo_attachment_name}
              <Download className="h-3 w-3" strokeWidth={2} />
            </a>
          )}
          {training?.lpo_attachment_name && (
            <div className="form-hint">Choosing a new file replaces the current one.</div>
          )}
        </div>
        <div className="flex items-end pb-2 sm:col-span-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="form-switch"
              checked={form.per_diem}
              onChange={(e) => setForm({ ...form, per_diem: e.target.checked })}
            />
            <span className="text-sm font-medium text-zinc-700">
              {form.per_diem ? 'Per Diem' : 'Not Per Diem'}
            </span>
          </label>
        </div>

        <div className="sm:col-span-12">
          <label className="form-label">Description (Optional)</label>
          <textarea
            className="form-input"
            rows="2"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          ></textarea>
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-12">{error}</div>
        )}
      </form>
    </Modal>
  );
}