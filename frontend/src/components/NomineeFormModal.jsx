import { useEffect, useState } from 'react';
import { Search, UserRound, X } from 'lucide-react';
import Modal from './Modal';
import * as api from '../api/client';

const empty = {
  name: '',
  employee_number: '',
  email: '',
  department: '',
  division: '',
  section: '',
  station_region: '',
};

export default function NomineeFormModal({ show, onClose, onSave }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [searchingEmployees, setSearchingEmployees] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeResults, setShowEmployeeResults] = useState(false);

  useEffect(() => {
    if (!show) {
      setForm(empty);
      setError('');
      setEmployeeSearch('');
      setEmployees([]);
      setSelectedEmployee(null);
      setShowEmployeeResults(false);
    }
  }, [show]);

  useEffect(() => {
    if (!show || !employeeSearch.trim()) {
      setEmployees([]);
      setSearchingEmployees(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingEmployees(true);

        const data = await api.listEmployees({
          search: employeeSearch.trim(),
        });

        setEmployees(data);
        setShowEmployeeResults(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setSearchingEmployees(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [employeeSearch, show]);

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);

    setForm({
      name: employee.name || '',
      employee_number: employee.employeeNumber || '',
      email: employee.email || '',
      department: employee.department || '',
      division: employee.division || '',
      section: employee.section || '',
      station_region: employee.stationRegion || '',
    });

    setEmployeeSearch(employee.name || '');
    setShowEmployeeResults(false);
    setError('');
  };

  const clearEmployee = () => {
    setSelectedEmployee(null);
    setEmployeeSearch('');
    setEmployees([]);
    setForm(empty);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedEmployee) {
      setError('Please search for and select an employee before adding the nominee.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave(form);

      setForm(empty);
      setSelectedEmployee(null);
      setEmployeeSearch('');
      setEmployees([]);
      setShowEmployeeResults(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <Modal
      show={show}
      onClose={onClose}
      title="Add Nominee"
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
            form="nomineeForm"
            className="btn btn-primary"
            disabled={saving || !selectedEmployee}
          >
            {saving ? 'Adding...' : 'Add Nominee'}
          </button>
        </>
      }
    >
      <form
        id="nomineeForm"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {/* Employee Search */}
        <div className="relative sm:col-span-2">
          <label className="form-label">
            Employee *
          </label>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              strokeWidth={2}
            />

            <input
              type="text"
              className="form-input pl-9 pr-10"
              placeholder="Search by name, employee number or email..."
              value={employeeSearch}
              onChange={(e) => {
                setEmployeeSearch(e.target.value);
                setSelectedEmployee(null);
              }}
              onFocus={() => {
                if (employees.length > 0) {
                  setShowEmployeeResults(true);
                }
              }}
              autoComplete="off"
            />

            {employeeSearch && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={clearEmployee}
                title="Clear employee"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Search Results */}
          {showEmployeeResults && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {searchingEmployees && (
                <div className="px-4 py-3 text-sm text-slate-500">
                  Searching employees...
                </div>
              )}

              {!searchingEmployees && employees.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-500">
                  No employees found.
                </div>
              )}

              {!searchingEmployees &&
                employees.map((employee) => (
                  <button
                    key={employee._id}
                    type="button"
                    className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                    onClick={() => handleEmployeeSelect(employee)}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <UserRound className="h-4 w-4" strokeWidth={2} />
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {employee.name}
                      </span>

                      <span className="block text-xs text-slate-500">
                        {employee.employeeNumber}
                        {employee.department
                          ? ` • ${employee.department}`
                          : ''}
                      </span>

                      {employee.email && (
                        <span className="block truncate text-xs text-slate-400">
                          {employee.email}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Selected Employee Indicator */}
        {selectedEmployee && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 sm:col-span-2">
            <div className="flex items-center gap-2">
              <UserRound
                className="h-4 w-4 text-emerald-600"
                strokeWidth={2}
              />

              <div>
                <div className="text-sm font-medium text-emerald-800">
                  Employee selected
                </div>

                <div className="text-xs text-emerald-700">
                  {selectedEmployee.name} — {selectedEmployee.employeeNumber}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Name */}
        <div className="sm:col-span-2">
          <label className="form-label">
            Name
          </label>

          <input
            type="text"
            className="form-input bg-slate-50"
            value={form.name}
            readOnly
          />
        </div>

        {/* Employee Number */}
        <div>
          <label className="form-label">
            Employee Number
          </label>

          <input
            type="text"
            className="form-input bg-slate-50"
            value={form.employee_number}
            readOnly
          />
        </div>

        {/* Work Email */}
        <div>
          <label className="form-label">
            Work Email
          </label>

          <input
            type="email"
            className="form-input bg-slate-50"
            placeholder="For attendance confirmation"
            value={form.email}
            readOnly
          />
        </div>

        {/* Department */}
        <div>
          <label className="form-label">
            Department
          </label>

          <input
            type="text"
            className="form-input bg-slate-50"
            value={form.department}
            readOnly
          />
        </div>

        {/* Division */}
        <div>
          <label className="form-label">
            Division
          </label>

          <input
            type="text"
            className="form-input bg-slate-50"
            value={form.division}
            readOnly
          />
        </div>

        {/* Section */}
        <div>
          <label className="form-label">
            Section
          </label>

          <input
            type="text"
            className="form-input bg-slate-50"
            value={form.section}
            readOnly
          />
        </div>

        {/* Station / Region */}
        <div>
          <label className="form-label">
            Station/Region
          </label>

          <input
            type="text"
            className="form-input bg-slate-50"
            value={form.station_region}
            readOnly
          />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}