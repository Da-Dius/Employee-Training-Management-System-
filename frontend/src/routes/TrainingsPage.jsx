import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import * as api from '../api/client';
import { CATEGORIES, formatDate, formatMoney, statusBadgeClass } from '../utils';
import { useToast } from '../context/ToastContext';
import TrainingFormModal from '../components/TrainingFormModal';
import Spinner from '../components/Spinner';

export default function TrainingsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [filters, setFilters] = useState({ name: '', category: '', date: '', department: '' });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [modalState, setModalState] = useState({ show: false, training: null });
  const debounceRef = useRef(null);
  const isFirstRun = useRef(true);

  const load = useCallback(async (f) => {
    try {
      const data = await api.listTrainings(f);
      setRows(data);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(filters), 300);
    return () => clearTimeout(debounceRef.current);
  }, [filters, load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this training and all its nominees, attendance, and evidence? This cannot be undone.')) return;
    try {
      await api.deleteTraining(id);
      showToast('Training deleted');
      load(filters);
    } catch (e) {
      showToast(e.message, 'danger');
    }
  };

  const handleSave = async (data) => {
    if (modalState.training) {
      await api.updateTraining(modalState.training.id, data);
      showToast('Training updated');
    } else {
      await api.createTraining(data);
      showToast('Training created');
    }
    setModalState({ show: false, training: null });
    load(filters);
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Trainings</h1>
        <button className="btn btn-primary" onClick={() => setModalState({ show: true, training: null })}>
          <Plus className="h-4 w-4" strokeWidth={2} />New Training
        </button>
      </div>

      <div className="card mb-4">
        <div className="card-body grid grid-cols-1 gap-3 sm:grid-cols-6">
          <input
            type="text"
            className="form-input sm:col-span-2"
            placeholder="Search by training name"
            value={filters.name}
            onChange={(e) => setFilters({ ...filters, name: e.target.value })}
          />
          <select
            className="form-input sm:col-span-1"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="form-input sm:col-span-1"
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          />
          <input
            type="text"
            className="form-input sm:col-span-1"
            placeholder="Search by department"
            value={filters.department}
            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
          />
          <button
            className="btn btn-outline sm:col-span-1"
            title="Clear filters"
            onClick={() => setFilters({ name: '', category: '', date: '', department: '' })}
          >
            <X className="h-4 w-4" strokeWidth={2} />Clear
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-clean">
            <thead>
              <tr>
                <th>Training Name</th>
                <th>Category</th>
                <th>Date</th>
                <th>Venue</th>
                <th>Cost</th>
                <th>Paid</th>
                <th>Per Diem</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {!error && rows === null && (
                <tr>
                  <td colSpan={9} className="py-8 text-center">
                    <Spinner small />
                  </td>
                </tr>
              )}
              {!error && rows && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No trainings found.
                  </td>
                </tr>
              )}
              {!error &&
                rows &&
                rows.map((t) => (
                  <tr key={t.id} className="clickable-row" onClick={() => navigate(`/trainings/${t.id}`)}>
                    <td className="font-medium text-slate-900">{t.name}</td>
                    <td>{t.category}</td>
                    <td>{formatDate(t.training_date)}</td>
                    <td>{t.venue || '-'}</td>
                    <td>{formatMoney(t.cost)}</td>
                    <td>
                      <span className={t.paid ? 'badge badge-green' : 'badge badge-slate'}>{t.paid ? 'Yes' : 'No'}</span>
                    </td>
                    <td>
                      <span className={t.per_diem ? 'badge badge-green' : 'badge badge-slate'}>
                        {t.per_diem ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={statusBadgeClass(t.status)}>{t.status}</span>
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button
                          className="btn btn-outline-primary btn-icon"
                          title="Edit"
                          onClick={() => setModalState({ show: true, training: t })}
                        >
                          <Pencil className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <button
                          className="btn btn-outline-danger btn-icon"
                          title="Delete"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <TrainingFormModal
        show={modalState.show}
        training={modalState.training}
        onClose={() => setModalState({ show: false, training: null })}
        onSave={handleSave}
      />
    </>
  );
}