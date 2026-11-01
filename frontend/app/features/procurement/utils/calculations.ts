import type { LineItemInput, Purchase, ItemOption } from "../types";

/**
 * Helper to ensure a number is valid and finite, defaulting to 0.
 */
export function safeNum(val: any): number {
  if (typeof val === "number" && !isNaN(val) && isFinite(val)) {
    return val;
  }
  const parsed = parseFloat(val);
  return !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
}

/**
 * Calculates gross total for a line item before any discounts.
 * Guaranteed to return a valid non-negative number (never NaN).
 */
export function calculateLineGross(line: LineItemInput): number {
  if (!line) return 0;
  if (line.has_dual_uom) {
    const boxTotal = safeNum(line.qty_box) * safeNum(line.box_cost);
    const pcsTotal = safeNum(line.qty_pcs) * safeNum(line.pcs_cost);
    return Math.max(0, boxTotal + pcsTotal);
  }
  const qty = safeNum(line.qty_pcs) > 0 ? safeNum(line.qty_pcs) : safeNum(line.qty_ordered);
  const cost = safeNum(line.pcs_cost) > 0 ? safeNum(line.pcs_cost) : safeNum(line.unit_cost);
  return Math.max(0, qty * cost);
}

/**
 * Calculates effective line discount amount in Rupiah.
 * - Untuk Dual UoM: (diskon/dus * qty_box) + (diskon/pcs * qty_pcs)
 * - Untuk Single UoM: (diskon/satuan * qty)
 */
export function calculateLineDiscountAmount(line: LineItemInput): number {
  if (!line) return 0;

  if (line.has_dual_uom) {
    const qtyBox = safeNum(line.qty_box);
    const boxDisc = safeNum(line.box_discount_amount);
    const boxTotalDisc = qtyBox * boxDisc;

    const qtyPcs = safeNum(line.qty_pcs);
    const pcsDisc = safeNum(line.pcs_discount_amount);
    const pcsTotalDisc = qtyPcs * pcsDisc;

    const dualTotal = boxTotalDisc + pcsTotalDisc;
    if (dualTotal > 0) {
      return Math.round(dualTotal);
    }
  }

  // Single UoM atau fallback
  const qty = safeNum(line.qty_pcs) > 0 ? safeNum(line.qty_pcs) : safeNum(line.qty_ordered);
  const unitDisc =
    line.pcs_discount_amount !== undefined
      ? safeNum(line.pcs_discount_amount)
      : safeNum(line.discount_amount);

  return Math.max(0, Math.round(unitDisc * (qty > 0 ? qty : 1)));
}

/**
 * Calculates line subtotal accounting for dual-uom inputs (box + pcs) and per-unit discounts.
 * Guaranteed to return a valid non-negative number (never NaN).
 */
export function calculateLineSubtotal(line: LineItemInput): number {
  if (!line) return 0;
  const gross = calculateLineGross(line);
  const discount = calculateLineDiscountAmount(line);
  const sub = gross - discount;
  return sub > 0 ? sub : 0;
}

/**
 * Calculates physical inventory count of item in base unit.
 */
export function calculateLinePhysicalCount(line: LineItemInput): number {
  if (!line) return 0;
  if (line.has_dual_uom) {
    const rate = safeNum(line.conversion_rate) > 0 ? safeNum(line.conversion_rate) : 1;
    return (safeNum(line.qty_box) * rate) + safeNum(line.qty_pcs);
  }
  return safeNum(line.qty_pcs) > 0 ? safeNum(line.qty_pcs) : safeNum(line.qty_ordered);
}

/**
 * Reconstructs editable dual-UoM line items from a persisted Purchase record.
 */
export function buildLineItemsFromPurchase(
  p: Purchase,
  itemsCatalog: ItemOption[]
): LineItemInput[] {
  if (!p.items || p.items.length === 0) return [];

  const lineMap = new Map<string, LineItemInput>();

  for (const it of p.items) {
    const catalogItem = itemsCatalog.find((ci) => ci.id === it.item_id);
    const boxUnit = it.box_unit || catalogItem?.box_unit || undefined;
    const baseUnit = it.base_unit || catalogItem?.base_unit || "pcs";
    const convRate = it.conversion_rate > 1 ? it.conversion_rate : catalogItem?.conversion_rate || 1;
    const hasDualUom = Boolean(boxUnit && convRate > 1);

    if (lineMap.has(it.item_id)) {
      const existing = lineMap.get(it.item_id)!;
      if (it.uom === "box") {
        existing.qty_box = (existing.qty_box || 0) + it.qty_ordered;
        existing.box_cost = it.unit_cost;
        const perUnitDisc = it.qty_ordered > 0 ? Math.round(it.discount_amount / it.qty_ordered) : 0;
        existing.box_discount_amount = (existing.box_discount_amount || 0) + perUnitDisc;
      } else {
        existing.qty_pcs = (existing.qty_pcs || 0) + it.qty_ordered;
        existing.pcs_cost = it.unit_cost;
        const perUnitDisc = it.qty_ordered > 0 ? Math.round(it.discount_amount / it.qty_ordered) : 0;
        existing.pcs_discount_amount = (existing.pcs_discount_amount || 0) + perUnitDisc;
      }
      existing.qty_ordered = (existing.qty_ordered || 0) + it.qty_ordered;
      existing.discount_amount = (existing.discount_amount || 0) + it.discount_amount;
    } else {
      const isBox = it.uom === "box";
      const boxCost = isBox ? it.unit_cost : Math.round(it.unit_cost * convRate);
      const pcsCost = !isBox ? it.unit_cost : (convRate > 0 ? Math.round(it.unit_cost / convRate) : it.unit_cost);
      const qtyBox = isBox ? it.qty_ordered : 0;
      const qtyPcs = !isBox ? it.qty_ordered : 0;
      const perUnitDisc = it.qty_ordered > 0 ? Math.round(it.discount_amount / it.qty_ordered) : 0;

      lineMap.set(it.item_id, {
        item_id: it.item_id,
        item_name: it.item_name || catalogItem?.name || "Item",
        sku: it.item_sku || catalogItem?.sku || "",
        category_name: catalogItem?.category_name || "",
        base_unit: baseUnit,
        box_unit: boxUnit,
        conversion_rate: convRate,
        has_dual_uom: hasDualUom,
        qty_box: qtyBox,
        box_cost: boxCost,
        original_box_cost: boxCost,
        qty_pcs: qtyPcs,
        pcs_cost: pcsCost,
        original_pcs_cost: pcsCost,
        box_discount_amount: isBox ? perUnitDisc : 0,
        pcs_discount_amount: !isBox ? perUnitDisc : 0,
        uom: it.uom || (hasDualUom ? "box" : "base"),
        qty_ordered: it.qty_ordered,
        unit_cost: it.unit_cost,
        discount_amount: it.discount_amount || 0,
        notes: it.notes || "",
      });
    }
  }

  return Array.from(lineMap.values());
}
