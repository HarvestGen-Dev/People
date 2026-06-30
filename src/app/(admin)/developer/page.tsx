import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Key, Plus, Terminal, Activity, ShieldCheck, Check } from 'lucide-react';
import { redirect } from 'next/navigation';

export default async function DeveloperPage() {
  const supabase = await createClient();
  
  // Get the current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get their church slug from metadata
  const churchSlug = user.user_metadata?.church_slug || 'harvestgen';

  // Look up the actual church_id
  const { data: church } = await supabase
    .from('churches')
    .select('id, name')
    .eq('slug', churchSlug)
    .single();

  let apiKeys: any[] = [];
  if (church) {
    // Fetch API keys for this church
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('church_id', church.id)
      .order('created_at', { ascending: false });
    if (data) apiKeys = data;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in-50 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Developer API</h1>
          <p className="text-muted-foreground mt-1">
            Manage your API keys and connect external systems like HG-PC, Drip & Brew, or LMS-HG.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-xl shadow-sm h-10 px-4">
          <Plus className="h-4 w-4" /> Generate New Key
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-border bg-card shadow-sm col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Key className="h-5 w-5 text-primary" /> Active API Keys
            </CardTitle>
            <CardDescription className="text-base">Keys are securely bound to {church?.name || 'your organization'}.</CardDescription>
          </CardHeader>
          <CardContent>
            {apiKeys.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl bg-background/50">
                <Terminal className="h-10 w-10 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-foreground font-medium text-lg">No API keys found</p>
                <p className="text-sm text-muted-foreground mt-1">Generate a key to connect your first integration.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-xl bg-background shadow-sm group hover:border-primary/30 transition-colors">
                    <div className="mb-4 sm:mb-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-lg">{key.name}</span>
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shadow-none border-transparent">
                          Active
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground font-mono">
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-md">
                          {key.key_prefix}••••••••••••••••
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3 w-3" /> Scopes: {key.scopes.join(', ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground mb-1">Last Used</div>
                      <div className="text-sm font-medium text-foreground">
                        {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl border-border bg-primary text-primary-foreground shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Integration Endpoints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm opacity-90">
              <div>
                <div className="font-semibold text-primary-foreground/80 mb-1">Lookup & Create Person</div>
                <code className="bg-black/20 px-2 py-1 rounded block truncate font-mono">POST /api/v1/people/lookup</code>
              </div>
              <div>
                <div className="font-semibold text-primary-foreground/80 mb-1">Push Timeline Event</div>
                <code className="bg-black/20 px-2 py-1 rounded block truncate font-mono">POST /api/v1/events</code>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-4 w-4 text-primary" /> Supported Systems
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center"><Check className="h-4 w-4 text-emerald-600" /></div>
                <div>
                  <div className="font-medium text-sm">HG-PC</div>
                  <div className="text-xs text-muted-foreground">Syncs Roles & Schedules</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center"><Check className="h-4 w-4 text-emerald-600" /></div>
                <div>
                  <div className="font-medium text-sm">Drip & Brew</div>
                  <div className="text-xs text-muted-foreground">Café POS & Orders</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center"><Check className="h-4 w-4 text-emerald-600" /></div>
                <div>
                  <div className="font-medium text-sm">LMS-HG</div>
                  <div className="text-xs text-muted-foreground">Course completions</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
