import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Pencil,
  Users,
  ClipboardCheck,
  Download,
  UserPlus,
  Link2,
  Trash2,
  Paperclip,
  Upload,
  FileText,
} from 'lucide-react';
import * as api from '../api/client';
import { formatDate, formatMoney, statusBadgeClass } from '../utils';
import { useToast } from '../context/ToastContext';
import TrainingFormModal from '../components/TrainingFormModal';
import NomineeFormModal from '../components/NomineeFormModal';
import Spinner from '../components/Spinner';

export default function TrainingDetailPage() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [training, setTraining] = useState(null);
  const [nominees, setNominees] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [nomineeModalOpen, setNomineeModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState(null);

  const loadTraining = useCallback(async () => {
    try {
      const t = await api.getTraining(id);
      setTraining(t);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  const loadNominees = useCallback(async () => {
    const rows = await api.listNominees(id);
    setNominees(rows);
  }, [id]);

  const loadEvidence = useCallback(async () => {
    const rows = await api.listEvidence(id);
    setEvidence(rows);
  }, [id]);

  useEffect(() => {
    loadTraining();
    loadNominees();
    loadEvidence();
  }, [loadTraining, loadNominees, loadEvidence]);

  const handleSaveTraining = async (data) => {
    await api.updateTraining(id, data);
    showToast('Training updated');
    setEditOpen(false);
    loadTraining();
  };

  const handleAddNominee = async (data) => {
    await api.createNominee(id, data);
    showToast('Nominee added');
    setNomineeModalOpen(false);
    loadNominees();
  };

  const handleAttendanceChange = async (nomineeId, status) => {
    try {
      await api.setAttendance(id, nomineeId, status);
      showToast('Attendance updated');
      loadNominees();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  };

  const handleDeleteNominee = async (nomineeId) => {
    if (!window.confirm('Remove this nominee from the training?')) return;
    try {
      await api.deleteNominee(id, nomineeId);
      loadNominees();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  };

  const handleCopyLink = async (token) => {
    const url = `${window.location.origin}/confirm.html?token=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Confirmation link copied to clipboard');
    } catch {
      window.prompt('Copy this confirmation link:', url);
    }
  };

  const nomineesWithEmail = nominees.filter((n) => n.email);

  const handleCopyAllLinks = async () => {
    if (!nomineesWithEmail.length) {
      showToast('No nominees with a work email on file yet', 'warning');
      return;
    }
    const text = nomineesWithEmail
      .map((n) => `${n.name} <${n.email}>: ${window.location.origin}/confirm.html?token=${n.confirmation_token}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${nomineesWithEmail.length} confirmation link(s) to clipboard`);
    } catch {
      window.prompt('Copy these confirmation links:', text);
    }
  };

  const handleExportLinksCsv = () => {
    if (!nomineesWithEmail.length) {
      showToast('No nominees with a work email on file yet', 'warning');
      return;
    }
    // Prefix a leading =/+/-/@ with a quote so spreadsheet apps don't evaluate the cell as a formula (CSV injection).
    const sanitizeCsvField = (value) => {
      const str = String(value ?? '');
      return /^[=+\-@]/.test(str) ? `'${str}` : str;
    };
    const escapeCsv = (value) => `"${sanitizeCsvField(value).replace(/"/g, '""')}"`;
    const header = ['Name', 'Employee Number', 'Email', 'Confirmation Link', 'Self-Confirmed'];
    const rows = nomineesWithEmail.map((n) => [
      n.name,
      n.employee_number,
      n.email,
      `${window.location.origin}/confirm.html?token=${n.confirmation_token}`,
      n.employee_confirmed ? 'Yes' : 'No',
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${training.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-confirmation-links.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!uploadFiles || !uploadFiles.length) {
      showToast('Choose at least one file first', 'warning');
      return;
    }
    try {
      await api.uploadEvidence(id, uploadFiles);
      setUploadFiles(null);
      showToast('Evidence uploaded');
      loadEvidence();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  };

  const handleDeleteEvidence = async (evidenceId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await api.deleteEvidence(id, evidenceId);
      loadEvidence();
    } catch (e) {
      showToast(e.message, 'danger');
    }
  };

  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!training)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );

  return (
    <>
      <div className="mb-4">
        <Link to="/trainings" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />Back to Trainings
        </Link>
      </div>

      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="mb-2 text-xl font-semibold text-slate-900">{training.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="badge badge-slate border border-slate-200">{training.category}</span>
                <span className={statusBadgeClass(training.status)}>{training.status}</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" strokeWidth={2} />
                  {formatDate(training.training_date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" strokeWidth={2} />
                  {training.venue || 'No venue set'}
                </span>
              </div>
            </div>
            <button className="btn btn-outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" strokeWidth={2} />Edit
            </button>
          </div>
          <hr className="my-5 border-slate-100" />
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-slate-500">Cost of Training</div>
              <div className="font-semibold text-slate-900">{formatMoney(training.cost)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Paid Training</div>
              <div className="font-semibold text-slate-900">{training.paid ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Per Diem</div>
              <div className="font-semibold text-slate-900">{training.per_diem ? 'Yes' : 'No'}</div>
            </div>
          </div>
          {training.description && (
            <div className="mt-5">
              <div className="text-xs text-slate-500">Description</div>
              <div className="text-slate-700">{training.description}</div>
            </div>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-body">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Users className="h-[18px] w-[18px]" strokeWidth={2} />Nominees &amp; Attendance
            </h2>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-outline btn-sm" onClick={handleCopyAllLinks}>
                <ClipboardCheck className="h-4 w-4" strokeWidth={2} />Copy All Links
              </button>
              <button className="btn btn-outline btn-sm" onClick={handleExportLinksCsv}>
                <Download className="h-4 w-4" strokeWidth={2} />Export CSV
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setNomineeModalOpen(true)}>
                <UserPlus className="h-4 w-4" strokeWidth={2} />Add Nominee
              </button>
            </div>
          </div>
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="table-clean">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Emp No.</th>
                  <th>Department</th>
                  <th>Division</th>
                  <th>Section</th>
                  <th>Station/Region</th>
                  <th>Attendance</th>
                  <th>Self-Confirmed</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {nominees.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No nominees added yet.
                    </td>
                  </tr>
                )}
                {nominees.map((n) => (
                  <tr key={n.id}>
                    <td className="font-medium text-slate-900">{n.name}</td>
                    <td>{n.employee_number}</td>
                    <td>{n.department || '-'}</td>
                    <td>{n.division || '-'}</td>
                    <td>{n.section || '-'}</td>
                    <td>{n.station_region || '-'}</td>
                    <td>
                      <select
                        className="form-input min-w-[9rem] py-1.5 text-xs"
                        value={n.attendance_status}
                        onChange={(e) => handleAttendanceChange(n.id, e.target.value)}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Attended">Attended</option>
                        <option value="Did Not Attend">Did Not Attend</option>
                      </select>
                    </td>
                    <td>
                      {n.employee_confirmed ? (
                        <span className="badge badge-green">Confirmed</span>
                      ) : n.email ? (
                        <button className="btn btn-outline-primary btn-sm" onClick={() => handleCopyLink(n.confirmation_token)}>
                          <Link2 className="h-4 w-4" strokeWidth={2} />Copy Link
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">No email</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        className="btn btn-outline-danger btn-icon"
                        title="Remove"
                        onClick={() => handleDeleteNominee(n.id)}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
            <Paperclip className="h-[18px] w-[18px]" strokeWidth={2} />Evidence &amp; Supporting Documents
          </h2>
          <div className="mb-4 flex max-w-lg gap-2">
            <input
              type="file"
              className="form-input file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
              multiple
              onChange={(e) => setUploadFiles(e.target.files)}
            />
            <button className="btn btn-primary shrink-0" onClick={handleUpload}>
              <Upload className="h-4 w-4" strokeWidth={2} />Upload
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {evidence.length === 0 && <li className="py-3 text-sm text-slate-400">No evidence uploaded yet.</li>}
            {evidence.map((ev) => (
              <li key={ev.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <FileText className="h-4 w-4 text-slate-400" strokeWidth={2} />
                  {ev.original_name}
                  <span className="text-xs text-slate-400">{(ev.size / 1024).toFixed(1)} KB</span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <a className="btn btn-outline btn-icon" href={api.evidenceDownloadUrl(id, ev.id)}>
                    <Download className="h-4 w-4" strokeWidth={2} />
                  </a>
                  <button className="btn btn-outline-danger btn-icon" onClick={() => handleDeleteEvidence(ev.id)}>
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <TrainingFormModal show={editOpen} training={training} onClose={() => setEditOpen(false)} onSave={handleSaveTraining} />
      <NomineeFormModal show={nomineeModalOpen} onClose={() => setNomineeModalOpen(false)} onSave={handleAddNominee} />
    </>
  );
}