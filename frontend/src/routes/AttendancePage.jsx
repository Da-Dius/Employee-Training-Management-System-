import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Printer, CheckCheck } from 'lucide-react';
import * as api from '../api/client';
import { formatDateRange, nominationBadgeClass } from '../utils';
import { useToast } from '../context/ToastContext';
import Spinner from '../components/Spinner';

export default function AttendancePage() {
    const { id } = useParams();
    const { showToast } = useToast();
    const [training, setTraining] = useState(null);
    const [nominees, setNominees] = useState(null);
    const [error, setError] = useState('');

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

    useEffect(() => {
        loadTraining();
        loadNominees();
    }, [loadTraining, loadNominees]);

    const handleAttendanceChange = async (nomineeId, status) => {
        try {
            await api.setAttendance(id, nomineeId, status);
            loadNominees();
        } catch (e) {
            showToast(e.message, 'danger');
        }
    };

    const handleMarkAllAttended = async () => {
        if (!nominees) return;

        const markable = nominees.filter((n) => n.nomination_status !== 'Declined');
        const targets = markable.filter((n) => !n.attendance_self_reported);
        const kept = markable.length - targets.length;

        if (!targets.length) return;

        if (!window.confirm(
            `Mark ${targets.length} nominee(s) as Attended?` +
            (kept ? ` ${kept} who answered the email themselves will be left as they are.` : '') +
            ' This overwrites any existing marks.'
        )) return;

        try {
            await Promise.all(targets.map((n) => api.setAttendance(id, n.id, 'Attended')));
            showToast('Nominees marked Attended');
            loadNominees();
        } catch (e) {
            showToast(e.message, 'danger');
        }
    };

    if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

    if (!training || nominees === null) {
        return (
            <div className="flex justify-center py-16">
                <Spinner />
            </div>
        );
    }

    const declinedCount = nominees.filter((n) => n.nomination_status === 'Declined').length;
    const visible = nominees.filter((n) => n.nomination_status !== 'Declined');

    const counts = visible.reduce(
        (acc, n) => {
            if (n.attendance_status === 'Attended') acc.attended += 1;
            else if (n.attendance_status === 'Did Not Attend') acc.absent += 1;
            else acc.pending += 1;
            return acc;
        },
        { attended: 0, absent: 0, pending: 0 }
    );

    return (
        <>
            <div className="mb-4 print:hidden">
                <Link
                    to={`/trainings/${id}`}
                    className="inline-flex items-center gap-1 text-sm text-zinc-600 transition-colors hover:text-zinc-900"
                >
                    <ArrowLeft className="h-4 w-4" strokeWidth={2} />Back to Training
                </Link>
            </div>

            <div className="card mb-6">
                <div className="card-body">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-zinc-900">
                                <ClipboardCheck className="h-5 w-5 text-brand" strokeWidth={2} />
                                Attendance Register
                            </h1>
                            <div className="text-sm text-zinc-500">
                                {training.name} &middot; {formatDateRange(training.training_date, training.training_end_date)}
                                {training.venue ? ` \u00b7 ${training.venue}` : ''}
                            </div>
                        </div>
                        <div className="flex gap-2 print:hidden">
                            <button className="btn btn-outline btn-sm" onClick={handleMarkAllAttended}>
                                <CheckCheck className="h-4 w-4" strokeWidth={2} />Mark All Attended
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
                                <Printer className="h-4 w-4" strokeWidth={2} />Print Register
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 print:hidden">
                        <span className="badge badge-green">Attended: {counts.attended}</span>
                        <span className="badge badge-red">Did Not Attend: {counts.absent}</span>
                        <span className="badge badge-slate">Pending: {counts.pending}</span>
                        {declinedCount > 0 && (
                            <span className="badge badge-amber">{declinedCount} declined (excluded)</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table-clean">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Emp No.</th>
                                <th>Department</th>
                                <th>Station/Region</th>
                                <th>Nomination</th>
                                <th>Attendance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-zinc-400">
                                        No nominees on this training yet.
                                    </td>
                                </tr>
                            )}
                            {visible.map((n) => (
                                <tr key={n.id}>
                                    <td className="font-medium text-zinc-900">{n.name}</td>
                                    <td>{n.employee_number}</td>
                                    <td>{n.department || '-'}</td>
                                    <td>{n.station_region || '-'}</td>
                                    <td>
                                        <span className={nominationBadgeClass(n.nomination_status)}>
                                            {n.nomination_status}
                                        </span>
                                    </td>
                                    <td className="print:hidden">
                                        <select
                                            className="form-input min-w-[9rem] py-1.5 text-xs"
                                            value={n.attendance_status}
                                            onChange={(e) => handleAttendanceChange(n.id, e.target.value)}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Attended">Attended</option>
                                            <option value="Did Not Attend">Did Not Attend</option>
                                        </select>
                                        {n.attendance_self_reported && (
                                            <span className="mt-1 block text-[11px] text-zinc-400">
                                                self-reported {n.attendance_status === 'Attended' ? 'attended' : 'absent'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="hidden print:table-cell">{n.attendance_status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}