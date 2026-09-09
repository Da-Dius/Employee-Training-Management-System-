import { useEffect, useState } from 'react';
import Modal from './Modal';
import * as api from '../api/client'; // Need the API to fetch departments

const empty = {
    name: '',
    employee_number: '',
    email: '',
    department: '',
    division: '',
    section: '',
    station_region: '',
};

export default function EmployeeFormModal({
    show,
    onClose,
    onSave,
    employee = null,
}) {
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [departments, setDepartments] = useState([]); // State for the dropdown
    const [loadingDepts, setLoadingDepts] = useState(false);

    useEffect(() => {
        if (show) {
            loadDepartments();
        }
    }, [show]);

    const loadDepartments = async () => {
        try {
            setLoadingDepts(true);
            const data = await api.listDepartments();
            setDepartments(data);
        } catch (err) {
            console.error('Failed to load departments', err);
        } finally {
            setLoadingDepts(false);
        }
    };

    useEffect(() => {
        if (employee) {
            setForm({
                name: employee.name || '',
                employee_number: employee.employee_number || '',
                email: employee.email || '',
                department: employee.department || '',
                division: employee.division || '',
                section: employee.section || '',
                station_region: employee.station_region || '',
            });
        } else {
            setForm(empty);
        }
        setError('');
    }, [employee, show]);

    if (!show) return null;

    const editing = !!employee;

    const handleChange = (field, value) => {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

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
            title={editing ? 'Edit Employee' : 'Add Employee'}
            size="lg"
            footer={
                <>
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="employeeForm"
                        className="btn btn-primary"
                        disabled={saving}
                    >
                        {saving
                            ? 'Saving...'
                            : editing
                                ? 'Save Changes'
                                : 'Add Employee'}
                    </button>
                </>
            }
        >
            <form
                id="employeeForm"
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
                <div className="sm:col-span-2">
                    <label className="form-label">Employee Name *</label>
                    <input
                        type="text"
                        className="form-input"
                        required
                        value={form.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        placeholder="Full employee name"
                    />
                </div>

                <div>
                    <label className="form-label">Employee Number *</label>
                    <input
                        type="text"
                        className="form-input"
                        required
                        value={form.employee_number}
                        onChange={(e) => handleChange('employee_number', e.target.value)}
                        placeholder="Employee number"
                    />
                </div>

                <div>
                    <label className="form-label">Work Email</label>
                    <input
                        type="email"
                        className="form-input"
                        value={form.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="employee@company.com"
                    />
                </div>

                {/* --- Updated to Select Dropdown --- */}
                <div>
                    <label className="form-label">Department</label>
                    <select
                        className="form-input"
                        value={form.department}
                        onChange={(e) => handleChange('department', e.target.value)}
                        disabled={loadingDepts}
                    >
                        <option value="">Select a department...</option>
                        {departments.map(d => (
                            <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="form-label">Division</label>
                    <input
                        type="text"
                        className="form-input"
                        value={form.division}
                        onChange={(e) => handleChange('division', e.target.value)}
                    />
                </div>

                <div>
                    <label className="form-label">Section</label>
                    <input
                        type="text"
                        className="form-input"
                        value={form.section}
                        onChange={(e) => handleChange('section', e.target.value)}
                    />
                </div>

                <div>
                    <label className="form-label">Station / Region</label>
                    <input
                        type="text"
                        className="form-input"
                        value={form.station_region}
                        onChange={(e) => handleChange('station_region', e.target.value)}
                    />
                </div>

                {error && (
                    <div className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}
            </form>
        </Modal>
    );
}