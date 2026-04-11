'use client';

import { useEffect, useState } from 'react';
import { Save, Leaf } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';

interface Setting { key: string; value: string }

const SETTING_LABELS: Record<string, string> = {
  restaurant_name: 'Restaurant Name',
  restaurant_phone: 'Phone Number',
  restaurant_email: 'Email Address',
  restaurant_address: 'Address',
  currency: 'Currency Symbol',
  opening_time: 'Opening Time',
  closing_time: 'Closing Time',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load from API (we'll use a simple endpoint or local defaults)
    setSettings({
      restaurant_name: 'Jireh Natural Foods',
      restaurant_phone: '055 113 3481',
      restaurant_email: 'jirehnaturalfoodsgh@gmail.com',
      restaurant_address: 'Adenta Housing Down, Accra, Ghana',
      currency: 'GH₵',
      opening_time: '11:00',
      closing_time: '20:00',
    });
    setLoading(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    // In production this would call /api/admin/settings
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Settings</h1>
          <p className="text-sm text-[#aba8a4]">Business configuration</p>
        </div>
        <Button onClick={handleSave} loading={saving} icon={<Save size={14} />}>
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Business Info</CardTitle></CardHeader>
        <div className="space-y-4">
          {Object.entries(SETTING_LABELS).map(([key, label]) => (
            <Input
              key={key}
              label={label}
              value={settings[key] ?? ''}
              type={key.includes('time') ? 'time' : key === 'restaurant_email' ? 'email' : 'text'}
              onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>About This System</CardTitle></CardHeader>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#349f2d]/20 border border-[#349f2d]/40 flex items-center justify-center">
            <Leaf className="text-[#5ecf4f]" size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f4efeb]">Jireh Natural Foods — Back Office</p>
            <p className="text-xs text-[#aba8a4]">POS · Admin · Inventory · Payroll · Reports</p>
            <p className="text-xs text-[#aba8a4] mt-0.5">Version 1.0.0 · Built {new Date().getFullYear()}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
