/* Modifier default checks — run with: npm run test:modifiers
 *
 * These guard the difference between the two ways a dish reaches a ticket.
 * With the options sheet off, nobody sees what was chosen before the ticket
 * prints — so a wrong default here is a wrong plate handed to a customer, with
 * no screen in between where anyone could have caught it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultModifiers, defaultOptionByGroup, type ModifierGroup } from './modifiers';

const protein: ModifierGroup = {
  id: 'g-protein',
  name: 'Protein',
  selection: 'SINGLE',
  isRequired: true,
  options: [
    { id: 'o-grilled', name: 'Grilled', priceDelta: 0 },
    { id: 'o-fried', name: 'Fried', priceDelta: 0 },
  ],
};

const spice: ModifierGroup = {
  id: 'g-spice',
  name: 'Spice level',
  selection: 'SINGLE',
  isRequired: false,
  options: [{ id: 'o-mild', name: 'Mild', priceDelta: 0 }],
};

const extras: ModifierGroup = {
  id: 'g-extras',
  name: 'Extras',
  selection: 'MULTI',
  isRequired: true,
  options: [{ id: 'o-shito', name: 'Extra shito', priceDelta: 5 }],
};

test('a dish with no choices adds nothing', () => {
  assert.deepEqual(defaultModifiers({}), []);
  assert.deepEqual(defaultModifiers({ modifierGroups: [] }), []);
});

test('a required single-choice group answers itself with its first option', () => {
  assert.deepEqual(defaultModifiers({ modifierGroups: [protein] }), [
    { optionId: 'o-grilled', groupName: 'Protein', name: 'Grilled', priceDelta: 0 },
  ]);
});

test('optional groups stay unanswered', () => {
  assert.deepEqual(defaultModifiers({ modifierGroups: [spice] }), []);
});

test('a required MULTI group never ticks a paid extra on the customer’s behalf', () => {
  // Charging GH₵5 of shito on every sale because a group was marked required
  // is money taken that nobody asked for.
  assert.deepEqual(defaultModifiers({ modifierGroups: [extras] }), []);
});

test('a required group with no available options is skipped, not crashed on', () => {
  const empty: ModifierGroup = { ...protein, options: [] };
  assert.deepEqual(defaultModifiers({ modifierGroups: [empty] }), []);
});

test('defaults follow menu order across several groups', () => {
  const second: ModifierGroup = {
    id: 'g-side',
    name: 'Side',
    selection: 'SINGLE',
    isRequired: true,
    options: [{ id: 'o-salad', name: 'Salad', priceDelta: 2 }],
  };
  assert.deepEqual(
    defaultModifiers({ modifierGroups: [protein, spice, second] }).map(m => m.optionId),
    ['o-grilled', 'o-salad'],
  );
});

test('groups sharing a name stay distinct — keyed by id, not name', () => {
  const twin: ModifierGroup = { ...protein, id: 'g-protein-2', options: [{ id: 'o-goat', name: 'Goat', priceDelta: 3 }] };
  const byGroup = defaultOptionByGroup({ modifierGroups: [protein, twin] });
  assert.equal(byGroup['g-protein'].id, 'o-grilled');
  assert.equal(byGroup['g-protein-2'].id, 'o-goat');
});

test('the sheet seed and the quick-tap list describe the same choices', () => {
  // The sheet builds its initial selection from defaultOptionByGroup and the
  // quick path from defaultModifiers. If these ever disagree, the same dish
  // reaches the kitchen differently depending on a Settings toggle.
  const item = { modifierGroups: [protein, spice, extras] };
  const fromSheet = Object.values(defaultOptionByGroup(item)).map(o => o.id).sort();
  const fromQuickTap = defaultModifiers(item).map(m => m.optionId).sort();
  assert.deepEqual(fromQuickTap, fromSheet);
});
