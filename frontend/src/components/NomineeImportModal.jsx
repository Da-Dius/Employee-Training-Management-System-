import { useEffect, useRef, useState } from 'react';
import { FileUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import * as api from '../api/client';

export default function NomineeImportModal({ show, trainingId, onClose, onImported }) {
    const [file, setFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (show) {
            setFile(null);
            setError('');
            setResult(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [show]);

    if (!show) return null;

    const handleImport = async () => {
        if (!file) {
            setError('Choose a .xlsx file first.');
            return;
        }
        setImporting(true);
        setError('');
        try {
            const data = await api.importNominees(trainingId, file);
            setResult(data);
            if (data.imported.length > 0) onImported();
        } catch (err) {
            setError(err.message);
        } finally {
            setImporting(false);
        }
    };

    return (
        <Modal
            show={show}
            onClose={onClose}
            title="Import Nominees"
            footer={
                result ? (
                    <button type="button" className="btn btn-primary" onClick={onClose}>
                        Done
                    </button>
                ) : (
                    <>
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={importing}>
                            Cancel
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleImport} disabled={importing || !file}>
                            {importing ? 'Importing...' : 'Import'}
                        </button>
                    </>
                )
            }
        >
            {!result && (
                <div className="space-y-4">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600">
                        Upload a <span className="font-medium">.xlsx</span> file with one{' '}
                        <span className="font-medium">Employee Number</span> per row in the first column. A header row is
                        optional. Every other field (name, department, division, section, station, email) is pulled
                        automatically from the employee directory — matching numbers not found there will be skipped.
                    </div>
                    <div>
                        <label className="form-label">File</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx"
                            className="form-input file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                    </div>
                    {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                </div>
            )}

            {result && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
                        {result.imported.length} nominee{result.imported.length === 1 ? '' : 's'} imported.
                    </div>

                    {result.skipped.length > 0 && (
                        <div>
                            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
                                <AlertTriangle className="h-4 w-4 text-amber-500" strokeWidth={2} />
                                {result.skipped.length} skipped
                            </div>
                            <div className="max-h-52 overflow-y-auto rounded-lg border border-zinc-200">
                                <table className="table-clean">
                                    <thead>
                                        <tr>
                                            <th>Employee Number</th>
                                            <th>Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.skipped.map((s, i) => (
                                            <tr key={i}>
                                                <td className="font-mono text-xs">{s.employee_number}</td>
                                                <td className="text-xs text-zinc-500">{s.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}