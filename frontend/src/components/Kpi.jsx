import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Counts up from 0 to `value` when it mounts or changes, formatting each frame with `format`
// (whole numbers by default). Shows the final value straight away for prefers-reduced-motion.
export function AnimatedValue({ value, format = Math.round, duration = 700 }) {
  const [display, setDisplay] = useState(prefersReducedMotion ? value : 0);
  const startRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }
    startRef.current = null;
    let frame;
    const step = (timestamp) => {
      if (startRef.current === null) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(eased * value);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{format(display)}</>;
}

// Loading placeholder for a KPI card. 'lg' matches the Dashboard cards, 'md' the Reports cards.
export function KpiSkeleton({ size = 'md' }) {
  const large = size === 'lg';
  return (
    <div className="card animate-pulse">
      <div className="card-body flex items-center justify-between gap-3">
        <div className="w-full">
          <div className="mb-2 h-3 w-20 rounded bg-zinc-200" />
          <div className={`${large ? 'h-8 w-12' : 'h-6 w-14'} rounded bg-zinc-200`} />
        </div>
        <div className={`${large ? 'h-10 w-10' : 'h-9 w-9'} shrink-0 rounded-lg bg-zinc-200`} />
      </div>
    </div>
  );
}
