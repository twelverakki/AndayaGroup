import type { LineItemInput } from "../types";

/**
 * Calculates line subtotal accounting for dual-uom inputs (box + pcs) and discounts.
 */
export function calculateLineSubtotal(line: LineItemInput): number {
  if (line.has_dual_uom) {
    const sub = (line.qty_box * line.box_cost) + (line.qty_pcs * line.pcs_cost) - (line.discount_amount || 0);
    return sub > 0 ? sub : 0;
  }
  const qty = line.qty_pcs > 0 ? line.qty_pcs : line.qty_ordered;
  const cost = line.pcs_cost > 0 ? line.pcs_cost : line.unit_cost;
  const sub = (qty * cost) - (line.discount_amount || 0);
  return sub > 0 ? sub : 0;
}

/**
 * Calculates physical inventory count of item in base unit.
 */
export function calculateLinePhysicalCount(line: LineItemInput): number {
  if (line.has_dual_uom) {
    return (line.qty_box * line.conversion_rate) + line.qty_pcs;
  }
  return line.qty_pcs > 0 ? line.qty_pcs : line.qty_ordered;
}
