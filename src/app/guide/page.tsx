import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, UserPlus, Settings, LayoutList } from 'lucide-react';

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium text-sm">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-sm font-medium hover:bg-muted/50 rounded-lg">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          
          {/* Guide Header */}
          <div className="mb-16">
            <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-xl mb-6">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">How to Use People CRM</h1>
            <p className="text-xl text-muted-foreground">
              A quick and easy guide to getting started with managing your congregation.
            </p>
          </div>

          <div className="space-y-12">
            {/* Step 1 */}
            <section className="bg-card border border-border rounded-3xl p-8 md:p-10 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-muted text-foreground font-bold text-xl">
                  1
                </div>
                <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                  <UserPlus className="h-6 w-6 text-primary" /> Getting Started
                </h2>
              </div>
              <div className="prose prose-slate max-w-none text-muted-foreground">
                <p className="mb-4 text-lg">The first thing you'll need to do is create an account and sign in to access your dashboard.</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Click <strong>Get Started</strong> on the top right to create your administrative account.</li>
                  <li>Once logged in, you will be taken to the main <strong>People</strong> directory.</li>
                  <li>Here, you can see everyone associated with your church, including members and visitors.</li>
                </ul>
              </div>
            </section>

            {/* Step 2 */}
            <section className="bg-card border border-border rounded-3xl p-8 md:p-10 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-muted text-foreground font-bold text-xl">
                  2
                </div>
                <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                  <LayoutList className="h-6 w-6 text-primary" /> Managing People
                </h2>
              </div>
              <div className="prose prose-slate max-w-none text-muted-foreground">
                <p className="mb-4 text-lg">Adding and editing members is incredibly fast and intuitive.</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>To add a new person, click the <strong>Add Person</strong> button on the top right of the dashboard.</li>
                  <li>You can enter their basic information (Name, Email, Phone) as well as their <strong>Campus</strong> and <strong>Status</strong> (Active, Visitor, Inactive).</li>
                  <li>Clicking on any person in the table will open their detailed profile where you can view tags, notes, and connected household data.</li>
                </ul>
              </div>
            </section>

            {/* Step 3 */}
            <section className="bg-card border border-border rounded-3xl p-8 md:p-10 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-muted text-foreground font-bold text-xl">
                  3
                </div>
                <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                  <Settings className="h-6 w-6 text-primary" /> Multi-Tenant Configuration
                </h2>
              </div>
              <div className="prose prose-slate max-w-none text-muted-foreground">
                <p className="mb-4 text-lg">People CRM is built for absolute privacy across different organizations.</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>All your data is isolated using <strong>Row-Level Security</strong> (RLS) in Supabase.</li>
                  <li>This means your API keys and dashboard views are strictly bound to your specific church tenant.</li>
                  <li>In the future, you will be able to manage API keys for external applications (like POS systems) directly from the Settings panel.</li>
                </ul>
              </div>
            </section>

          </div>
          
          <div className="mt-16 text-center">
            <h3 className="text-2xl font-semibold text-foreground mb-6">Ready to jump in?</h3>
            <Link href="/signup">
              <Button className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg shadow-sm">
                Create your account
              </Button>
            </Link>
          </div>

        </div>
      </main>

      <footer className="border-t border-border bg-card py-8 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Harvest Generation Church. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
