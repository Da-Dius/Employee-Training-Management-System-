import { useEffect, useState } from 'react';
import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Users,
    Inbox,
    RotateCcw,
} from 'lucide-react';

import * as api from '../api/client';
import Spinner from '../components/Spinner';
import EmployeeFormModal from '../components/EmployeeFormModal';

export default function EmployeesPage() {
    const [employees, setEmployees] = useState(null);
    const [error, setError] = useState('');

    const [search, setSearch] = useState('');
    const [department, setDepartment] =
        useState('');

    const [modalOpen, setModalOpen] =
        useState(false);

    const [editingEmployee, setEditingEmployee] =
        useState(null);

    const [deleteId, setDeleteId] =
        useState(null);

    const loadEmployees = async () => {
        try {
            setError('');

            const data = await api.listEmployees({
                search,
                department,
            });

            setEmployees(data);
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            loadEmployees();
        }, 300);

        return () => clearTimeout(timer);
    }, [search, department]);

    const handleAdd = () => {
        setEditingEmployee(null);
        setModalOpen(true);
    };

    const handleEdit = (employee) => {
        setEditingEmployee(employee);
        setModalOpen(true);
    };

    const handleSave = async (form) => {
        if (editingEmployee) {
            await api.updateEmployee(
                editingEmployee.id,
                form
            );
        } else {
            await api.createEmployee(form);
        }

        setModalOpen(false);
        setEditingEmployee(null);

        await loadEmployees();
    };

    const handleDelete = async (employee) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete ${employee.name}?`
        );

        if (!confirmed) return;

        try {
            setDeleteId(employee.id);
            setError('');

            await api.deleteEmployee(
                employee.id
            );

            await loadEmployees();
        } catch (err) {
            setError(err.message);
        } finally {
            setDeleteId(null);
        }
    };

    const handleReset = () => {
        setSearch('');
        setDepartment('');
    };

    return (
        <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-slate-900">
                        Employees
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Manage employees available for training nominations.
                    </p>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleAdd}
                >
                    <Plus
                        className="h-4 w-4"
                        strokeWidth={2}
                    />
                    Add Employee
                </button>
            </div>

            {/* Filters */}
            <div className="card mb-5">
                <div className="card-body">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="md:col-span-2">
                            <label className="form-label">
                                Search Employees
                            </label>

                            <div className="relative">
                                <Search
                                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                    strokeWidth={2}
                                />

                                <input
                                    type="text"
                                    className="form-input pl-9"
                                    placeholder="Search by name, employee number or email..."
                                    value={search}
                                    onChange={(e) =>
                                        setSearch(e.target.value)
                                    }
                                />
                            </div>
                        </div>

                        <div>
                            <label className="form-label">
                                Department
                            </label>

                            <input
                                type="text"
                                className="form-input"
                                placeholder="Any department"
                                value={department}
                                onChange={(e) =>
                                    setDepartment(
                                        e.target.value
                                    )
                                }
                            />
                        </div>
                    </div>

                    {(search || department) && (
                        <div className="mt-3">
                            <button
                                className="btn btn-outline btn-sm"
                                onClick={handleReset}
                            >
                                <RotateCcw
                                    className="h-4 w-4"
                                    strokeWidth={2}
                                />
                                Clear Filters
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Employee table */}
            <div className="card overflow-hidden">
                {employees === null ? (
                    <div className="flex justify-center py-16">
                        <Spinner small />
                    </div>
                ) : employees.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <Inbox
                                className="h-6 w-6"
                                strokeWidth={2}
                            />
                        </span>

                        <div>
                            <div className="font-medium text-slate-700">
                                No employees found
                            </div>

                            <div className="mt-1 text-sm text-slate-500">
                                Add an employee or change your search filters.
                            </div>
                        </div>

                        <button
                            className="btn btn-outline btn-sm"
                            onClick={handleAdd}
                        >
                            <Plus
                                className="h-4 w-4"
                                strokeWidth={2}
                            />
                            Add Employee
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table-clean">
                            <thead>
                                <tr>
                                    <th>Employee Name</th>
                                    <th>Employee No.</th>
                                    <th>Email</th>
                                    <th>Department</th>
                                    <th>Division</th>
                                    <th>Section</th>
                                    <th>Station / Region</th>
                                    <th className="text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {employees.map((employee) => (
                                    <tr key={employee._id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                                    <Users
                                                        className="h-4 w-4"
                                                        strokeWidth={2}
                                                    />
                                                </span>

                                                <span className="font-medium text-slate-900">
                                                    {employee.name}
                                                </span>
                                            </div>
                                        </td>

                                        <td>
                                            {employee.employee_number}
                                        </td>

                                        <td>
                                            {employee.email || '-'}
                                        </td>

                                        <td>
                                            {employee.department || '-'}
                                        </td>

                                        <td>
                                            {employee.division || '-'}
                                        </td>

                                        <td>
                                            {employee.section || '-'}
                                        </td>

                                        <td>
                                            {employee.station_region || '-'}
                                        </td>

                                        <td className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline btn-icon"
                                                    title="Edit employee"
                                                    onClick={() =>
                                                        handleEdit(employee)
                                                    }
                                                >
                                                    <Pencil
                                                        className="h-4 w-4"
                                                        strokeWidth={2}
                                                    />
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn btn-outline btn-icon text-red-600 hover:border-red-200 hover:bg-red-50"
                                                    title="Delete employee"
                                                    disabled={
                                                        deleteId === employee.id
                                                    }
                                                    onClick={() =>
                                                        handleDelete(employee)
                                                    }
                                                >
                                                    {deleteId === employee.id ? (
                                                        <Spinner small />
                                                    ) : (
                                                        <Trash2
                                                            className="h-4 w-4"
                                                            strokeWidth={2}
                                                        />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <EmployeeFormModal
                show={modalOpen}
                employee={editingEmployee}
                onClose={() => {
                    setModalOpen(false);
                    setEditingEmployee(null);
                }}
                onSave={handleSave}
            />
        </>
    );
}