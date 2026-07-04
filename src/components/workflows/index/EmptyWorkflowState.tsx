import { GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyWorkflowState({
  canManage,
  onOpenDialog,
}: {
  canManage: boolean;
  onOpenDialog: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-20 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
        <GitBranch className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-slate-950">
        Create your first workflow
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Start with a simple visitor journey, pastoral follow-up, or ministry
        onboarding pipeline.
      </p>
      {canManage && (
        <Button
          onClick={onOpenDialog}
          className="mt-6 rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
        >
          Create workflow
        </Button>
      )}
    </div>
  );
}
