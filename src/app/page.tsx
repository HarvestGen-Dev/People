// <!-- AGENT: FRONTEND -->
import { Header } from '@/components/landing/Header';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { ProfileShowcaseSection } from '@/components/landing/ProfileShowcaseSection';
import { OperatingRhythmSection } from '@/components/landing/OperatingRhythmSection';
import { IntegrationsSection } from '@/components/landing/IntegrationsSection';
import { SecuritySection } from '@/components/landing/SecuritySection';
import { CtaSection } from '@/components/landing/CtaSection';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#fbfcf9] text-slate-950 selection:bg-emerald-200">
      <Header />
      <main>
        <HeroSection />
        <FeaturesSection />
        <ProfileShowcaseSection />
        <OperatingRhythmSection />
        <IntegrationsSection />
        <SecuritySection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
