/* Plate economics — what a dish costs to put on the plate, and what's left.
   ────────────────────────────────────────────────────────────────────────────
   Cost comes from two places, in order of trust:
     1. the item's recipe (BOM), priced at current ingredient cost — the truth
     2. the item's costPrice field — a manual estimate, better than nothing
   The UI always says which one it used, so nobody mistakes an estimate for a
   costed plate. */

export type CostSource = 'recipe' | 'estimate' | 'none';

export interface PlateEconomics {
  /** Cost to produce one plate, or null when nothing is known. */
  cost: number | null;
  /** Cash left per plate after ingredients. */
  margin: number | null;
  /** Margin as a percentage of the selling price. */
  marginPct: number | null;
  source: CostSource;
  /** True when the margin is thin enough that the owner should look at it. */
  needsAttention: boolean;
}

/** Below this, a plate is not carrying its share of overhead. */
export const HEALTHY_MARGIN_PCT = 55;

export interface BomLineLike {
  quantity: unknown;
  inventoryItem: { costPerUnit: unknown } | null;
}

/** Sum a recipe's lines at current ingredient prices. */
export function recipeCost(lines: BomLineLike[]): number {
  return lines.reduce(
    (sum, line) => sum + Number(line.quantity) * Number(line.inventoryItem?.costPerUnit ?? 0),
    0,
  );
}

export function plateEconomics({
  price,
  costPrice,
  bomLines,
}: {
  price: unknown;
  costPrice?: unknown;
  /** Pass the item's recipe lines when it has an active BOM. */
  bomLines?: BomLineLike[] | null;
}): PlateEconomics {
  const sell = Number(price);

  let cost: number | null = null;
  let source: CostSource = 'none';

  if (bomLines && bomLines.length > 0) {
    const fromRecipe = recipeCost(bomLines);
    // A recipe whose ingredients all cost 0 tells us nothing — fall through.
    if (fromRecipe > 0) {
      cost = fromRecipe;
      source = 'recipe';
    }
  }

  if (cost === null && costPrice != null && Number(costPrice) > 0) {
    cost = Number(costPrice);
    source = 'estimate';
  }

  if (cost === null || !Number.isFinite(sell) || sell <= 0) {
    return { cost: null, margin: null, marginPct: null, source, needsAttention: false };
  }

  const margin = sell - cost;
  const marginPct = (margin / sell) * 100;

  return {
    cost,
    margin,
    marginPct,
    source,
    needsAttention: marginPct < HEALTHY_MARGIN_PCT,
  };
}
