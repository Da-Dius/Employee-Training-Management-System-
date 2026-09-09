import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, ShieldAlert } from 'lucide-react';
import * as api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

export default function DepartmentsPage() {
    const { showToast } = useToast();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [departments, setDepartments] = useState(null);
    const [error, setError] = useState('');
    const [modalState, setModalState] = useState({ show: false, dept: null });
    const [formName, setFormName] = useState('');
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const load = useCallback(async () => {
        try {
            const data = await api.listDepartments();
            setDepartments(data);
            setError('');
        } catch (e) {
            setError(e.message);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleOpenModal = (dept = null) => {
        setModalState({ show: true, dept });
        setFormName(dept ? dept.name : '');
    };

    const handleCloseModal = () => {
        setModalState({ show: false, dept: null });
        setFormName('');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formName.trim()) return;
        setSaving(true);
        try {
            if (modalState.dept) {
                await api.updateDepartment(modalState.dept.id, { name: formName });
                showToast('Department updated');
            } else {
                await api.createDepartment({ name: formName });
                showToast('Department created');
            }
            handleCloseModal();
            load();
        } catch (e) {
            showToast(e.message, 'danger');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this department?')) return;
        setDeletingId(id);
        try {
            await api.deleteDepartment(id);
            showToast('Department deleted');
            load();
        } catch (e) {
            showToast(e.message, 'danger');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-xl font-semibold text-zinc-900">Departments</h1>
                    {!isAdmin && (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
                            <ShieldAlert className="h-4 w-4" />
                            Only Administrators can add or modify official KRA departments.
                        </p>
                    )}
                </div>

                {/* Hide New Button for non-admins */}
                {isAdmin && (
                    <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                        <Plus className="h-4 w-4" strokeWidth={2} /> New Department
                    </button>
                )}
            </div>

            <div className="card overflow-hidden max-w-3xl">
                <table className="table-clean">
                    <thead>
                        <tr>
                            <th>Department Name</th>
                            {/* Hide Actions column header for non-admins */}
                            {isAdmin && <th className="text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {error && (
                            <tr>
                                <td colSpan={isAdmin ? 2 : 1} className="py-8 text-center text-red-600">{error}</td>
                            </tr>
                        )}
                        {!error && departments === null && (
                            <tr>
                                <td colSpan={isAdmin ? 2 : 1} className="py-8 text-center"><Spinner small /></td>
                            </tr>
                        )}
                        {!error && departments && departments.length === 0 && (
                            <tr>
                                <td colSpan={isAdmin ? 2 : 1} className="py-8 text-center text-zinc-400">No departments found.</td>
                            </tr>
                        )}
                        {!error && departments && departments.map((d) => (
                            <tr key={d.id}>
                                <td className="font-medium text-zinc-900">{d.name}</td>
                                {/* Hide action buttons for non-admins */}
                                {isAdmin && (
                                    <td className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <button
                                                className="btn btn-outline-primary btn-icon"
                                                onClick={() => handleOpenModal(d)}
                                                title="Edit"
                                            >
                                                <Pencil className="h-4 w-4" strokeWidth={2} />
                                            </button>
                                            <button
                                                className="btn btn-outline-danger btn-icon"
                                                disabled={deletingId === d.id}
                                                onClick={() => handleDelete(d.id)}
                                                title="Delete"
                                            >
                                                {deletingId === d.id ? <Spinner small /> : <Trash2 className="h-4 w-4" strokeWidth={2} />}
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {modalState.show && isAdmin && (
                <div className="modal-backdrop">
                    <div className="modal-content max-w-md">
                        <div className="modal-header">
                            <h2 className="text-lg font-semibold">{modalState.dept ? 'Edit Department' : 'New Department'}</h2>
                            <button className="text-zinc-400 hover:text-zinc-600" onClick={handleCloseModal}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="modal-body">
                            <form id="deptForm" onSubmit={handleSave}>
                                <div className="mb-4">
                                    <label className="form-label">Department Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. Finance"
                                    />
                                </div>
                            </form>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline" onClick={handleCloseModal}>Cancel</button>
                            <button type="submit" form="deptForm" className="btn btn-primary" disabled={saving}>
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}