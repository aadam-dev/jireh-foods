/* Customer identity checks — run with: npm test
 *
 * Every failure here shows up as a duplicate in the cashier's suggestion list,
 * which is how name capture dies: the list fills with four spellings of the
 * same person and staff stop using it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanName, nameKey, normalisePhone, isUsablePhone, customerLabel, WALK_IN_LABEL,
} from './customer';

test('cleanName tidies what a touchscreen produces', () => {
  assert.equal(cleanName('  Kwame  '), 'Kwame');
  assert.equal(cleanName('Kwame   Mensah'), 'Kwame Mensah');
  assert.equal(cleanName('Ama​Asante'), 'AmaAsante'); // zero-width stripped
  assert.equal(cleanName(''), '');
  assert.equal(cleanName(null), '');
  assert.equal(cleanName(undefined), '');
});

test('the same person typed three ways shares one key', () => {
  const keys = new Set([nameKey('Kwame'), nameKey('kwame '), nameKey('KWAME')]);
  assert.equal(keys.size, 1);
  assert.equal([...keys][0], 'kwame');
});

test('different people keep different keys', () => {
  assert.notEqual(nameKey('Kwame Mensah'), nameKey('Kwame Owusu'));
});

test('Ghanaian mobiles normalise to one national form', () => {
  const forms = ['024 123 4567', '0241234567', '+233 24 123 4567', '233241234567'];
  const normalised = new Set(forms.map(normalisePhone));
  assert.equal(normalised.size, 1, `got ${[...normalised].join(' / ')}`);
  assert.equal([...normalised][0], '0241234567');
});

test('a short or empty phone is not a usable key', () => {
  // Half a number typed and abandoned must not claim the unique phone slot.
  assert.equal(isUsablePhone('0241'), false);
  assert.equal(isUsablePhone(''), false);
  assert.equal(isUsablePhone(null), false);
  assert.equal(isUsablePhone('0241234567'), true);
});

test('an order with no name reads as a walk-in, and never stores one', () => {
  assert.equal(customerLabel({ customerName: null }), WALK_IN_LABEL);
  assert.equal(customerLabel({ customerName: '   ' }), WALK_IN_LABEL);
  assert.equal(customerLabel({}), WALK_IN_LABEL);
  assert.equal(customerLabel({ customerName: 'Kwame' }), 'Kwame');
  // The label is display-only — it must never become a stored name.
  assert.equal(nameKey(WALK_IN_LABEL), 'walk-in');
  assert.notEqual(customerLabel({ customerName: null }), cleanName(null));
});
