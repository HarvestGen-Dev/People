import { Search, UserRound } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ListPerson, WorkflowAdminUser } from '@/lib/types';
import type { CardFormData } from '@/hooks/useKanbanBoard';

export function KanbanDialogs({
  canManage,
  users,
  isAddStepOpen,
  setIsAddStepOpen,
  newStepName,
  setNewStepName,
  newStepDays,
  setNewStepDays,
  handleAddStep,
  isAddCardOpen,
  setIsAddCardOpen,
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  selectedPersonId,
  setSelectedPersonId,
  performSearch,
  cardFormData,
  setCardFormData,
  handleAddCard,
}: {
  canManage: boolean;
  users: WorkflowAdminUser[];
  isAddStepOpen: boolean;
  setIsAddStepOpen: (v: boolean) => void;
  newStepName: string;
  setNewStepName: (v: string) => void;
  newStepDays: string;
  setNewStepDays: (v: string) => void;
  handleAddStep: () => void;
  isAddCardOpen: boolean;
  setIsAddCardOpen: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchResults: ListPerson[];
  setSearchResults: (v: ListPerson[]) => void;
  selectedPersonId: string | null;
  setSelectedPersonId: (v: string | null) => void;
  performSearch: (q: string) => void;
  cardFormData: CardFormData;
  setCardFormData: (v: CardFormData) => void;
  handleAddCard: () => void;
}) {
  if (!canManage) return null;

  return (
    <>
      <Dialog open={isAddStepOpen} onOpenChange={setIsAddStepOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Add workflow step</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Step name
            </label>
            <Input
              value={newStepName}
              onChange={(event) => setNewStepName(event.target.value)}
              placeholder="e.g. Welcome message sent"
              className="h-11 rounded-xl"
              autoFocus
            />
            <label className="mb-2 mt-4 block text-sm font-semibold text-slate-700">
              Days to complete
            </label>
            <Input
              type="number"
              min="1"
              value={newStepDays}
              onChange={(event) => setNewStepDays(event.target.value)}
              placeholder="e.g. 3"
              className="h-11 rounded-xl"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              When a person enters this step, they will automatically be assigned this due date.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAddStepOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddStep}
              disabled={!newStepName.trim()}
              className="rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              Add step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Add person to workflow
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by name or email"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSelectedPersonId(null);
                  performSearch(event.target.value);
                }}
                className="h-11 rounded-xl pl-10"
              />
            </div>

            {searchResults.length > 0 && !selectedPersonId && (
              <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200">
                {searchResults.map((person) => (
                  <button
                    type="button"
                    key={person.id}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left last:border-0 hover:bg-emerald-50"
                    onClick={() => {
                      setSelectedPersonId(person.id);
                      setSearchQuery(`${person.first_name} ${person.last_name}`);
                      setSearchResults([]);
                    }}
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                      {person.first_name[0]}
                      {person.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">
                        {person.first_name} {person.last_name}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {person.email || 'No email address'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedPersonId && (
              <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <UserRound className="h-4 w-4" />
                    {searchQuery}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPersonId(null);
                      setSearchQuery('');
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Change
                  </button>
                </div>
                <Select
                  value={cardFormData.assigned_to}
                  onValueChange={(value) =>
                    setCardFormData({
                      ...cardFormData,
                      assigned_to: value || 'unassigned',
                    })
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl bg-white">
                    <SelectValue placeholder="Assign owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        Admin {user.user_id.slice(0, 6)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={cardFormData.due_date}
                  onChange={(event) =>
                    setCardFormData({
                      ...cardFormData,
                      due_date: event.target.value,
                    })
                  }
                  className="h-11 rounded-xl bg-white"
                />
                <Textarea
                  placeholder="Initial notes or next action"
                  value={cardFormData.notes}
                  onChange={(event) =>
                    setCardFormData({
                      ...cardFormData,
                      notes: event.target.value,
                    })
                  }
                  className="min-h-24 rounded-xl bg-white"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsAddCardOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCard}
              disabled={!selectedPersonId}
              className="rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              Add to workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
