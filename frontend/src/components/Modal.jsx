import { X } from 'lucide-react';

export default function Modal({ show, title, onClose, children, footer, size }) {
  if (!show) return null;

  const widthClass = size === 'lg' ? 'max-w-3xl' : 'max-w-md';

  // The panel is a capped flex column and the body is the only scroll region, so the
  // title and the footer buttons stay put instead of scrolling off with a long form.
  // `min-h-0` on the body is load-bearing — without it a flex child refuses to shrink
  // below its content height and nothing scrolls at all.
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-900/50 p-4 sm:items-center">
      <div className={`flex max-h-[calc(100dvh-2rem)] w-full ${widthClass} flex-col overflow-hidden rounded-xl bg-white shadow-xl`}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
          <h5 className="text-base font-semibold text-slate-900">{title}</h5>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}