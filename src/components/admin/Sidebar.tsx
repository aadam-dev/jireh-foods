'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Package,
  Receipt, Users, DollarSign, BarChart3, Settings,
  Monitor, LogOut, X, FlaskConical,
  Truck, ShoppingCart, UserSearch, ChevronRight,
} from 'lucide-react';
import Image from 'next/image';
import { UserRole } from '@prisma/client';
import { ROLE_LABELS } from '@/src/lib/permissions';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Operations',
    items: [
      { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={16} />, roles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
      { href: '/admin/orders', label: 'Orders', icon: <ShoppingBag size={16} />, roles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
      { href: '/admin/menu', label: 'Menu', icon: <UtensilsCrossed size={16} />, roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    label: 'Stock & Supply',
    items: [
      { href: '/admin/inventory', label: 'Inventory', icon: <Package size={16} />, roles: ['OWNER', 'MANAGER'] },
      { href: '/admin/boms', label: 'Recipes / BOMs', icon: <FlaskConical size={16} />, roles: ['OWNER', 'MANAGER'] },
      { href: '/admin/suppliers', label: 'Suppliers', icon: <Truck size={16} />, roles: ['OWNER', 'MANAGER'] },
      { href: '/admin/purchasing', label: 'Purchasing', icon: <ShoppingCart size={16} />, roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/expenses', label: 'Expenses', icon: <Receipt size={16} />, roles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
      { href: '/admin/staff', label: 'Staff', icon: <Users size={16} />, roles: ['OWNER', 'MANAGER'] },
      { href: '/admin/payroll', label: 'Payroll', icon: <DollarSign size={16} />, roles: ['OWNER', 'ACCOUNTANT'] },
      { href: '/admin/reports', label: 'Reports', icon: <BarChart3 size={16} />, roles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/admin/customers', label: 'Customers', icon: <UserSearch size={16} />, roles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
      { href: '/admin/settings', label: 'Settings', icon: <Settings size={16} />, roles: ['OWNER'] },
    ],
  },
];

interface SidebarProps {
  user: { name: string; email: string; role: UserRole };
  lowStockCount?: number;
  onClose?: () => void;
  mobile?: boolean;
}

export function Sidebar({ user, lowStockCount = 0, onClose, mobile = false }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const roleLabel = user.email === 'it@jireh.com' ? 'IT Admin' : (ROLE_LABELS[user.role] ?? user.role);
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className={[
      'flex flex-col h-full',
      'bg-[var(--surface-dark)] border-r border-[var(--border)]',
      mobile ? 'w-72' : 'w-64',
    ].join(' ')}>

      {/* Brand header */}
      <div className="relative flex items-center justify-between px-5 py-5 border-b border-[var(--border)] shrink-0 overflow-hidden">
        {/* subtle green glow behind logo */}
        <div className="absolute -top-6 -left-6 w-24 h-24 bg-[var(--accent)]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-[var(--accent)]/30 bg-white flex-shrink-0 shadow-[0_0_12px_rgba(52,159,45,0.2)]">
            <Image src="/jireh/logo.jpg" alt="Jireh Natural Foods" width={36} height={36} className="object-contain w-full h-full" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--foreground)] leading-tight tracking-tight">Jireh Natural Foods</p>
            <p className="text-[10px] text-[var(--muted)] leading-tight mt-0.5 uppercase tracking-widest">Back Office</p>
          </div>
        </div>
        {mobile && (
          <button onClick={onClose} className="relative text-[var(--muted)] hover:text-[var(--foreground)] p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* POS shortcut */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <Link
          href="/pos"
          onClick={onClose}
          className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[var(--accent)]/10 hover:bg-[var(--accent)]/18 border border-[var(--accent)]/25 hover:border-[var(--accent)]/40 transition-all"
        >
          <Monitor size={14} className="text-[var(--accent-bright)] shrink-0" />
          <span className="text-sm font-semibold text-[var(--accent-bright)] flex-1">Open POS Register</span>
          <ChevronRight size={12} className="text-[var(--accent-bright)]/50 group-hover:text-[var(--accent-bright)] group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => item.roles.includes(user.role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[10px] font-bold text-[var(--muted)]/60 uppercase tracking-[0.14em]">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const badge = item.href === '/admin/inventory' ? lowStockCount : (item.badge ?? 0);
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={[
                        'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                        active
                          ? 'bg-[var(--accent)]/12 text-[var(--foreground)]'
                          : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/[0.04]',
                      ].join(' ')}
                    >
                      {/* left accent bar */}
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--accent)] rounded-r-full" />
                      )}
                      <span className={active ? 'text-[var(--accent-bright)]' : 'text-[var(--muted)]'}>
                        {item.icon}
                      </span>
                      <span className={active ? 'font-semibold' : ''}>{item.label}</span>
                      {badge > 0 && (
                        <span className={`ml-auto text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                          item.href === '/admin/inventory' ? 'bg-yellow-500' : 'bg-[var(--accent)]'
                        }`}>
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-[var(--border)] shrink-0 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-[var(--border)]">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-[var(--accent-bright)]">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate leading-tight">{user.name}</p>
            <p className="text-[10px] text-[var(--muted)] truncate leading-tight mt-0.5">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-[var(--muted)] hover:text-red-400 hover:bg-red-500/8 transition-all"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
