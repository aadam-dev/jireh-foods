'use client';

import { useEffect, useState } from 'react';
import {
  Save, Building2, Phone, MapPin, DollarSign, Receipt,
  Package, AlertCircle, CheckCircle2, Tag, Loader2, Info, FlaskConical,
  SlidersHorizontal,
} from 'lucide-react';
import { Card } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { formatCurrency } from '@/src/lib/utils';
import { DEVELOPER_CREDIT } from '@/src/lib/developer-credit';

interface SettingsMap {
  business_name: string;
  business_phone: string;
  business_address: string;
  currency_symbol: string;
  gra_tin: string;
  tax_rate: string;
  receipt_header: string;
  receipt_footer: string;
  low_stock_alert_threshold: string;
  inventory_tracking: string; // 'true' | 'false'
  pos_modifiers_enabled: string; // 'true' | 'false'
}

const DEFAULTS: SettingsMap = {
  business_name: 'Jireh Natural Foods',
  business_phone: '055 113 3481',
  business_address: 'Adenta Housing Down, Accra',
  currency_symbol: 'GH₵',
  gra_tin: '',
  tax_rate: '0',
  receipt_header: 'Fresh & Healthy — Always',
  receipt_footer: 'Thank you for dining with us!',
  low_stock_alert_threshold: '5',
  inventory_tracking: 'false',
  pos_modifiers_enabled: 'false',
};

type SectionKey = 'business' | 'tax' | 'receipt' | 'alerts' | 'inventory' | 'register';

export default function SettingsPage() {
  const [values, setValues]     = useState<SettingsMap>(DEFAULTS);
  const [original, setOriginal] = useState<SettingsMap>(DEFAULTS);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<SectionKey | null>(null);
  const [saved, setSaved]       = useState<SectionKey | null>(null);
  const [error, setError]       = useState<string | null>(null);

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

  const set = (key: keyof SettingsMap) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues(v => ({ ...v, [key]: e.target.value }));

  const setToggle = (key: keyof SettingsMap, on: boolean) =>
    setValues(v => ({ ...v, [key]: on ? 'true' : 'false' }));

  const sectionDirty = (keys: (keyof SettingsMap)[]) => keys.some(k => values[k] !== original[k]);

  const saveSection = async (section: SectionKey, keys: (keyof SettingsMap)[]) => {
    setSaving(section);
    setError(null);
    try {
      const changed = keys.filter(k => values[k] !== original[k]);
      await Promise.all(
        changed.map(key =>
          fetch('/api/admin/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value: values[key] }),
          }).then(async r => {
            if (!r.ok) {
              const e = await r.json();
              throw new Error(e.error ?? 'Failed to save');
            }
          })
        )
      );
      setOriginal(prev => ({ ...prev, ...Object.fromEntries(keys.map(k => [k, values[k]])) }));
      setSaved(section);
      setTimeout(() => setSaved(null), 2500);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save — please try again');
    } finally {
      setSaving(null);
    }
  };

  const SectionSaveBtn = ({ section, keys }: { section: SectionKey; keys: (keyof SettingsMap)[] }) => (
    <Button
      size="sm"
      variant={saved === section ? 'success' : 'primary'}
      loading={saving === section}
      disabled={!sectionDirty(keys) || loading}
      onClick={() => saveSection(section, keys)}
      icon={saved === section ? <CheckCircle2 size={13} /> : <Save size={13} />}
    >
      {saved === section ? 'Saved!' : 'Save changes'}
    </Button>
  );

  const taxRate = parseFloat(values.tax_rate) || 0;
  const exampleOrderTotal = 80;
  const exampleTax = exampleOrderTotal * taxRate;
  const trackingOn = values.inventory_tracking === 'true';
  const modifiersOn = values.pos_modifiers_enabled === 'true';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 size={22} className="animate-spin text-[#349f2d]" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#f4efeb] font-serif">Settings</h1>
        <p className="text-sm text-[#aba8a4] mt-0.5">System-wide configuration · Owner only</p>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Business', value: values.business_name, icon: <Building2 size={13}/> },
          { label: 'Currency', value: values.currency_symbol, icon: <Tag size={13}/> },
          { label: 'VAT', value: taxRate > 0 ? `${(taxRate * 100).toFixed(1)}%` : 'Off', icon: <DollarSign size={13}/>, warn: taxRate > 0 },
          { label: 'Low-stock at', value: `≤ ${values.low_stock_alert_threshold} units`, icon: <Package size={13}/> },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border px-4 py-3 ${s.warn ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-[#191c19] border-[#2b2f2b]'}`}>
            <div className={`flex items-center gap-1.5 mb-1 ${s.warn ? 'text-yellow-400' : 'text-[#aba8a4]'}`}>
              {s.icon}
              <span className="text-[10px] uppercase tracking-wide">{s.label}</span>
            </div>
            <p className={`text-sm font-semibold truncate ${s.warn ? 'text-yellow-300' : 'text-[#f4efeb]'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* ── Business Info ── */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-[#5ecf4f]" />
            <h2 className="text-sm font-semibold text-[#f4efeb]">Business Info</h2>
          </div>
          <SectionSaveBtn section="business" keys={['business_name','business_phone','business_address','currency_symbol']} />
        </div>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Business Name"
              value={values.business_name}
              onChange={set('business_name')}
              disabled={loading}
            />
            <Input
              label="Currency Symbol"
              value={values.currency_symbol}
              onChange={set('currency_symbol')}
              disabled={loading}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Phone Number"
                value={values.business_phone}
                onChange={set('business_phone')}
                placeholder="055 113 3481"
                disabled={loading}
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                <Phone size={10} className="text-[#aba8a4]" />
                <p className="text-[10px] text-[#aba8a4]">Printed on receipts</p>
              </div>
            </div>
            <div>
              <Input
                label="Address"
                value={values.business_address}
                onChange={set('business_address')}
                placeholder="Adenta Housing Down, Accra"
                disabled={loading}
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                <MapPin size={10} className="text-[#aba8a4]" />
                <p className="text-[10px] text-[#aba8a4]">Shown on reports and invoices</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Tax & GRA ── */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <DollarSign size={15} className="text-[#5ecf4f]" />
            <h2 className="text-sm font-semibold text-[#f4efeb]">Tax & GRA</h2>
          </div>
          <SectionSaveBtn section="tax" keys={['tax_rate','gra_tin']} />
        </div>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="VAT / Composite Levy Rate"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={values.tax_rate}
                onChange={set('tax_rate')}
                disabled={loading}
              />
              <p className="text-[10px] text-[#aba8a4] mt-1.5 ml-0.5">Decimal: 0 = off · 0.15 = 15% Ghana composite levy</p>
            </div>
            <div>
              <Input
                label="GRA TIN"
                value={values.gra_tin}
                onChange={set('gra_tin')}
                placeholder="C000000000"
                disabled={loading}
              />
              <p className="text-[10px] text-[#aba8a4] mt-1.5 ml-0.5">Printed on receipts once registered with GRA</p>
            </div>
          </div>

          {/* Tax preview */}
          {taxRate > 0 ? (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs text-yellow-300 font-medium">
                    VAT is active at {(taxRate * 100).toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-yellow-400/80">
                    Example: GH₵{exampleOrderTotal} order → +{formatCurrency(exampleTax)} tax = <strong>{formatCurrency(exampleOrderTotal + exampleTax)}</strong> charged
                  </p>
                  <p className="text-[11px] text-yellow-400/80">Ensure GRA TIN is set and registration is complete before going live.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 bg-[#111311] border border-[#2b2f2b] rounded-xl px-4 py-3">
              <Info size={13} className="text-[#aba8a4] shrink-0" />
              <p className="text-[11px] text-[#aba8a4]">Tax is off. Set a rate above 0 when you register with GRA.</p>
            </div>
          )}
        </div>
      </Card>

      {/* ── Receipts ── */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Receipt size={15} className="text-[#5ecf4f]" />
            <h2 className="text-sm font-semibold text-[#f4efeb]">Receipt</h2>
          </div>
          <SectionSaveBtn section="receipt" keys={['receipt_header','receipt_footer']} />
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Input
                label="Tagline (under business name)"
                value={values.receipt_header}
                onChange={set('receipt_header')}
                placeholder="Fresh & Healthy — Always"
                disabled={loading}
              />
              <p className="text-[10px] text-[#aba8a4] mt-1.5 ml-0.5">Printed under the business name at the top</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#aba8a4] mb-1.5">Footer Message</label>
              <textarea
                className="w-full bg-[#0a0b0a] border border-[#2b2f2b] rounded-xl px-3 py-2.5 text-sm text-[#f4efeb] placeholder:text-[#404540] resize-none focus:outline-none focus:ring-1 focus:ring-[#349f2d]/50 focus:border-[#349f2d]/60 transition-colors"
                rows={3}
                value={values.receipt_footer}
                onChange={set('receipt_footer')}
                placeholder="Thank you for dining with us!"
                disabled={loading}
              />
              <p className="text-[10px] text-[#aba8a4] mt-1 ml-0.5">Printed at the bottom of every receipt</p>
            </div>
          </div>

          {/* Live receipt preview */}
          <div>
            <p className="text-[10px] text-[#aba8a4] uppercase tracking-wide mb-2">Receipt Preview</p>
            <div className="bg-white text-black rounded-xl p-4 font-mono text-[10px] leading-tight shadow-inner">
              {/* Brand header */}
              <div className="text-center border-b border-dashed border-gray-300 pb-2 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/jireh/logo.jpg" alt="logo" className="w-10 h-10 object-contain rounded-full mx-auto mb-1" style={{ filter: 'grayscale(100%) contrast(1.4)' }} />
                <p className="font-bold text-[12px]">{values.business_name.toUpperCase()}</p>
                <p className="text-gray-500">{values.receipt_header}</p>
                <p className="text-gray-500">{values.business_address}</p>
                <p className="text-gray-500">Tel: {values.business_phone}</p>
                {values.gra_tin && <p className="text-gray-500">TIN: {values.gra_tin}</p>}
              </div>
              {/* Big call number */}
              <div className="text-center mb-2">
                <p className="text-[8px] uppercase tracking-widest text-gray-500">Order No.</p>
                <p className="font-bold text-[22px] leading-none">1234</p>
              </div>
              <div className="space-y-0.5 border-b border-dashed border-gray-300 pb-2 mb-2">
                <div className="flex justify-between"><span>1× Jollof Rice Med</span><span>GH₵55</span></div>
                <div className="flex justify-between"><span>2× Sobolo</span><span>GH₵20</span></div>
                <div className="text-[8px] text-gray-500 pl-3">@ GH₵10 each</div>
              </div>
              <div className="space-y-0.5 border-b border-dashed border-gray-300 pb-2 mb-2">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>GH₵75</span></div>
                {taxRate > 0 && <div className="flex justify-between text-gray-600"><span>Tax</span><span>{formatCurrency(75 * taxRate)}</span></div>}
                <div className="flex justify-between font-bold"><span>TOTAL</span><span>{taxRate > 0 ? formatCurrency(75 * (1 + taxRate)) : 'GH₵75'}</span></div>
                <div className="flex justify-between text-gray-600"><span>Paid · Cash</span><span>{taxRate > 0 ? formatCurrency(75 * (1 + taxRate)) : 'GH₵75'}</span></div>
                <div className="flex justify-between text-gray-600"><span>Tendered</span><span>GH₵100</span></div>
                <div className="flex justify-between font-semibold"><span>Change</span><span>{taxRate > 0 ? formatCurrency(100 - 75 * (1 + taxRate)) : 'GH₵25'}</span></div>
              </div>
              <div className="text-center text-gray-500 pt-1">
                {values.receipt_footer.split('\n').map((line, i) => <p key={i}>{line}</p>)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Register behaviour ── */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-[#5ecf4f]" />
            <h2 className="text-sm font-semibold text-[#f4efeb]">Register</h2>
          </div>
          <SectionSaveBtn section="register" keys={['pos_modifiers_enabled']} />
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[#2b2f2b] bg-[#111311] px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#f4efeb]">Ask for options when adding a dish</p>
              <p className="text-[11px] text-[#aba8a4] mt-0.5">
                When on, tapping a dish that has choices (protein, spice level, extras) opens the options sheet before it joins the ticket.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={modifiersOn}
              aria-label="Toggle the options sheet on the register"
              onClick={() => setToggle('pos_modifiers_enabled', !modifiersOn)}
              className={`relative shrink-0 w-12 h-7 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#349f2d]/60 ${modifiersOn ? 'bg-[#349f2d]' : 'bg-[#2b2f2b]'}`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${modifiersOn ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border ${modifiersOn ? 'bg-[#349f2d]/5 border-[#349f2d]/20' : 'bg-[#111311] border-[#2b2f2b]'}`}>
            <Info size={13} className={`shrink-0 mt-0.5 ${modifiersOn ? 'text-[#5ecf4f]' : 'text-[#aba8a4]'}`} />
            {modifiersOn ? (
              <p className="text-[11px] text-[#5ecf4f]/90 leading-relaxed">
                <strong>Options sheet is on.</strong> Every dish with choices costs the cashier one extra tap. Worth it once special requests are common — turn it back off during a rush.
              </p>
            ) : (
              <p className="text-[11px] text-[#aba8a4] leading-relaxed">
                <strong className="text-[#f4efeb]">Quick sale is on.</strong> A tap puts the dish straight on the ticket — this is the default. Dishes with a required choice still carry their default answer to the kitchen, and a one-off request goes on the line note (pencil icon in the cart). Cashiers pick up the change within a minute; no need to sign out.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ── Inventory Tracking ── */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FlaskConical size={15} className="text-[#5ecf4f]" />
            <h2 className="text-sm font-semibold text-[#f4efeb]">Inventory Tracking</h2>
          </div>
          <SectionSaveBtn section="inventory" keys={['inventory_tracking']} />
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[#2b2f2b] bg-[#111311] px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#f4efeb]">Deduct ingredient stock on each sale</p>
              <p className="text-[11px] text-[#aba8a4] mt-0.5">
                When on, completing a POS order subtracts recipe (BOM) ingredients from Inventory.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={trackingOn}
              aria-label="Toggle inventory tracking"
              onClick={() => setToggle('inventory_tracking', !trackingOn)}
              className={`relative shrink-0 w-12 h-7 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#349f2d]/60 ${trackingOn ? 'bg-[#349f2d]' : 'bg-[#2b2f2b]'}`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${trackingOn ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border ${trackingOn ? 'bg-[#349f2d]/5 border-[#349f2d]/20' : 'bg-[#111311] border-[#2b2f2b]'}`}>
            <Info size={13} className={`shrink-0 mt-0.5 ${trackingOn ? 'text-[#5ecf4f]' : 'text-[#aba8a4]'}`} />
            {trackingOn ? (
              <p className="text-[11px] text-[#5ecf4f]/90 leading-relaxed">
                <strong>Tracking is on.</strong> Make sure each menu item has a recipe (BOM) and stock counts are current. A sale never blocks on low stock — negative quantities are allowed and flagged red as “Oversold” in Inventory.
              </p>
            ) : (
              <p className="text-[11px] text-[#aba8a4] leading-relaxed">
                <strong className="text-[#f4efeb]">Tracking is off.</strong> Sales are recorded normally but no ingredients are deducted. Turn this on once recipes and stock counts are set up — this is the default for now.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ── Alerts & Thresholds ── */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Package size={15} className="text-[#5ecf4f]" />
            <h2 className="text-sm font-semibold text-[#f4efeb]">Inventory Alerts</h2>
          </div>
          <SectionSaveBtn section="alerts" keys={['low_stock_alert_threshold']} />
        </div>
        <div className="max-w-xs">
          <Input
            label="Low Stock Alert Threshold"
            type="number"
            min="1"
            step="1"
            value={values.low_stock_alert_threshold}
            onChange={set('low_stock_alert_threshold')}
            disabled={loading}
          />
          <p className="text-[10px] text-[#aba8a4] mt-1.5 ml-0.5">
            Items at or below this quantity show the red badge in the sidebar and are highlighted in Inventory
          </p>
        </div>
      </Card>

      {/* ── About ── */}
      <Card padding="md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#349f2d]/15 border border-[#349f2d]/30 flex items-center justify-center shrink-0">
            <span className="text-xl">🌿</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#f4efeb]">Jireh Natural Foods — Back Office</p>
            <p className="text-xs text-[#aba8a4]">POS · Admin · Inventory · Payroll · Reports</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-mono text-[#aba8a4]">v1.1.0</p>
            <a href={DEVELOPER_CREDIT.url} target="_blank" rel="noreferrer"
              className="text-[10px] text-[#349f2d] hover:text-[#5ecf4f] transition-colors">
              Built by {DEVELOPER_CREDIT.domain}
            </a>
            <a href={`tel:${DEVELOPER_CREDIT.phoneE164}`}
              className="block text-[10px] text-[#aba8a4] hover:text-[#f4efeb] transition-colors">
              {DEVELOPER_CREDIT.phoneDisplay}
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
