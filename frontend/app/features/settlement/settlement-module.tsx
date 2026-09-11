import { useState, useEffect } from "react";
import { ErpDataTable, type ColumnDef } from "../../components/ErpDataTable";
import { api } from "../../lib/api";
import { toast } from "../../components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui/select";
import { DollarSign, Plus, CheckCircle2, AlertTriangle, ShoppingCart } from "lucide-react";

export interface SettlementHeader {
  id: string;
  business_id: string;
  outlet_id: string;
  staff_id: string;
  settlement_date: string;
  cash_collected: number;
  qris_collected: number;
  total_collected: number;
  total_target_revenue: number;
  total_variance: number;
  notes?: string;
  client_uuid: string;
  created_at: string;
}

export interface ItemSimple {
  id: string;
  name: string;
  sell_price: number;
}

export function SettlementModule() {
  const [settlements, setSettlements] = useState<SettlementHeader[]>([]);
  const [finishedItems, setFinishedItems] = useState<ItemSimple[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal States
  const [isClosingOpen, setIsClosingOpen] = useState<boolean>(false);
  const [isDirectSaleOpen, setIsDirectSaleOpen] = useState<boolean>(false);

  // Closing Form
  const [cashCollected, setCashCollected] = useState<number>(0);
  const [qrisCollected, setQrisCollected] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [closingItems, setClosingItems] = useState<
    { item_id: string; opening_loose: number; thawed_loose: number; actual_loose: number; discard_loose: number }[]
  >([]);

  // Direct Sale Form
  const [directItemID, setDirectItemID] = useState<string>("");
  const [directQtyPack, setDirectQtyPack] = useState<number>(1);
  const [directUnitPrice, setDirectUnitPrice] = useState<number>(0);
  const [directPaymentMethod, setDirectPaymentMethod] = useState<string>("cash");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settleRes, itemsRes] = await Promise.all([
        api.get("/settlements"),
        api.get("/items?item_type=finished_good"),
      ]);

      if (settleRes.data && settleRes.data.data) {
        setSettlements(settleRes.data.data);
      }
      if (itemsRes.data && itemsRes.data.data) {
        setFinishedItems(itemsRes.data.data);
        // Pre-fill closing items
        const initialInputs = itemsRes.data.data.map((item: ItemSimple) => ({
          item_id: item.id,
          opening_loose: 0,
          thawed_loose: 20,
          actual_loose: 5,
          discard_loose: 0,
        }));
        setClosingItems(initialInputs);
      }
    } catch (err) {
      toast.error("Gagal memuat rekapitulasi setoran harian");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleClosingItemChange = (
    index: number,
    field: "opening_loose" | "thawed_loose" | "actual_loose" | "discard_loose",
    val: number
  ) => {
    const updated = [...closingItems];
    updated[index] = { ...updated[index], [field]: val };
    setClosingItems(updated);
  };

  const handleSubmitClosing = async () => {
    if (cashCollected < 0 || qrisCollected < 0) {
      toast.error("Nominal setoran fisik tidak boleh negatif");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/settlements", {
        cash_collected: cashCollected,
        qris_collected: qrisCollected,
        notes: notes || undefined,
        client_uuid: crypto.randomUUID(),
        items: closingItems,
      });
      toast.success("Closing shift & setoran harian berhasil dikirim!");
      setIsClosingOpen(false);
      setCashCollected(0);
      setQrisCollected(0);
      setNotes("");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengirim setoran closing");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDirectSale = async () => {
    if (!directItemID || directQtyPack <= 0 || directUnitPrice <= 0) {
      toast.error("Lengkapi data barang, pack, dan harga jual direct");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/settlements/direct-sales", {
        item_id: directItemID,
        qty_pack: directQtyPack,
        unit_price: directUnitPrice,
        payment_method: directPaymentMethod,
      });
      toast.success("Penjualan direct frozen pack berhasil diproses!");
      setIsDirectSaleOpen(false);
      setDirectItemID("");
      setDirectQtyPack(1);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal memproses direct sale");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<SettlementHeader>[] = [
    {
      key: "settlement_date",
      label: "Tanggal Closing",
      renderCell: (row) => (
        <div className="font-medium text-slate-900 dark:text-slate-100">
          {new Date(row.settlement_date || row.created_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
      ),
    },
    {
      key: "total_collected",
      label: "Total Setoran Fisik",
      renderCell: (row) => (
        <div className="font-bold text-emerald-600 dark:text-emerald-400">
          Rp {row.total_collected.toLocaleString("id-ID")}
          <div className="text-[11px] font-normal text-slate-500">
            Cash: Rp {row.cash_collected.toLocaleString("id-ID")} | QRIS: Rp {row.qris_collected.toLocaleString("id-ID")}
          </div>
        </div>
      ),
    },
    {
      key: "total_target_revenue",
      label: "Target Omset Sistem",
      renderCell: (row) => (
        <div className="text-slate-900 dark:text-slate-100 font-semibold">
          Rp {row.total_target_revenue.toLocaleString("id-ID")}
        </div>
      ),
    },
    {
      key: "total_variance",
      label: "Selisih Kas (Variance)",
      renderCell: (row) => {
        const v = row.total_variance;
        if (v === 0) {
          return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Pas (0)
            </span>
          );
        } else if (v < 0) {
          return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" /> Minus Rp {Math.abs(v).toLocaleString("id-ID")}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
            Plus Rp {v.toLocaleString("id-ID")}
          </span>
        );
      },
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#202024] p-5 rounded-2xl border border-slate-200/80 dark:border-[#38383C] shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#3F73F7]" />
            Modul Rekonsiliasi Closing & Setoran Harian
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Rekapitulasi setoran kas fisik harian vs target omset porsi terjual (Header-Detail Split)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDirectSaleOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2.5 rounded-full transition-colors shadow-sm text-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            [+ Direct Sale Gudang ]
          </button>
          <button
            onClick={() => setIsClosingOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-[#3F73F7] hover:bg-[#3260d6] text-white font-medium px-4 py-2.5 rounded-full transition-colors shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            [+ Input Closing Malam ]
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-[#202024] rounded-2xl border border-slate-200/80 dark:border-[#38383C] overflow-hidden">
        <ErpDataTable
          columns={columns}
          data={settlements}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyText="Belum ada riwayat setoran harian."
        />
      </div>

      {/* Form Modal Closing Setoran Malam */}
      <Dialog open={isClosingOpen} onOpenChange={setIsClosingOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Input Closing Shift & Setoran Malam</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Setoran Uang Tunai (Cash) *</label>
                <input
                  type="number"
                  value={cashCollected}
                  onChange={(e) => setCashCollected(Number(e.target.value))}
                  placeholder="250000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#3F73F7]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Setoran Non-Tunai (QRIS) *</label>
                <input
                  type="number"
                  value={qrisCollected}
                  onChange={(e) => setQrisCollected(Number(e.target.value))}
                  placeholder="150000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#3F73F7]"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
              <label className="block font-semibold mb-2 text-slate-800 dark:text-slate-200">
                Hitungan Fisik Porsi Terjual per Varian
              </label>

              {finishedItems.map((item, idx) => {
                const cItem = closingItems[idx] || {
                  opening_loose: 0,
                  thawed_loose: 0,
                  actual_loose: 0,
                  discard_loose: 0,
                };
                const qtySold = (cItem.opening_loose + cItem.thawed_loose) - cItem.actual_loose - cItem.discard_loose;

                return (
                  <div key={item.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl mb-3 border border-slate-200/60 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between font-medium">
                      <span>{item.name}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        Terjual: {qtySold > 0 ? qtySold : 0} Pcs
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Awal (Pcs)</span>
                        <input
                          type="number"
                          value={cItem.opening_loose}
                          onChange={(e) => handleClosingItemChange(idx, "opening_loose", Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <span className="text-slate-500">Thaw (Pcs)</span>
                        <input
                          type="number"
                          value={cItem.thawed_loose}
                          onChange={(e) => handleClosingItemChange(idx, "thawed_loose", Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <span className="text-slate-500">Sisa Fisik</span>
                        <input
                          type="number"
                          value={cItem.actual_loose}
                          onChange={(e) => handleClosingItemChange(idx, "actual_loose", Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <span className="text-slate-500">Buang (QC)</span>
                        <input
                          type="number"
                          value={cItem.discard_loose}
                          onChange={(e) => handleClosingItemChange(idx, "discard_loose", Number(e.target.value))}
                          className="w-full px-2 py-1 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Catatan / Keterangan</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan kendala jualan hari ini..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setIsClosingOpen(false)}
              className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
            >
              Batal
            </button>
            <button
              onClick={handleSubmitClosing}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-[#3F73F7] hover:bg-[#3260d6] text-white text-sm font-medium transition-colors"
            >
              {isSubmitting ? "Submitting..." : "Kirim Closing Setoran"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Modal Direct Sale Gudang */}
      <Dialog open={isDirectSaleOpen} onOpenChange={setIsDirectSaleOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-purple-600" />
              Direct Sale Frozen Pack Gudang
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div>
              <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Pilih Varian Frozen Pack *</label>
              <Select value={directItemID} onValueChange={(val) => {
                if (val) {
                  setDirectItemID(val);
                  const sel = finishedItems.find(i => i.id === val);
                  if (sel) setDirectUnitPrice(sel.sell_price * 20); // Default pack price
                }
              }}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="-- Pilih Produk Pack --" />
                </SelectTrigger>
                <SelectContent>
                  {finishedItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Jumlah Pack *</label>
                <input
                  type="number"
                  value={directQtyPack}
                  onChange={(e) => setDirectQtyPack(Number(e.target.value))}
                  placeholder="1"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Harga per Pack (Rp) *</label>
                <input
                  type="number"
                  value={directUnitPrice}
                  onChange={(e) => setDirectUnitPrice(Number(e.target.value))}
                  placeholder="30000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Metode Pembayaran</label>
              <Select value={directPaymentMethod} onValueChange={(val) => val && setDirectPaymentMethod(val)}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Tunai / Cash</SelectItem>
                  <SelectItem value="qris">QRIS / Non-Tunai</SelectItem>
                  <SelectItem value="transfer">Transfer Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setIsDirectSaleOpen(false)}
              className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
            >
              Batal
            </button>
            <button
              onClick={handleSubmitDirectSale}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
            >
              {isSubmitting ? "Processing..." : "Proses Direct Sale"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
