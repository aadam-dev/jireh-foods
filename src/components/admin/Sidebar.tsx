'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Package,
  Receipt, Users, DollarSign, BarChart3, Settings,
  Monitor, LogOut, Leaf, ChevronRight, X, FlaskConical,
  Truck, ShoppingCart,
} from 'lucide-react';
import { UserRole } from '@prisma/client';

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
      { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={17} />, roles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
      { href: '/admin/orders', label: 'Orders', icon: <ShoppingBag size={17} />, roles: ['OWNER', 'MANAGER', 'CASHIER', 'ACCOUNTANT'] },
      { href: '/admin/menu', label: 'Menu', icon: <UtensilsCrossed size={17} />, roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    label: 'Stock & Supply',
    items: [
      { href: '/admin/inventory', label: 'Inventory', icon: <Package size={17} />, roles: ['OWNER', 'MANAGER'] },
      { href: '/admin/boms', label: 'Recipes (BOMs)', icon: <FlaskConical size={17} />, roles: ['OWNER', 'MANAGER'] },
      { href: '/admin/suppliers', label: 'Suppliers', icon: <Truck size={17} />, roles: ['OWNER', 'MANAGER'] },
      { href: '/admin/purchasing', label: 'Purchasing', icon: <ShoppingCart size={17} />, roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/expenses', label: 'Expenses', icon: <Receipt size={17} />, roles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
      { href: '/admin/staff', label: 'Staff', icon: <Users size={17} />, roles: ['OWNER', 'MANAGER'] },
      { href: '/admin/payroll', label: 'Payroll', icon: <DollarSign size={17} />, roles: ['OWNER', 'ACCOUNTANT'] },
      { href: '/admin/reports', label: 'Reports', icon: <BarChart3 size={17} />, roles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
      { href: '/admin/settings', label: 'Settings', icon: <Settings size={17} />, roles: ['OWNER'] },
    ],
  },
];

interface SidebarProps {
  user: { name: string; email: string; role: UserRole };
  onClose?: () => void;
  mobile?: boolean;
}

export function Sidebar({ user, onClose, mobile = false }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <aside className={[
      'flex flex-col bg-[#0a0b0a] border-r border-[#2b2f2b] h-full',
      mobile ? 'w-72' : 'w-64',
    ].join(' ')}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-[#2b2f2b] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#349f2d]/20 border border-[#349f2d]/40 flex items-center justify-center">
            <Leaf size={16} className="text-[#5ecf4f]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#f4efeb] leading-tight">Jireh</p>
            <p className="text-[10px] text-[#aba8a4] leading-tight">Natural Foods</p>
          </div>
        </div>
        {mobile && (
          <button onClick={onClose} className="text-[#aba8a4] hover:text-[#f4efeb] p-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* POS shortcut */}
      <div className="px-3 py-3 border-b border-[#2b2f2b] shrink-0">
        <Link
          href="/pos"
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#349f2d]/10 hover:bg-[#349f2d]/20 border border-[#349f2d]/30 transition-all group"
        >
          <Monitor size={15} className="text-[#5ecf4f]" />
          <span className="text-sm font-medium text-[#5ecf4f]">Open POS Register</span>
          <ChevronRight size={13} className="text-[#5ecf4f] ml-auto opacity-60 group-hover:opacity-100" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => item.roles.includes(user.role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold text-[#aba8a4]/50 uppercase tracking-widest">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                      isActive(item.href)
                        ? 'bg-[#349f2d]/20 text-[#5ecf4f] border border-[#349f2d]/40'
                        : 'text-[#aba8a4] hover:text-[#f4efeb] hover:bg-white/5 border border-transparent',
                    ].join(' ')}
                  >
                    <span className={isActive(item.href) ? 'text-[#5ecf4f]' : 'text-[#aba8a4]'}>
                      {item.icon}
                    </span>
                    {item.label}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="ml-auto bg-[#349f2d] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-[#2b2f2b] shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-[#349f2d]/20 border border-[#349f2d]/40 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-[#5ecf4f]">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#f4efeb] truncate">{user.name}</p>
            <p className="text-[10px] text-[#aba8a4] truncate">{user.role}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-[#aba8a4] hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
