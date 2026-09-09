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

export default function NomineeFormModal({
  show,
  onClose,
  onSave,
  title = 'Add Nominee',
  submitLabel = 'Add Nominee',
  savingLabel = 'Adding...',
  notice = '',
  excludeEmployeeNumbers = [],
}) {
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
      employee_number: employee.employee_number || '',
      email: employee.email || '',
      department: employee.department || '',
      division: employee.division || '',
      section: employee.section || '',
      station_region: employee.station_region || '',
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

    if (excluded.has(form.employee_number)) {
      setError('That employee is already a nominee on this training.');
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

  const excluded = new Set(excludeEmployeeNumbers);

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={title}
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
            {saving ? savingLabel : submitLabel}
          </button>
        </>
      }
    >
      <form
        id="nomineeForm"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {notice && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:col-span-2">
            {notice}
          </div>
        )}

        <div className="relative sm:col-span-2">
          <label className="form-label">Employee *</label>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
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
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                onClick={clearEmployee}
                title="Clear employee"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>

          {showEmployeeResults && (
            <div className="card absolute z-50 mt-1 max-h-60 w-full overflow-y-auto">
              {searchingEmployees && (
                <div className="px-4 py-3 text-sm text-zinc-500">
                  Searching employees...
                </div>
              )}

              {!searchingEmployees && employees.length === 0 && (
                <div className="px-4 py-3 text-sm text-zinc-500">
                  No employees found.
                </div>
              )}

              {!searchingEmployees &&
                employees.map((employee) => {
                  const already = excluded.has(employee.employee_number);
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      disabled={already}
                      className={`flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors last:border-b-0 ${already ? 'cursor-not-allowed opacity-50' : 'hover:bg-zinc-50'
                        }`}
                      onClick={() => !already && handleEmployeeSelect(employee)}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                        <UserRound className="h-4 w-4" strokeWidth={2} />
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-zinc-900">
                          {employee.name}
                        </span>
                        <span className="block text-xs text-zinc-500">
                          {employee.employee_number}
                          {employee.department ? ` • ${employee.department}` : ''}
                        </span>
                        {employee.email && (
                          <span className="block truncate text-xs text-zinc-400">
                            {employee.email}
                          </span>
                        )}
                      </span>
                      {already && (
                        <span className="ml-auto shrink-0 text-[11px] text-zinc-400">
                          Already a nominee
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {selectedEmployee && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 sm:col-span-2">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-emerald-600" strokeWidth={2} />
              <div>
                <div className="text-sm font-medium text-emerald-800">
                  Employee selected
                </div>
                <div className="text-xs text-emerald-700">
                  {selectedEmployee.name} — {selectedEmployee.employee_number}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="form-label">Name</label>
          <input type="text" className="form-input cursor-not-allowed bg-zinc-50 text-zinc-500" value={form.name} readOnly />
        </div>
        <div>
          <label className="form-label">Employee Number</label>
          <input type="text" className="form-input cursor-not-allowed bg-zinc-50 text-zinc-500" value={form.employee_number} readOnly />
        </div>
        <div>
          <label className="form-label">Work Email</label>
          <input type="email" className="form-input cursor-not-allowed bg-zinc-50 text-zinc-500" value={form.email} readOnly />
        </div>
        <div>
          <label className="form-label">Department</label>
          <input type="text" className="form-input cursor-not-allowed bg-zinc-50 text-zinc-500" value={form.department} readOnly />
        </div>
        <div>
          <label className="form-label">Division</label>
          <input type="text" className="form-input cursor-not-allowed bg-zinc-50 text-zinc-500" value={form.division} readOnly />
        </div>
        <div>
          <label className="form-label">Section</label>
          <input type="text" className="form-input cursor-not-allowed bg-zinc-50 text-zinc-500" value={form.section} readOnly />
        </div>
        <div>
          <label className="form-label">Station / Region</label>
          <input type="text" className="form-input cursor-not-allowed bg-zinc-50 text-zinc-500" value={form.station_region} readOnly />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}