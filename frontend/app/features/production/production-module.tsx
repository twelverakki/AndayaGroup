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
import { Factory, Plus, Trash2 } from "lucide-react";

export interface ProductionRunItem {
  id: string;
  business_id: string;
  batch_code: string;
  product_id: string;
  target_qty: number;
  actual_yield_qty: number;
  hpp_per_unit: number;
  total_material_cost: number;
  produced_by: string;
  produced_at: string;
  created_at: string;
}

export interface ItemSimple {
  id: string;
  name: string;
  item_type: string;
  base_unit: string;
  box_unit: string;
  standard_cost: number;
}

export function ProductionModule() {
  const [runs, setRuns] = useState<ProductionRunItem[]>([]);
  const [finishedItems, setFinishedItems] = useState<ItemSimple[]>([]);
  const [ingredientItems, setIngredientItems] = useState<ItemSimple[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Form State
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [qtyProduced, setQtyProduced] = useState<number>(0);
  const [expenses, setExpenses] = useState<{ item_id: string; qty: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [runsRes, itemsRes] = await Promise.all([
        api.get("/productions"),
        api.get("/items"),
      ]);

      if (runsRes.data && runsRes.data.data) {
        setRuns(runsRes.data.data);
      }
      if (itemsRes.data && itemsRes.data.data) {
        const allItems: ItemSimple[] = itemsRes.data.data;
        setFinishedItems(allItems.filter((i) => i.item_type === "finished_good"));
        setIngredientItems(allItems.filter((i) => i.item_type === "raw_material" || i.item_type === "consumable"));
      }
    } catch (err) {
      toast.error("Gagal memuat histori batch produksi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddExpenseRow = () => {
    setExpenses([...expenses, { item_id: "", qty: 1 }]);
  };

  const handleRemoveExpenseRow = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const handleExpenseChange = (index: number, field: "item_id" | "qty", val: any) => {
    const updated = [...expenses];
    updated[index] = { ...updated[index], [field]: val };
    setExpenses(updated);
  };

  const handleSubmit = async () => {
    if (!selectedItemId) {
      toast.error("Pilih produk hasil produksi");
      return;
    }
    if (qtyProduced <= 0) {
      toast.error("Jumlah hasil produksi harus lebih dari 0");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/productions", {
        item_id: selectedItemId,
        qty_produced: qtyProduced,
        expenses: expenses.filter((e) => e.item_id && e.qty > 0),
      });
      toast.success("Batch produksi F&B berhasil dicatat!");
      setIsModalOpen(false);
      setSelectedItemId("");
      setQtyProduced(0);
      setExpenses([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mencatat produksi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<ProductionRunItem>[] = [
    {
      key: "batch_code",
      label: "Kode Batch",
      renderCell: (row) => (
        <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
          {row.batch_code}
        </div>
      ),
    },
    {
      key: "actual_yield_qty",
      label: "Hasil Pack",
      renderCell: (row) => (
        <div className="font-semibold text-emerald-600 dark:text-emerald-400">
          {row.actual_yield_qty} Pack
        </div>
      ),
    },
    {
      key: "hpp_per_unit",
      label: "Snapshot HPP / Pack",
      renderCell: (row) => (
        <div className="text-slate-900 dark:text-slate-100 font-medium">
          Rp {row.hpp_per_unit.toLocaleString("id-ID")}
        </div>
      ),
    },
    {
      key: "total_material_cost",
      label: "Total Biaya Bahan",
      renderCell: (row) => (
        <div className="text-slate-500 text-xs">
          Rp {row.total_material_cost.toLocaleString("id-ID")}
        </div>
      ),
    },
    {
      key: "produced_at",
      label: "Tanggal Produksi",
      renderCell: (row) => (
        <div className="text-xs text-slate-500">
          {new Date(row.produced_at || row.created_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#202024] p-5 rounded-2xl border border-slate-200/80 dark:border-[#38383C] shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Factory className="w-6 h-6 text-[#3F73F7]" />
            Modul Batch Produksi & Pabrikasi F&B
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pencatatan batch pembuatan pack beku & kalkulasi otomatis snapshot HPP per unit
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 bg-[#3F73F7] hover:bg-[#3260d6] text-white font-medium px-4 py-2.5 rounded-full transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          [+ Catat Batch Produksi]
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-[#202024] rounded-2xl border border-slate-200/80 dark:border-[#38383C] overflow-hidden">
        <ErpDataTable
          columns={columns}
          data={runs}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyText="Belum ada riwayat batch produksi."
        />
      </div>

      {/* Form Modal Batch Produksi */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Catat Batch Produksi F&B</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div>
              <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">
                Pilih Produk Hasil Jadi *
              </label>
              <Select value={selectedItemId} onValueChange={(val) => val && setSelectedItemId(val)}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="-- Pilih Varian Pack Beku --" />
                </SelectTrigger>
                <SelectContent>
                  {finishedItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.box_unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">
                Hasil Jadi (Jumlah Pack) *
              </label>
              <input
                type="number"
                value={qtyProduced}
                onChange={(e) => setQtyProduced(Number(e.target.value))}
                placeholder="misal: 50"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#3F73F7]"
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold text-slate-800 dark:text-slate-200">
                  Pemakaian Bahan Baku & Alat Riil
                </label>
                <button
                  onClick={handleAddExpenseRow}
                  className="text-xs text-[#3F73F7] font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Bahan
                </button>
              </div>

              {expenses.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Belum ada bahan baku/alat yang ditambahkan.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {expenses.map((exp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Select
                          value={exp.item_id}
                          onValueChange={(val) => val && handleExpenseChange(idx, "item_id", val)}
                        >
                          <SelectTrigger className="w-full text-xs rounded-xl">
                            <SelectValue placeholder="Pilih Bahan / Alat" />
                          </SelectTrigger>
                          <SelectContent>
                            {ingredientItems.map((ing) => (
                              <SelectItem key={ing.id} value={ing.id}>
                                {ing.name} ({ing.base_unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <input
                        type="number"
                        value={exp.qty}
                        onChange={(e) => handleExpenseChange(idx, "qty", Number(e.target.value))}
                        placeholder="Qty"
                        className="w-20 px-2 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent"
                      />
                      <button
                        onClick={() => handleRemoveExpenseRow(idx)}
                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-[#3F73F7] hover:bg-[#3260d6] text-white text-sm font-medium transition-colors"
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Batch Produksi"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
