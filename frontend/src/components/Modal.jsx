import { X } from 'lucide-react';

export default function Modal({ show, title, onClose, children, footer, size }) {
  if (!show) return null;

  const widthClass = size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center">
      {/* flex-col + max-h-[90vh] keeps header/footer fixed and scrolls only the body,
          instead of the whole page having to scroll to reach the bottom of a tall form. */}
      <div className={`flex max-h-[90vh] w-full ${widthClass} flex-col rounded-xl bg-white shadow-xl`}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h5 className="text-base font-semibold text-slate-900">{title}</h5>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-3.5">{footer}</div>
        )}
      </div>
    </div>
  );
}