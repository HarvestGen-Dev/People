// <!-- AGENT: FRONTEND -->
export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] animate-pulse space-y-8 p-5 sm:p-8 lg:p-10">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded-full bg-slate-200" />
        <div className="h-10 w-64 max-w-full rounded-xl bg-slate-200" />
        <div className="h-4 w-full max-w-xl rounded-full bg-slate-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-28 rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
      <div className="h-80 rounded-3xl border border-slate-200 bg-white" />
    </div>
  );
}
