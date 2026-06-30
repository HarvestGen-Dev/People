import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Workflow, 
  Database, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  BookOpen
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/20">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-bold text-xl tracking-tight text-foreground font-[Helvetica,Arial,sans-serif]">Harvest Generation</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="#coming-soon" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Coming Soon</Link>
            <Link href="/guide" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Guide</Link>
          </nav>
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

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32 md:pt-32 md:pb-40">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
          
          <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 border border-primary/20">
              <Sparkles className="h-4 w-4" />
              <span>The all-new People CRM is here</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6 leading-tight">
              A smarter way to manage your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">church community</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              People is a modern, blazing-fast, and beautiful CRM built to handle your congregation's data, interactions, and events effortlessly.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2">
                  Get Started for Free <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/guide">
                <Button variant="outline" className="h-12 px-8 rounded-xl border-border bg-card hover:bg-muted/50 font-semibold text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-muted-foreground" /> Read the Guide
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-card border-y border-border">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">Everything you need to grow</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Purpose-built features designed to keep your focus on people, not administrative tasks.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  icon: Users,
                  title: "Member Directory",
                  description: "Centralized, searchable, and secure database of all members and visitors."
                },
                {
                  icon: Workflow,
                  title: "Smart Workflows",
                  description: "Automate follow-ups, integrate with your POS and LMS seamlessly."
                },
                {
                  icon: ShieldCheck,
                  title: "Multi-Tenant Isolation",
                  description: "Enterprise-grade Row-Level Security ensuring absolute data privacy per church."
                }
              ].map((feature, i) => (
                <div key={i} className="bg-background border border-border p-8 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Coming Soon Section */}
        <section id="coming-soon" className="py-24 relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto bg-card border border-border p-10 md:p-14 rounded-3xl shadow-sm text-center">
              <div className="inline-flex items-center justify-center p-3 bg-muted rounded-xl mb-6">
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">Coming Soon</h2>
              <p className="text-lg text-muted-foreground mb-8">
                We're constantly evolving. Here's a sneak peek at what's landing in the next few weeks.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-4 text-left">
                {[
                  "Custom Dynamic Fields",
                  "Advanced Event Check-ins",
                  "Automated Email Campaigns",
                  "Drip & Brew POS Integration"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-background">
                    <div className="h-2 w-2 rounded-full bg-primary"></div>
                    <span className="font-medium text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <span className="font-bold text-foreground font-[Helvetica,Arial,sans-serif]">Harvest Generation</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Harvest Generation Church. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
