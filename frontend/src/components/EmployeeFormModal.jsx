import { useEffect, useState } from 'react';
import Modal from './Modal';

const empty = {
    name: '',
    employeeNumber: '',
    email: '',
    department: '',
    division: '',
    section: '',
    stationRegion: '',
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

    useEffect(() => {
        if (employee) {
            setForm({
                name: employee.name || '',
                employeeNumber: employee.employeeNumber || '',
                email: employee.email || '',
                department: employee.department || '',
                division: employee.division || '',
                section: employee.section || '',
                stationRegion: employee.stationRegion || '',
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
                    <label className="form-label">
                        Employee Name *
                    </label>

                    <input
                        type="text"
                        className="form-input"
                        required
                        value={form.name}
                        onChange={(e) =>
                            handleChange('name', e.target.value)
                        }
                        placeholder="Full employee name"
                    />
                </div>

                <div>
                    <label className="form-label">
                        Employee Number *
                    </label>

                    <input
                        type="text"
                        className="form-input"
                        required
                        value={form.employeeNumber}
                        onChange={(e) =>
                            handleChange(
                                'employeeNumber',
                                e.target.value
                            )
                        }
                        placeholder="Employee number"
                    />
                </div>

                <div>
                    <label className="form-label">
                        Work Email
                    </label>

                    <input
                        type="email"
                        className="form-input"
                        value={form.email}
                        onChange={(e) =>
                            handleChange('email', e.target.value)
                        }
                        placeholder="employee@company.com"
                    />
                </div>

                <div>
                    <label className="form-label">
                        Department
                    </label>

                    <input
                        type="text"
                        className="form-input"
                        value={form.department}
                        onChange={(e) =>
                            handleChange(
                                'department',
                                e.target.value
                            )
                        }
                    />
                </div>

                <div>
                    <label className="form-label">
                        Division
                    </label>

                    <input
                        type="text"
                        className="form-input"
                        value={form.division}
                        onChange={(e) =>
                            handleChange(
                                'division',
                                e.target.value
                            )
                        }
                    />
                </div>

                <div>
                    <label className="form-label">
                        Section
                    </label>

                    <input
                        type="text"
                        className="form-input"
                        value={form.section}
                        onChange={(e) =>
                            handleChange(
                                'section',
                                e.target.value
                            )
                        }
                    />
                </div>

                <div>
                    <label className="form-label">
                        Station / Region
                    </label>

                    <input
                        type="text"
                        className="form-input"
                        value={form.stationRegion}
                        onChange={(e) =>
                            handleChange(
                                'stationRegion',
                                e.target.value
                            )
                        }
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