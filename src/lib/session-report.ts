/* Session / shift report helpers — one shape for screen and 80mm print.
   ────────────────────────────────────────────────────────────────────────────
   Cashier keep-a-copy for reconciliation. Same idea as PrimeTijara's
   "Print current sales": totals by tender, every sale with its lines, and
   how many of each dish left the kitchen. Pure so the maths is testable
   without spinning up the register. */

export type SessionReportLine = {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  modifiers?: { name: string }[];
};

export type SessionReportSale = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  paymentMethod: string;
  splitPayments?: { method: string; amount: number }[] | null;
  total: number;
  createdAt: string;
  lines: SessionReportLine[];
};

export type SessionProductSold = {
  name: string;
  qtySold: number;
};

/** Staff-facing tender label for a sale (including SPLIT). */
export function paymentLabelForSale(order: {
  paymentMethod?: string | null;
  splitPayments?: { method: string; amount: number }[] | null;
}): string {
  const method = (order.paymentMethod ?? '').toUpperCase();
  if (method === 'SPLIT' && Array.isArray(order.splitPayments) && order.splitPayments.length) {
    const parts = order.splitPayments
      .filter(p => Number(p.amount) > 0)
      .map(p => tenderWord(p.method));
    return parts.length ? `Split (${parts.join('+')})` : 'Split';
  }
  return tenderWord(method) || 'Paid';
}

function tenderWord(method: string): string {
  const m = (method ?? '').toUpperCase();
  if (m === 'CASH') return 'Cash';
  if (m === 'MOMO') return 'MoMo';
  if (m === 'BOLT_FOOD') return 'Bolt';
  if (m === 'CARD') return 'Card';
  if (m === 'BANK_TRANSFER') return 'Bank';
  if (m === 'UNPAID') return 'Unpaid';
  return m ? m.charAt(0) + m.slice(1).toLowerCase() : '';
}

/** Completed, paid session sales only — open tickets do not belong on a till copy. */
export function sessionSalesForReport(orders: any[]): SessionReportSale[] {
  return (orders ?? [])
    .filter(o => {
      if (!o) return false;
      if (o.status === 'CANCELLED' || o.status === 'VOIDED') return false;
      if (o.paymentMethod === 'UNPAID' || o.paymentStatus === 'PENDING') return false;
      return o.status === 'COMPLETED' || o.paymentStatus === 'PAID';
    })
    .map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName ?? null,
      paymentMethod: o.paymentMethod,
      splitPayments: Array.isArray(o.splitPayments) ? o.splitPayments : null,
      total: Number(o.total) || 0,
      createdAt: o.createdAt,
      lines: (o.items ?? []).map((it: any) => ({
        name: it.name,
        quantity: Number(it.quantity) || 0,
        price: Number(it.price) || 0,
        subtotal: Number(it.subtotal) || Number(it.price) * Number(it.quantity) || 0,
        modifiers: Array.isArray(it.modifiers)
          ? it.modifiers.map((m: any) => ({ name: m.name }))
          : [],
      })),
    }));
}

/** Qty of each dish sold this shift — kitchen / stock glance for the copy. */
export function aggregateItemsSold(sales: SessionReportSale[]): SessionProductSold[] {
  const byName = new Map<string, number>();
  for (const sale of sales) {
    for (const line of sale.lines) {
      const key = line.name.replace(/\s+/g, ' ').trim();
      if (!key) continue;
      byName.set(key, (byName.get(key) ?? 0) + line.quantity);
    }
  }
  return [...byName.entries()]
    .map(([name, qtySold]) => ({ name, qtySold }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
