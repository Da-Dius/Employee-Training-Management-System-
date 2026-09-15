export default function Spinner({ small }) {
  const size = small ? 'h-4 w-4 border-2' : 'h-8 w-8 border-2';
  return <div className={`${size} animate-spin rounded-full border-zinc-200 border-t-brand`}></div>;
}
