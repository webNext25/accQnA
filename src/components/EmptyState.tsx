type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center shadow-sm shadow-slate-950/[0.02]">
      <div className="mx-auto mb-4 h-10 w-10 rounded-full border border-slate-200 bg-slate-50" />
      <h2 className="text-xl font-black leading-tight text-slate-950 [overflow-wrap:anywhere]">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 [overflow-wrap:anywhere]">
        {message}
      </p>
    </section>
  );
}
