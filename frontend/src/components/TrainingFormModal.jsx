import { useEffect, useState } from 'react';
import Modal from './Modal';
import { CATEGORIES } from '../utils';

const emptyForm = {
  name: '',
  category: CATEGORIES[0],
  training_date: '',
  venue: '',
  cost: 0,
  paid: false,
  per_diem: false,
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
    paid: training.paid,
    per_diem: training.per_diem,
    description: training.description || '',
  };
}

export default function TrainingFormModal({ show, onClose, onSave, training }) {
  const [form, setForm] = useState(() => toFormState(training));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setForm(toFormState(training));
      setError('');
    }
  }, [training, show]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, cost: parseFloat(form.cost) || 0 });
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
        <div className="sm:col-span-4">
          <label className="form-label">Training Date *</label>
          <input
            type="date"
            className="form-input"
            required
            value={form.training_date}
            onChange={(e) => setForm({ ...form, training_date: e.target.value })}
          />
        </div>
        <div className="sm:col-span-8">
          <label className="form-label">Venue</label>
          <input
            type="text"
            className="form-input"
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
          />
        </div>
        <div className="sm:col-span-4">
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
        <div className="flex items-center gap-2 sm:col-span-4">
          <input
            type="checkbox"
            className="form-switch"
            checked={form.paid}
            onChange={(e) => setForm({ ...form, paid: e.target.checked })}
          />
          <label className="text-sm font-medium text-slate-700">Paid Training</label>
        </div>
        <div className="flex items-center gap-2 sm:col-span-4">
          <input
            type="checkbox"
            className="form-switch"
            checked={form.per_diem}
            onChange={(e) => setForm({ ...form, per_diem: e.target.checked })}
          />
          <label className="text-sm font-medium text-slate-700">Per Diem</label>
        </div>
        <div className="sm:col-span-12">
          <label className="form-label">Description (Optional)</label>
          <textarea
            className="form-input"
            rows="3"
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
