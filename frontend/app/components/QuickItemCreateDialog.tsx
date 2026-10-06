import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CurrencyInput } from "./CurrencyInput";
import { Sparkles, PackagePlus, Check, ChevronsUpDown, Plus, PenLine, ListFilter, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/lib/api";

export interface QuickCreatedItem {
  id: string;
  name: string;
  sku?: string;
  category_id?: string;
  base_unit: string;
  box_unit?: string;
  conversion_rate: number;
  sell_price: number;
  standard_cost: number;
  box_sell_price?: number;
  needs_review: boolean;
  creation_source: string;
  [key: string]: any;
}

export interface QuickItemCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  categories?: Array<{ id: string; name: string }>;
  onCreated: (newItem: QuickCreatedItem) => void;
}

export function QuickItemCreateDialog({
  open,
  onOpenChange,
  initialName = "",
  categories = [],
  onCreated,
}: QuickItemCreateDialogProps) {
  const [name, setName] = useState(initialName);
  const [categoryList, setCategoryList] = useState<Array<{ id: string; name: string }>>(categories);
  const [categoryId, setCategoryId] = useState<string>("none");
  const [isManualCategory, setIsManualCategory] = useState(false);
  const [manualCategoryName, setManualCategoryName] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  // Unit & Pricing states
  const [baseUnit, setBaseUnit] = useState("pcs");
  const [standardCost, setStandardCost] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(0);

  // Box / Kemasan Besar states
  const [hasBoxUnit, setHasBoxUnit] = useState(false);
  const [boxUnit, setBoxUnit] = useState("Dus");
  const [conversionRate, setConversionRate] = useState<number>(24);
  const [boxStandardCost, setBoxStandardCost] = useState<number>(0);
  const [boxSellPrice, setBoxSellPrice] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync categoryList when categories prop changes
  useEffect(() => {
    if (categories && categories.length > 0) {
      setCategoryList(categories);
    }
  }, [categories]);

  // Sync initialName & reset states when opening dialog
  useEffect(() => {
    if (open) {
      setName(initialName);
      setCategoryId("none");
      setIsManualCategory(false);
      setManualCategoryName("");
      setCategorySearch("");
      setBaseUnit("pcs");
      setStandardCost(0);
      setSellPrice(0);
      setHasBoxUnit(false);
      setBoxUnit("Dus");
      setConversionRate(24);
      setBoxStandardCost(0);
      setBoxSellPrice(0);
    }
  }, [open, initialName]);

  // Filtered categories for Combobox autocomplete
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categoryList;
    return categoryList.filter((c) =>
      c.name.toLowerCase().includes(categorySearch.toLowerCase().trim())
    );
  }, [categoryList, categorySearch]);

  const selectedCategoryName = useMemo(() => {
    if (categoryId === "none") return "Tanpa Kategori (Atur Nanti)";
    const found = categoryList.find((c) => c.id === categoryId);
    return found ? found.name : "Pilih Kategori...";
  }, [categoryId, categoryList]);

  // Auto-calculate Box Cost when Base Cost or Conversion changes if box cost hasn't been manually set
  const handleBaseCostChange = (val: number) => {
    setStandardCost(val);
    if (hasBoxUnit && conversionRate > 0) {
      setBoxStandardCost(val * conversionRate);
    }
  };

  const handleConversionRateChange = (rate: number) => {
    const validRate = rate > 0 ? rate : 1;
    setConversionRate(validRate);
    if (standardCost > 0) {
      setBoxStandardCost(standardCost * validRate);
    }
  };

  // Switch directly to manual category typing mode and paste the searched query
  const handleSwitchToManualWithText = (text: string) => {
    setManualCategoryName(text.trim());
    setIsManualCategory(true);
    setIsCategoryOpen(false);
    setCategorySearch("");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama barang wajib diisi");
      return;
    }

    try {
      setIsSubmitting(true);

      let finalCategoryId: string | undefined = undefined;

      // Handle custom manual category name if typed
      if (isManualCategory && manualCategoryName.trim()) {
        const trimmedCat = manualCategoryName.trim();
        const matched = categoryList.find(
          (c) => c.name.toLowerCase() === trimmedCat.toLowerCase()
        );
        if (matched) {
          finalCategoryId = matched.id;
        } else {
          try {
            const res = await api.post("/categories", {
              name: trimmedCat,
              category_type: "finished_good",
            });
            if (res?.data?.data?.id) {
              finalCategoryId = res.data.data.id;
            }
          } catch (catErr) {
            console.error("Gagal membuat kategori baru:", catErr);
          }
        }
      } else if (categoryId && categoryId !== "none") {
        finalCategoryId = categoryId;
      }

      const payload: any = {
        name: name.trim(),
        base_unit: baseUnit.trim() || "pcs",
        box_unit: hasBoxUnit ? (boxUnit.trim() || "Dus") : "",
        conversion_rate: hasBoxUnit ? (conversionRate > 0 ? conversionRate : 1) : 1,
        standard_cost: standardCost,
        sell_price: sellPrice,
        box_sell_price: hasBoxUnit ? boxSellPrice : 0,
        source: "po_inline",
      };

      if (finalCategoryId) {
        payload.category_id = finalCategoryId;
      }

      const res = await api.post("/items/quick-create", payload);

      if (res && res.data && res.data.data) {
        toast.success(`Barang "${res.data.data.name}" berhasil dibuat kilat.`);
        onCreated(res.data.data);
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Gagal membuat barang kilat");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl p-6 sm:p-7 bg-white dark:bg-[#1A1A1E] border border-slate-200 dark:border-[#2E2E34] rounded-3xl shadow-2xl space-y-5">
        <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80 text-left space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Buat Barang Baru (Kilat)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Input kilat untuk kebutuhan PO. Barang otomatis ditandai untuk peninjauan master data nanti.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Section 1: Item Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Item Name (No placeholder as requested) */}
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-800 dark:text-slate-200">
                Nama Barang / Produk <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus-visible:ring-indigo-500/20"
              />
            </div>

            {/* Category Combobox Autocomplete / Textfield */}
            <div className="space-y-1.5 w-full">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-slate-800 dark:text-slate-200">
                  Kategori Produk
                </Label>
                <button
                  type="button"
                  onClick={() => setIsManualCategory(!isManualCategory)}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {isManualCategory ? (
                    <>
                      <ListFilter className="w-3 h-3" />
                      Pilih dari Daftar
                    </>
                  ) : (
                    <>
                      <PenLine className="w-3 h-3" />
                      Ketik Manual / Baru
                    </>
                  )}
                </button>
              </div>

              {isManualCategory ? (
                <Input
                  type="text"
                  value={manualCategoryName}
                  onChange={(e) => setManualCategoryName(e.target.value)}
                  placeholder="Ketik nama kategori baru..."
                  className="h-10 w-full px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus-visible:ring-indigo-500/20"
                />
              ) : (
                <div className="w-full">
                  <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
                    <PopoverTrigger
                      type="button"
                      className="h-10 w-full px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-left"
                    >
                      <span className={categoryId === "none" ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white font-semibold"}>
                        {selectedCategoryName}
                      </span>
                      <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0 opacity-60 ml-2" />
                    </PopoverTrigger>
                    <PopoverContent
                      sideOffset={6}
                      align="start"
                      className="w-[var(--anchor-width)] min-w-[280px] p-2 bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#38383C] rounded-2xl shadow-xl z-50"
                    >
                      <div className="space-y-1.5 w-full">
                        <Input
                          type="text"
                          placeholder="Cari atau ketik kategori..."
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          className="h-9 px-3 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl w-full"
                          autoFocus
                        />
                        <div className="max-h-48 overflow-y-auto space-y-0.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCategoryId("none");
                              setIsCategoryOpen(false);
                              setCategorySearch("");
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                          >
                            <span>-- Tanpa Kategori (Atur Nanti) --</span>
                            {categoryId === "none" && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                          </button>

                          {filteredCategories.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setCategoryId(cat.id);
                                setIsCategoryOpen(false);
                                setCategorySearch("");
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-slate-900 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between cursor-pointer"
                            >
                              <span>{cat.name}</span>
                              {categoryId === cat.id && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                            </button>
                          ))}

                          {categorySearch.trim() &&
                            !categoryList.some(
                              (c) => c.name.toLowerCase() === categorySearch.trim().toLowerCase()
                            ) && (
                              <button
                                type="button"
                                onClick={() => handleSwitchToManualWithText(categorySearch)}
                                className="w-full px-2.5 py-2 mt-1 rounded-lg text-left text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/50 hover:bg-indigo-100 flex items-center gap-1.5 cursor-pointer border border-indigo-200/60 dark:border-indigo-800/40"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Ketik sebagai Kategori Baru "{categorySearch.trim()}"</span>
                              </button>
                            )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Frameless Unit & Pricing Table Matrix */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between px-0.5">
              <Label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                Konfigurasi Satuan & Harga
              </Label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Single / Duo-UOM
              </span>
            </div>

            {/* Frameless Table Layout */}
            <div className="space-y-2.5">
              {/* Floating Capsule Header (No outer border wrapper) */}
              <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-3.5 py-2 bg-[#E7E9ED] dark:bg-[#2A2A2E] rounded-xl text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <div className="col-span-3">Tingkat Satuan</div>
                <div className="col-span-3">Nama Satuan</div>
                <div className="col-span-3">Harga Beli (Modal)</div>
                <div className="col-span-3">Harga Jual POS</div>
              </div>

              {/* ROW 1: ECERAN (Always Active / Base UOM) */}
              <div className="flex flex-col sm:grid sm:grid-cols-12 gap-3 items-start sm:items-center bg-white dark:bg-[#202024] p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="col-span-3 flex items-center gap-2.5">
                  <Checkbox checked={true} disabled className="h-4 w-4 rounded-md" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-xs block">
                      Eceran
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Satuan Dasar (Wajib)
                    </span>
                  </div>
                </div>

                <div className="col-span-3 w-full">
                  <span className="sm:hidden text-[10px] font-bold text-slate-500 block mb-1">
                    Satuan:
                  </span>
                  <Input
                    type="text"
                    required
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value)}
                    placeholder="pcs"
                    className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="col-span-3 w-full">
                  <span className="sm:hidden text-[10px] font-bold text-slate-500 block mb-1">
                    Harga Beli / Modal:
                  </span>
                  <CurrencyInput
                    value={standardCost}
                    onChange={handleBaseCostChange}
                    className="h-10 w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    placeholder="0"
                  />
                </div>

                <div className="col-span-3 w-full">
                  <span className="sm:hidden text-[10px] font-bold text-slate-500 block mb-1">
                    Harga Jual:
                  </span>
                  <CurrencyInput
                    value={sellPrice}
                    onChange={setSellPrice}
                    className="h-10 w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* ROW 2: KEMASAN BESAR (Duo-UOM, Toggleable) */}
              <div
                className={`flex flex-col sm:grid sm:grid-cols-12 gap-3 items-start sm:items-center p-3 rounded-xl border transition-all ${
                  hasBoxUnit
                    ? "bg-white dark:bg-[#202024] border-indigo-200 dark:border-indigo-900/60 shadow-xs"
                    : "bg-slate-50/70 dark:bg-slate-900/30 border-dashed border-slate-300 dark:border-slate-800"
                }`}
              >
                <div className="col-span-3 flex items-center gap-2.5">
                  <Checkbox
                    checked={hasBoxUnit}
                    onCheckedChange={(checked) => {
                      const active = Boolean(checked);
                      setHasBoxUnit(active);
                      if (active && standardCost > 0 && boxStandardCost === 0) {
                        setBoxStandardCost(standardCost * (conversionRate || 24));
                      }
                    }}
                    className="h-4 w-4 rounded-md cursor-pointer"
                  />
                  <div
                    onClick={() => {
                      const next = !hasBoxUnit;
                      setHasBoxUnit(next);
                      if (next && standardCost > 0 && boxStandardCost === 0) {
                        setBoxStandardCost(standardCost * (conversionRate || 24));
                      }
                    }}
                    className="cursor-pointer select-none"
                  >
                    <span className="font-bold text-slate-900 dark:text-white text-xs block">
                      Kemasan Besar
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Dus, Bal, Karton
                    </span>
                  </div>
                </div>

                {hasBoxUnit ? (
                  <>
                    <div className="col-span-3 w-full animate-in fade-in-30">
                      <span className="sm:hidden text-[10px] font-bold text-slate-500 block mb-1">
                        Satuan Besar:
                      </span>
                      <Input
                        type="text"
                        value={boxUnit}
                        onChange={(e) => setBoxUnit(e.target.value)}
                        placeholder="Dus"
                        className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div className="col-span-3 w-full animate-in fade-in-30">
                      <span className="sm:hidden text-[10px] font-bold text-slate-500 block mb-1">
                        Harga Beli / Kemasan:
                      </span>
                      <CurrencyInput
                        value={boxStandardCost}
                        onChange={setBoxStandardCost}
                        className="h-10 w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        placeholder="0"
                      />
                    </div>

                    <div className="col-span-3 w-full animate-in fade-in-30">
                      <span className="sm:hidden text-[10px] font-bold text-slate-500 block mb-1">
                        Harga Jual / Kemasan:
                      </span>
                      <CurrencyInput
                        value={boxSellPrice}
                        onChange={setBoxSellPrice}
                        className="h-10 w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        placeholder="0"
                      />
                    </div>
                  </>
                ) : (
                  <div
                    onClick={() => {
                      setHasBoxUnit(true);
                      if (standardCost > 0 && boxStandardCost === 0) {
                        setBoxStandardCost(standardCost * (conversionRate || 24));
                      }
                    }}
                    className="col-span-9 w-full py-2 px-3 rounded-lg text-slate-500 dark:text-slate-400 text-xs font-medium cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                  >
                    Centang untuk mengaktifkan satuan grosir / kemasan besar (Dus, Bal, Karton, dll.).
                  </div>
                )}
              </div>

              {/* Bottom Conversion Formula Row (Active when hasBoxUnit == true) */}
              {hasBoxUnit && (
                <div className="flex flex-wrap items-center gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 animate-in fade-in-30">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Konversi Satuan:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white text-xs shadow-xs">
                      1 {boxUnit || "Dus"}
                    </span>
                    <span className="font-black text-slate-400">=</span>
                    <Input
                      type="number"
                      min="1"
                      value={conversionRate}
                      onChange={(e) => handleConversionRateChange(parseFloat(e.target.value) || 1)}
                      className="h-9 w-20 text-center font-black bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg"
                    />
                    <span className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white text-xs shadow-xs">
                      {baseUnit || "pcs"}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:ml-auto">
                    Setiap pembelian/penjualan 1 {boxUnit || "Dus"} setara dengan {conversionRate} {baseUnit || "pcs"}.
                  </span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 px-5 rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="h-10 flex-1 sm:flex-initial px-6 rounded-xl bg-[#E2FF66] text-slate-900 font-black hover:brightness-95 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <PackagePlus className="w-4 h-4 text-slate-900" />
              <span>{isSubmitting ? "Menyimpan..." : "Simpan & Masukkan ke PO"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
