// <!-- AGENT: FRONTEND -->
export function TopLoadingBar() {
  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-emerald-950/10"
      role="progressbar"
      aria-label="Page loading"
      aria-valuetext="Loading"
    >
      <div className="hg-top-loading-bar h-full rounded-r-full bg-emerald-600 shadow-[0_0_18px_rgba(5,150,105,0.55)]" />
    </div>
  );
}
