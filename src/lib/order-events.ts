import { OrderEventType, Prisma } from '@prisma/client';

export type TransactionSnapshot = {
  orderNumber: string;
  clientRef: string | null;
  capturedAt: string;
  staff: { id: string; name: string } | null;
  sessionId: string | null;
  items: Array<{
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
    notes?: string | null;
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentRef: string | null;
  splitPayments: unknown;
  tenderedAmount: number | null;
  changeAmount: number | null;
  deliveryType: string;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
};

export function buildTransactionSnapshot(input: {
  orderNumber: string;
  clientRef?: string | null;
  staff?: { id: string; name: string } | null;
  sessionId?: string | null;
  items: Array<{
    menuItemId: string;
    name: string;
    price: number | Prisma.Decimal;
    quantity: number;
    subtotal?: number | Prisma.Decimal;
    notes?: string | null;
  }>;
  subtotal: number | Prisma.Decimal;
  discountAmount: number | Prisma.Decimal;
  taxAmount: number | Prisma.Decimal;
  total: number | Prisma.Decimal;
  paymentMethod: string;
  paymentStatus: string;
  paymentRef?: string | null;
  splitPayments?: unknown;
  tenderedAmount?: number | Prisma.Decimal | null;
  changeAmount?: number | Prisma.Decimal | null;
  deliveryType: string;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
}): TransactionSnapshot {
  return {
    orderNumber: input.orderNumber,
    clientRef: input.clientRef ?? null,
    capturedAt: new Date().toISOString(),
    staff: input.staff ?? null,
    sessionId: input.sessionId ?? null,
    items: input.items.map(item => ({
      menuItemId: item.menuItemId,
      name: item.name,
      price: Number(item.price),
      quantity: item.quantity,
      subtotal: Number(item.subtotal ?? Number(item.price) * item.quantity),
      notes: item.notes ?? null,
    })),
    subtotal: Number(input.subtotal),
    discountAmount: Number(input.discountAmount),
    taxAmount: Number(input.taxAmount),
    total: Number(input.total),
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
    paymentRef: input.paymentRef ?? null,
    splitPayments: input.splitPayments ?? null,
    tenderedAmount: input.tenderedAmount != null ? Number(input.tenderedAmount) : null,
    changeAmount: input.changeAmount != null ? Number(input.changeAmount) : null,
    deliveryType: input.deliveryType,
    customerName: input.customerName ?? null,
    customerPhone: input.customerPhone ?? null,
    notes: input.notes ?? null,
  };
}

export async function recordOrderEvent(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    type: OrderEventType;
    actorUserId?: string | null;
    reason?: string | null;
    payload?: Record<string, unknown> | null;
  }
) {
  return tx.orderEvent.create({
    data: {
      orderId: input.orderId,
      type: input.type,
      actorUserId: input.actorUserId ?? null,
      reason: input.reason ?? null,
      payload: input.payload ? (input.payload as Prisma.InputJsonValue) : undefined,
    },
  });
}

export const VOID_REASON_LABELS: Record<string, string> = {
  CUSTOMER_CANCELLED: 'Customer cancelled',
  NO_SHOW: 'Customer no-show',
  WRONG_ORDER: 'Wrong order',
  DUPLICATE: 'Duplicate order',
  QUALITY_ISSUE: 'Quality issue',
  OTHER: 'Other',
};

export const VOID_INVENTORY_LABELS: Record<string, string> = {
  RESTOCK: 'Restock ingredients',
  WASTE: 'Record as waste (food already prepared)',
  NONE: 'No inventory change',
};

export const ORDER_EVENT_LABELS: Record<OrderEventType, string> = {
  CREATED: 'Order created',
  STATUS_CHANGED: 'Status changed',
  VOIDED: 'Order voided',
  NOTE_ADDED: 'Note added',
  PAYMENT_UPDATED: 'Payment updated',
};
