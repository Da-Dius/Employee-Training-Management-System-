import { X } from 'lucide-react';

export default function Modal({ show, title, onClose, children, footer, size }) {
  if (!show) return null;

  const widthClass = size === 'lg' ? 'max-w-3xl' : 'max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/60 p-4 sm:items-center backdrop-blur-sm">
      <div className={`card w-full overflow-hidden ${widthClass}`}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h5 className="text-base font-semibold text-zinc-900">{title}</h5>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-zinc-100 bg-zinc-50/50 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}