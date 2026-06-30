import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { evaluateSmartList } from '@/lib/lists/evaluate';
import { format } from 'date-fns';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });

    const churchSlug = user.user_metadata?.church_slug || 'harvestgen';
    const { data: church } = await supabase.from('churches').select('id').eq('slug', churchSlug).single();
    if (!church) return new Response('Church not found', { status: 404 });

    const { id } = await params;

    const { data: list } = await supabase
      .from('lists')
      .select('*')
      .eq('id', id)
      .eq('church_id', church.id)
      .single();

    if (!list) return new Response('List not found', { status: 404 });

    let people: any[] = [];
    
    if (list.type === 'smart') {
      const evalResult = await evaluateSmartList(list.filters, church.id);
      people = evalResult.people;
    } else {
      const { data: listMembers } = await supabase
        .from('list_people')
        .select('people(id, first_name, last_name, email, phone, status, campus)')
        .eq('list_id', id);
      people = (listMembers || []).map(lm => lm.people).filter(Boolean);
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
        `"${(p.tags || []).map((t: any) => t.name || t).join(', ')}"`
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

  } catch (error: any) {
    return new Response(error.message, { status: 500 });
  }
}
