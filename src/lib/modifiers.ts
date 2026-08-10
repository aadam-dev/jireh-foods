/* Modifier defaults — what a dish carries before the cashier touches anything.
 * ────────────────────────────────────────────────────────────────────────────
 * Two paths add a dish to a ticket: the options sheet, and quick-sale mode
 * (the sheet switched off in Settings) where a tap goes straight to the cart.
 * Both must agree, because the difference is what the kitchen gets told. If a
 * required "Protein: grilled or fried" group is answered by the sheet but not
 * by the quick tap, the kitchen receives a blank on half the tickets.
 *
 * So the seed lives here, once, and both paths read it.
 */

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  selection: 'SINGLE' | 'MULTI';
  isRequired: boolean;
  options: ModifierOption[];
}

/** A modifier choice as it sits on a cart line. */
export interface ChosenModifier {
  optionId: string;
  groupName: string;
  name: string;
  priceDelta: number;
}

/** Only the part of a menu item these functions care about. */
export interface ModifiableItem {
  modifierGroups?: ModifierGroup[];
}

/**
 * group.id → the option pre-selected for it.
 *
 * Only required single-choice groups get a default. An optional group means
 * "ask if you like" and a MULTI group means extras, and neither should have
 * anything ticked on the cashier's behalf — quietly adding a paid extra to
 * every sale is worse than asking.
 */
export function defaultOptionByGroup(item: ModifiableItem): Record<string, ModifierOption> {
  const out: Record<string, ModifierOption> = {};
  for (const g of item.modifierGroups ?? []) {
    if (g.isRequired && g.selection === 'SINGLE' && g.options.length > 0) out[g.id] = g.options[0];
  }
  return out;
}

/** The same defaults as a cart-ready list, in menu order. */
export function defaultModifiers(item: ModifiableItem): ChosenModifier[] {
  const defaults = defaultOptionByGroup(item);
  return (item.modifierGroups ?? []).flatMap(g => {
    const o = defaults[g.id];
    return o ? [{ optionId: o.id, groupName: g.name, name: o.name, priceDelta: o.priceDelta }] : [];
  });
}
