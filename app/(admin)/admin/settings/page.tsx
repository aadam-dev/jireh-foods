'use client';

import { useEffect, useState } from 'react';
import { Save, Settings2, Receipt, DollarSign, Building2, AlertCircle, Leaf, Package } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';

interface SettingsMap {
  business_name: string;
  currency_symbol: string;
  gra_tin: string;
  tax_rate: string;
  receipt_footer: string;
  low_stock_alert_threshold: string;
}

const DEFAULTS: SettingsMap = {
  business_name: 'Jireh Natural Foods',
  currency_symbol: 'GH₵',
  gra_tin: '',
  tax_rate: '0',
  receipt_footer: 'Thank you for dining with us!',
  low_stock_alert_threshold: '5',
};

export default function SettingsPage() {
  const [values, setValues] = useState<SettingsMap>(DEFAULTS);
  const [original, setOriginal] = useState<SettingsMap>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(data => {
        const merged = { ...DEFAULTS, ...data };
        setValues(merged);
        setOriginal(merged);
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const saveSetting = async (key: keyof SettingsMap) => {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: values[key] }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? 'Failed to save');
        return;
      }
      setOriginal(prev => ({ ...prev, [key]: values[key] }));
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(null);
    }
  };

  const field = (key: keyof SettingsMap, label: string, hint: string, type = 'text') => (
    <div key={key}>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label={label}
            type={type}
            step={type === 'number' ? '0.01' : undefined}
            value={values[key]}
            onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
            disabled={loading}
          />
        </div>
        <Button
          size="sm"
          variant={saved === key ? 'success' : 'primary'}
          loading={saving === key}
          disabled={values[key] === original[key] || loading}
          onClick={() => saveSetting(key)}
          icon={<Save size={12} />}
        >
          {saved === key ? 'Saved!' : 'Save'}
        </Button>
      </div>
      <p className="text-[10px] text-[#aba8a4] mt-1.5 ml-0.5">{hint}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#349f2d] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Settings</h1>
        <p className="text-sm text-[#aba8a4] mt-0.5">System-wide configuration — Owner only</p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Business */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 size={15} className="text-[#5ecf4f]" /> Business Info
          </CardTitle>
        </CardHeader>
        <div className="space-y-5">
          {field('business_name', 'Business Name', 'Appears on receipts and reports')}
          {field('currency_symbol', 'Currency Symbol', 'Displayed next to amounts throughout the system')}
        </div>
      </Card>

      {/* Tax / GRA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign size={15} className="text-[#5ecf4f]" /> Tax & GRA
          </CardTitle>
        </CardHeader>
        <div className="space-y-5">
          {field('tax_rate', 'VAT / Composite Levy Rate', 'Enter as decimal: 0 = no tax · 0.15 = 15% Ghana composite levy. Set to 0 until GRA registered.', 'number')}
          {field('gra_tin', 'GRA TIN', 'Tax Identification Number — printed on receipts once registered')}

          {parseFloat(values.tax_rate) > 0 && (
            <div className="flex items-start gap-2.5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
              <AlertCircle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-300 leading-relaxed">
                Tax is <strong>active</strong> at {(parseFloat(values.tax_rate) * 100).toFixed(1)}%.
                Ensure your GRA TIN is entered and you're registered before enabling this in production.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Receipts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt size={15} className="text-[#5ecf4f]" /> Receipts
          </CardTitle>
        </CardHeader>
        <div className="space-y-5">
          {field('receipt_footer', 'Receipt Footer Message', 'Printed at the bottom of every customer receipt')}
        </div>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package size={15} className="text-[#5ecf4f]" /> Alerts & Thresholds
          </CardTitle>
        </CardHeader>
        <div className="space-y-5">
          {field('low_stock_alert_threshold', 'Low Stock Alert Threshold', 'Items at or below this quantity trigger the sidebar badge and are highlighted in Inventory', 'number')}
        </div>
      </Card>

      {/* System info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 size={15} className="text-[#5ecf4f]" /> About
          </CardTitle>
        </CardHeader>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#349f2d]/20 border border-[#349f2d]/40 flex items-center justify-center">
            <Leaf className="text-[#5ecf4f]" size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f4efeb]">Jireh Natural Foods — Back Office</p>
            <p className="text-xs text-[#aba8a4]">POS · Admin · Inventory · Payroll · Reports</p>
            <p className="text-xs text-[#aba8a4] mt-0.5">Version 1.1.0 · Built {new Date().getFullYear()}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
