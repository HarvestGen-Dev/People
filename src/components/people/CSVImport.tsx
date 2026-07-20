'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  bulkCreatePeople,
  type BulkPersonInput,
} from '@/app/(admin)/people/new/bulk-actions';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { UploadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startNavigationProgress } from '@/lib/navigation-progress';

export function CSVImport() {
  const [isImporting, setIsImporting] = useState(false);
  const router = useRouter();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse<BulkPersonInput>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const { data } = results;
        if (!data || data.length === 0) {
          toast.error('The CSV file appears to be empty.');
          setIsImporting(false);
          return;
        }

        const res = await bulkCreatePeople(data);
        if (res?.error) {
          toast.error(res.error);
        } else if (res?.success) {
          toast.success(`Successfully imported ${res.count} people!`);
          startNavigationProgress();
          router.push('/people');
        }
        setIsImporting(false);
      },
      error: (error) => {
        toast.error('Error parsing CSV: ' + error.message);
        setIsImporting(false);
      }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors">
      <UploadCloud className="w-12 h-12 text-slate-400 mb-4" />
      <h3 className="text-lg font-medium text-slate-900 mb-1">Import from CSV</h3>
      <p className="text-sm text-slate-500 mb-6 text-center max-w-sm">
        Upload a CSV containing <code>first_name</code> and <code>last_name</code>.
        Profiles with an email can claim portal access after verification. Set{' '}
        <code>allow_self_claim=false</code> to require administrator approval.
      </p>
      
      <div className="relative">
        <input 
          type="file" 
          accept=".csv"
          onChange={handleFileUpload}
          disabled={isImporting}
          placeholder="Select CSV File"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <Button className="bg-teal-600 hover:bg-teal-700 pointer-events-none" disabled={isImporting}>
          {isImporting ? 'Processing...' : 'Select CSV File'}
        </Button>
      </div>
    </div>
  );
}
