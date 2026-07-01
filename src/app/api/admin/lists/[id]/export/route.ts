import { createServiceClient } from '@/lib/supabase/server';
import { evaluateSmartList } from '@/lib/lists/evaluate';
import { format } from 'date-fns';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

type ExportTag = { name?: string } | string;

type ExportPerson = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  campus?: string | null;
  tags?: ExportTag[];
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext();
    const supabase = createServiceClient();

    const { id } = await params;

    const { data: list } = await supabase
      .from('lists')
      .select('*')
      .eq('id', id)
      .eq('church_id', churchId)
      .single();

    if (!list) return new Response('List not found', { status: 404 });

    let people: ExportPerson[] = [];
    
    if (list.type === 'smart') {
      const evalResult = await evaluateSmartList(list.filters, churchId);
      people = evalResult.people;
    } else {
      const { data: listMembers } = await supabase
        .from('list_people')
        .select('people(id, first_name, last_name, email, phone, status, campus)')
        .eq('list_id', id)
        .eq('church_id', churchId);
      const relatedPeople = (listMembers || []).flatMap((listMember) => {
        if (Array.isArray(listMember.people)) return listMember.people;
        return listMember.people ? [listMember.people] : [];
      });
      people = relatedPeople as ExportPerson[];
    }

    // Generate CSV
    const headers = ['id', 'first_name', 'last_name', 'email', 'phone', 'status', 'campus', 'tags'];
    const rows = people.map(p => {
      return [
        p.id,
        `"${(p.first_name || '').replace(/"/g, '""')}"`,
        `"${(p.last_name || '').replace(/"/g, '""')}"`,
        p.email || '',
        p.phone || '',
        p.status || '',
        `"${(p.campus || '').replace(/"/g, '""')}"`,
        // We might not have tags fully populated in this minimal export, but we map if available
        `"${(p.tags || []).map((tag) => typeof tag === 'string' ? tag : tag.name || '').join(', ')}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const filename = `${list.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error: unknown) {
    return adminApiError(error);
  }
}
