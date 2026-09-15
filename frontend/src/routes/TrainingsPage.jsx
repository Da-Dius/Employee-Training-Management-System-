import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import * as api from '../api/client';
import { CATEGORIES, formatDate, formatMoney, statusBadgeClass } from '../utils';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import TrainingFormModal from '../components/TrainingFormModal';
import Pagination, { paginate } from '../components/Pagination';
import Spinner from '../components/Spinner';

export default function TrainingsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [filters, setFilters] = useState({ name: '', category: '', date: '', department: '' });
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
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
  }, []);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setPage(1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(filters), 300);
    return () => clearTimeout(debounceRef.current);
  }, [filters, load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this program and all its nominees, attendance, and evidence? This cannot be undone.')) return;
    try {
      await api.deleteTraining(id);
      showToast('Program deleted');
      load(filters);
    } catch (e) {
      showToast(e.message, 'danger');
    }
  };

  const handleSave = async (data) => {
    if (modalState.training) {
      await api.updateTraining(modalState.training.id, data);
      showToast('Program updated');
    } else {
      await api.createTraining(data);
      showToast('Program created');
    }
    setModalState({ show: false, training: null });
    load(filters);
  };

  const { pageRows, currentPage, pageCount } = paginate(rows, page);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-zinc-900">Programs</h1>
        <button className="btn btn-primary" onClick={() => setModalState({ show: true, training: null })}>
          <Plus className="h-4 w-4" strokeWidth={2} />New Program
        </button>
      </div>

      <div className="card mb-4">
        <div className="card-body grid grid-cols-1 gap-3 sm:grid-cols-6">
          <input
            type="text"
            className="form-input sm:col-span-2"
            placeholder="Search by program name"
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
                <th>Program Name</th>
                <th>Category</th>
                <th>Date</th>
                <th>Venue</th>
                <th>Cost</th>
                <th>Service Entry</th>
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
                  <td colSpan={9} className="py-8 text-center text-zinc-400">
                    No programs found.
                  </td>
                </tr>
              )}
              {!error &&
                pageRows.map((t) => (
                  <tr key={t.id} className="clickable-row" onClick={() => navigate(`/trainings/${t.id}`)}>
                    <td className="font-medium text-zinc-900">{t.name}</td>
                    <td>{t.category}</td>
                    <td>{formatDate(t.training_date)}</td>
                    <td>{t.venue || '-'}</td>
                    <td>{formatMoney(t.cost)}</td>
                    <td>
                      <span className={t.service_entry === 'Paid' ? 'badge badge-green' : 'badge badge-slate'}>
                        {t.service_entry}
                      </span>
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
                        {isAdmin && (
                          <button
                            className="btn btn-outline-danger btn-icon"
                            title="Delete"
                            onClick={() => handleDelete(t.id)}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!error && rows && (
          <Pagination page={currentPage} pageCount={pageCount} total={rows.length} onPageChange={setPage} />
        )}
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
