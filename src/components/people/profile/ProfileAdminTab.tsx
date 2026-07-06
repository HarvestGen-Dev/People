import { format } from 'date-fns';
import type { PersonWithRelations } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';

export function ProfileAdminTab({
  person,
  handleDeletePerson,
  isDeleting,
  canManage,
}: {
  person: PersonWithRelations;
  handleDeletePerson: () => void;
  isDeleting: boolean;
  canManage: boolean;
}) {
  if (!canManage) return null;

  return (
    <TabsContent value="admin" className="animate-in fade-in-50 duration-300">
      <Card className="rounded-3xl border-red-200 bg-red-50/50 shadow-none">
        <CardHeader>
          <CardTitle className="text-red-700">Danger Zone</CardTitle>
          <CardDescription className="text-red-600/80">Advanced administrative actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-red-100 bg-white p-5 sm:flex-row sm:items-center">
            <div>
              <h4 className="font-semibold text-foreground">Delete this person</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Permanently remove {person.first_name} and all their associated data. This action cannot be undone.
              </p>
            </div>
            <Button variant="destructive" onClick={handleDeletePerson} disabled={isDeleting} className="rounded-xl shadow-sm">
              {isDeleting ? 'Deleting...' : 'Delete Person'}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-white p-4">
            <h4 className="mb-3 font-semibold text-foreground">System Identifiers</h4>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-muted-foreground">Person ID</span>
                <code className="rounded bg-slate-100 px-2 py-1 text-slate-700">{person.id}</code>
              </div>
              <div>
                <span className="mb-1 block text-muted-foreground">Created At</span>
                <div className="text-foreground">{format(new Date(person.created_at), 'PPpp')}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
