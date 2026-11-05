import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function CreateWorkflowDialog({
  isOpen,
  setIsOpen,
  formData,
  setFormData,
  isSaving,
  onSave,
}: {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  formData: { name: string; description: string };
  setFormData: (val: { name: string; description: string }) => void;
  isSaving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="people-workspace rounded-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            Create a workflow
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div>
            <label htmlFor="workflow-name" className="mb-2 block text-sm font-semibold">
              Workflow name
            </label>
            <Input
              id="workflow-name"
              value={formData.name}
              onChange={(event) =>
                setFormData({ ...formData, name: event.target.value })
              }
              placeholder="e.g. New Visitor Journey"
              className="h-11 rounded-xl"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="workflow-description" className="mb-2 block text-sm font-semibold">
              Description
            </label>
            <Textarea
              id="workflow-description"
              value={formData.description}
              onChange={(event) =>
                setFormData({ ...formData, description: event.target.value })
              }
              placeholder="What outcome should this workflow help your team achieve?"
              className="min-h-28 rounded-xl"
            />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="h-11 rounded-xl px-5 font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!formData.name.trim() || isSaving}
            className="h-11 rounded-xl px-6 font-semibold"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
