import { createServiceClient } from '@/lib/supabase/server';

/**
 * Triggers workflow automations when tags are assigned to a person.
 * Evaluates the tags, finds any with a `target_workflow_id`, and drops the person
 * into the first step of those workflows (if they aren't already in them).
 */
export async function triggerWorkflowsForTags(
  churchId: string,
  personId: string,
  newTagIds: string[]
): Promise<void> {
  if (!newTagIds || newTagIds.length === 0) return;

  const supabase = createServiceClient();

  // 1. Fetch tags that have a target_workflow_id
  const { data: tags } = await supabase
    .from('tags')
    .select('id, name, target_workflow_id')
    .eq('church_id', churchId)
    .in('id', newTagIds)
    .not('target_workflow_id', 'is', null);

  if (!tags || tags.length === 0) return;

  // 2. For each workflow, check if person is already in it, then add them
  for (const tag of tags) {
    if (!tag.target_workflow_id) continue;

    // Check if they are already in the workflow
    const { count: existingCardCount } = await supabase
      .from('workflow_cards')
      .select('*', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('workflow_id', tag.target_workflow_id)
      .eq('person_id', personId);

    if (existingCardCount === 0) {
      // Fetch first step
      const { data: steps } = await supabase
        .from('workflow_steps')
        .select('id, default_days_to_complete')
        .eq('church_id', churchId)
        .eq('workflow_id', tag.target_workflow_id)
        .order('order_index', { ascending: true })
        .limit(1);

      if (steps && steps.length > 0) {
        const firstStep = steps[0];
        
        let dueDate = null;
        if (firstStep.default_days_to_complete) {
          const d = new Date();
          d.setDate(d.getDate() + firstStep.default_days_to_complete);
          dueDate = d.toISOString().split('T')[0];
        }

        await supabase.from('workflow_cards').insert({
          church_id: churchId,
          workflow_id: tag.target_workflow_id,
          current_step_id: firstStep.id,
          person_id: personId,
          due_date: dueDate,
          notes: `Added automatically via tag: ${tag.name}`,
        });
      }
    }
  }
}
