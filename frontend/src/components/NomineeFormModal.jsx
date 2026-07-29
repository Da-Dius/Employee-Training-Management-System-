import { useState } from 'react';
import Modal from './Modal';

const empty = { name: '', employee_number: '', email: '', department: '', division: '', section: '', station_region: '' };

export default function NomineeFormModal({ show, onClose, onSave }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      setForm(empty);
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
      title="Add Nominee"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="nomineeForm" className="btn btn-primary" disabled={saving}>
            Add Nominee
          </button>
        </>
      }
    >
      <form id="nomineeForm" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="form-label">Name *</label>
          <input
            type="text"
            className="form-input"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="form-label">Employee Number *</label>
          <input
            type="text"
            className="form-input"
            required
            value={form.employee_number}
            onChange={(e) => setForm({ ...form, employee_number: e.target.value })}
          />
        </div>
        <div>
          <label className="form-label">Work Email</label>
          <input
            type="email"
            className="form-input"
            placeholder="for attendance confirmation"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="form-label">Department</label>
          <input
            type="text"
            className="form-input"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
        </div>
        <div>
          <label className="form-label">Division</label>
          <input
            type="text"
            className="form-input"
            value={form.division}
            onChange={(e) => setForm({ ...form, division: e.target.value })}
          />
        </div>
        <div>
          <label className="form-label">Section</label>
          <input
            type="text"
            className="form-input"
            value={form.section}
            onChange={(e) => setForm({ ...form, section: e.target.value })}
          />
        </div>
        <div>
          <label className="form-label">Station/Region</label>
          <input
            type="text"
            className="form-input"
            value={form.station_region}
            onChange={(e) => setForm({ ...form, station_region: e.target.value })}
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>
        )}
      </form>
    </Modal>
  );
}
