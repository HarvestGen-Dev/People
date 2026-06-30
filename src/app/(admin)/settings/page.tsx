import { Topbar } from '@/components/layout/Topbar';

export default function SettingsPage() {
  return (
    <>
      <Topbar title="General Settings" />
      <div className="p-8 max-w-4xl animate-in fade-in-50 duration-300">
        <div className="bg-white border border-border p-6 rounded-2xl shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Church details</h3>
          <p className="text-slate-500 mb-6">Manage your church's general information here.</p>
          <div className="text-sm text-slate-400 italic">
            This page is a placeholder for future general settings. Please use the navigation menu on the left to access Tags, Custom Fields, and API Keys.
          </div>
        </div>
      </div>
    </>
  );
}
