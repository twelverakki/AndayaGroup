export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  payment_terms_days: number;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  item_id: string;
  item_name: string;
  item_sku?: string;
  item_type: string;
  base_unit: string;
  box_unit?: string;
  uom: "box" | "base";
  qty_ordered: number;
  qty_received: number;
  conversion_rate: number;
  unit_cost: number;
  discount_amount: number;
  subtotal: number;
  notes?: string;
}

export interface Purchase {
  id: string;
  business_id: string;
  outlet_id: string;
  outlet_name?: string;
  po_number: string;
  invoice_no?: string;
  supplier_id?: string;
  supplier_name: string;
  status: "draft" | "submitted" | "partially_received" | "received" | "cancelled";
  payment_status: "unpaid" | "partial" | "paid";
  payment_method: "cash" | "bank_transfer" | "credit" | "qris";
  order_date: string;
  due_date?: string;
  received_at?: string;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  shipping_cost: number;
  total_amount: number;
  amount_paid: number;
  amount_owed: number;
  notes?: string;
  created_by?: string;
  created_by_name?: string;
  received_by?: string;
  received_by_name?: string;
  created_at: string;
  updated_at: string;
  items?: PurchaseItem[];
}

export interface PurchasePayment {
  id: string;
  purchase_id: string;
  payment_no: string;
  payment_date: string;
  amount_paid: number;
  payment_method: string;
  reference_no?: string;
  recorded_by_name?: string;
  notes?: string;
  created_at: string;
}

export interface ItemOption {
  id: string;
  name: string;
  sku?: string;
  category_name?: string;
  item_type: string;
  base_unit: string;
  box_unit?: string;
  conversion_rate: number;
  standard_cost: number;
  allow_branch_purchase: boolean;
  image_url?: string;
}

export interface OutletOption {
  id: string;
  name: string;
  is_main: boolean;
  allow_direct_purchase?: boolean;
}

export interface LineItemInput {
  item_id: string;
  item_name: string;
  sku?: string;
  base_unit: string;
  box_unit?: string;
  conversion_rate: number;
  has_dual_uom: boolean;

  // Dual-UOM Fields (Combined inputs)
  qty_box: number;
  box_cost: number;
  qty_pcs: number;
  pcs_cost: number;

  // Legacy / fallback fields
  uom: "box" | "base";
  qty_ordered: number;
  unit_cost: number;
  discount_amount: number;
  notes?: string;
}

export interface ProcurementModuleProps {
  view?: "history" | "new";
  onSuccess?: () => void;
  onCancel?: () => void;
  onNavigate?: (subView: string) => void;
}
