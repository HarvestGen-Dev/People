export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-emerald-950 text-white shadow-sm">
        <span className="absolute h-7 w-3 rotate-45 rounded-full bg-emerald-400/70" />
        <span className="relative text-xs font-bold tracking-tight">HG</span>
      </div>
      <div className="leading-none">
        <div className="text-[11px] font-semibold uppercase tracking-[0.19em] text-emerald-700">
          HarvestGen
        </div>
        <div className="mt-1 text-base font-bold tracking-tight text-slate-950">
          People
        </div>
      </div>
    </div>
  );
}
