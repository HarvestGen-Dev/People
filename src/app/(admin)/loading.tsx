// <!-- AGENT: FRONTEND -->
import { TopLoadingBar } from '@/components/layout/TopLoadingBar';
import { WorkspacePage } from '@/components/workspace/Workspace';

export default function AdminLoading() {
  return (
    <>
      <TopLoadingBar />
      <WorkspacePage>
        <div aria-hidden="true" className="space-y-6">
          <div className="space-y-3">
            <div className="h-3 w-24 rounded bg-border" />
            <div className="h-9 w-60 max-w-full rounded bg-border" />
            <div className="h-4 w-80 max-w-full rounded bg-muted" />
          </div>
          <div className="workspace-panel divide-y" >
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-3 px-5 py-4">
                <div className="size-9 rounded-full bg-muted" />
                <div className="h-4 w-36 max-w-full rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </WorkspacePage>
    </>
  );
}
