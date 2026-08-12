import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  paymentLabelForSale,
  sessionSalesForReport,
  aggregateItemsSold,
} from './session-report';

test('payment labels cover cash, momo, bolt and split', () => {
  assert.equal(paymentLabelForSale({ paymentMethod: 'CASH' }), 'Cash');
  assert.equal(paymentLabelForSale({ paymentMethod: 'MOMO' }), 'MoMo');
  assert.equal(paymentLabelForSale({ paymentMethod: 'BOLT_FOOD' }), 'Bolt');
  assert.equal(
    paymentLabelForSale({
      paymentMethod: 'SPLIT',
      splitPayments: [
        { method: 'CASH', amount: 20 },
        { method: 'MOMO', amount: 30 },
      ],
    }),
    'Split (Cash+MoMo)',
  );
});

test('session report drops unpaid and cancelled tickets', () => {
  const sales = sessionSalesForReport([
    {
      id: '1', orderNumber: 'A', status: 'COMPLETED', paymentStatus: 'PAID',
      paymentMethod: 'CASH', total: 40, customerName: 'Ama', createdAt: '2026-08-12',
      items: [{ name: 'Jollof', quantity: 1, price: 40, subtotal: 40 }],
    },
    {
      id: '2', orderNumber: 'B', status: 'PREPARING', paymentStatus: 'PENDING',
      paymentMethod: 'UNPAID', total: 40, createdAt: '2026-08-12', items: [],
    },
    {
      id: '3', orderNumber: 'C', status: 'CANCELLED', paymentStatus: 'PAID',
      paymentMethod: 'CASH', total: 10, createdAt: '2026-08-12', items: [],
    },
  ]);
  assert.equal(sales.length, 1);
  assert.equal(sales[0].orderNumber, 'A');
  assert.equal(sales[0].lines[0].name, 'Jollof');
});

test('items sold aggregates quantities across sales', () => {
  const sales = sessionSalesForReport([
    {
      id: '1', orderNumber: 'A', status: 'COMPLETED', paymentStatus: 'PAID',
      paymentMethod: 'CASH', total: 50, createdAt: '',
      items: [
        { name: 'Jollof Rice — Small', quantity: 2, price: 40, subtotal: 80 },
        { name: 'Sobolo', quantity: 1, price: 10, subtotal: 10 },
      ],
    },
    {
      id: '2', orderNumber: 'B', status: 'COMPLETED', paymentStatus: 'PAID',
      paymentMethod: 'MOMO', total: 40, createdAt: '',
      items: [{ name: 'Jollof Rice — Small', quantity: 1, price: 40, subtotal: 40 }],
    },
  ]);
  const items = aggregateItemsSold(sales);
  assert.deepEqual(items, [
    { name: 'Jollof Rice — Small', qtySold: 3 },
    { name: 'Sobolo', qtySold: 1 },
  ]);
});
