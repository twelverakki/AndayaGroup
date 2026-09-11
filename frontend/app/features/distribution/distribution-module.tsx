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
import { Truck, CheckCircle2, Flame, Send, ArrowDownLeft } from "lucide-react";

export interface DistributionItem {
  id: string;
  business_id: string;
  product_id: string;
  sent_to_user_id: string;
  qty: number;
  status: "sent" | "received";
  type: "outbound" | "return";
  sent_at: string;
  received_at?: string;
  created_at: string;
}

export interface ItemSimple {
  id: string;
  name: string;
  base_unit: string;
  box_unit: string;
}

export interface StaffUser {
  id: string;
  name: string;
}

export function DistributionModule() {
  const [distributions, setDistributions] = useState<DistributionItem[]>([]);
  const [finishedItems, setFinishedItems] = useState<ItemSimple[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal States
  const [isShipmentOpen, setIsShipmentOpen] = useState<boolean>(false);
  const [isThawOpen, setIsThawOpen] = useState<boolean>(false);

  // Shipment Form
  const [shipItemID, setShipItemID] = useState<string>("");
  const [shipToUserID, setShipToUserID] = useState<string>("");
  const [shipQty, setShipQty] = useState<number>(0);
  const [shipType, setShipType] = useState<string>("outbound");

  // Thaw Form
  const [thawItemID, setThawItemID] = useState<string>("");
  const [thawQtyPacks, setThawQtyPacks] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [distRes, itemsRes, staffRes] = await Promise.all([
        api.get("/logistics/distributions"),
        api.get("/items?item_type=finished_good"),
        api.get("/auth/staff"),
      ]);

      if (distRes.data && distRes.data.data) {
        setDistributions(distRes.data.data);
      }
      if (itemsRes.data && itemsRes.data.data) {
        setFinishedItems(itemsRes.data.data);
      }
      if (staffRes.data && staffRes.data.data) {
        setStaffUsers(staffRes.data.data);
      }
    } catch (err) {
      toast.error("Gagal memuat data rantai pasok logistik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateShipment = async () => {
    if (!shipItemID || !shipToUserID || shipQty <= 0) {
      toast.error("Lengkapi barang, penerima, dan kuantitas kiriman");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/logistics/distributions", {
        item_id: shipItemID,
        sent_to_user_id: shipToUserID,
        qty: shipQty,
        type: shipType,
      });
      toast.success("Pengiriman logistik berhasil dikirim! Menunggu konfirmasi terima barang.");
      setIsShipmentOpen(false);
      setShipItemID("");
      setShipToUserID("");
      setShipQty(0);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengirim logistik");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiveHandshake = async (distID: string) => {
    try {
      await api.post(`/logistics/distributions/${distID}/receive`);
      toast.success("Terima Kasih! Konfirmasi terima barang berhasil dan stok telah ditambahkan!");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mengonfirmasi terima barang");
    }
  };

  const handleThaw = async () => {
    if (!thawItemID || thawQtyPacks <= 0) {
      toast.error("Pilih produk pack dan kuantitas thaw");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/logistics/thaw", {
        item_id: thawItemID,
        qty_packs: thawQtyPacks,
      });
      toast.success(`Berhasil Thawing ${thawQtyPacks} Pack Beku menjadi Pcs Matang!`);
      setIsThawOpen(false);
      setThawItemID("");
      setThawQtyPacks(1);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mencairkan pack beku");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<DistributionItem>[] = [
    {
      key: "type",
      label: "Arah Kiriman",
      renderCell: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
            row.type === "outbound"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          }`}
        >
          {row.type === "outbound" ? <Send className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
          {row.type === "outbound" ? "Outbound Kirim" : "Retur Return"}
        </span>
      ),
    },
    {
      key: "qty",
      label: "Kuantitas",
      renderCell: (row) => (
        <div className="font-semibold text-slate-900 dark:text-slate-100">
          {row.qty} Pack
        </div>
      ),
    },
    {
      key: "status",
      label: "Status & Handshake",
      renderCell: (row) => {
        if (row.status === "received") {
          return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Diterima
            </span>
          );
        }
        return (
          <button
            onClick={() => handleReceiveHandshake(row.id)}
            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> [ Terima Barang ]
          </button>
        );
      },
    },
    {
      key: "sent_at",
      label: "Waktu Pengiriman",
      renderCell: (row) => (
        <div className="text-xs text-slate-500">
          {new Date(row.sent_at || row.created_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
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
            <Truck className="w-6 h-6 text-[#3F73F7]" />
            Modul Rantai Pasok Logistik & Thawing
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pengiriman outbound gudang <span className="font-semibold text-emerald-600">Handshake Terima Barang</span> & Thawing Pack Beku
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsThawOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2.5 rounded-full transition-colors shadow-sm text-sm"
          >
            <Flame className="w-4 h-4" />
            [ Thaw Pack Beku ]
          </button>
          <button
            onClick={() => setIsShipmentOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-[#3F73F7] hover:bg-[#3260d6] text-white font-medium px-4 py-2.5 rounded-full transition-colors shadow-sm text-sm"
          >
            <Send className="w-4 h-4" />
            [+ Kirim Logistik ]
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-[#202024] rounded-2xl border border-slate-200/80 dark:border-[#38383C] overflow-hidden">
        <ErpDataTable
          columns={columns}
          data={distributions}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyText="Belum ada riwayat pengiriman logistik."
        />
      </div>

      {/* Form Modal Kirim Logistik */}
      <Dialog open={isShipmentOpen} onOpenChange={setIsShipmentOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Kirim Logistik Outbound / Retur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div>
              <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Pilih Barang *</label>
              <Select value={shipItemID} onValueChange={(val) => val && setShipItemID(val)}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="-- Pilih Produk Pack Beku --" />
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
              <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Penerima (Staff/Mitra) *</label>
              <Select value={shipToUserID} onValueChange={(val) => val && setShipToUserID(val)}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="-- Pilih Personel Penerima --" />
                </SelectTrigger>
                <SelectContent>
                  {staffUsers.map((st) => (
                    <SelectItem key={st.id} value={st.id}>
                      {st.name}
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
                  value={shipQty}
                  onChange={(e) => setShipQty(Number(e.target.value))}
                  placeholder="5"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#3F73F7]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Jenis Kiriman</label>
                <Select value={shipType} onValueChange={(val) => val && setShipType(val)}>
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound (Gudang {"->"} Mitra)</SelectItem>
                    <SelectItem value="return">Return (Mitra {"->"} Gudang)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setIsShipmentOpen(false)}
              className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
            >
              Batal
            </button>
            <button
              onClick={handleCreateShipment}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-[#3F73F7] hover:bg-[#3260d6] text-white text-sm font-medium transition-colors"
            >
              {isSubmitting ? "Sending..." : "Kirim Sekarang"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Modal Thawing */}
      <Dialog open={isThawOpen} onOpenChange={setIsThawOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              Thaw Pack Beku {"->"} Pcs Matang
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div>
              <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Pilih Produk Pack Beku *</label>
              <Select value={thawItemID} onValueChange={(val) => val && setThawItemID(val)}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="-- Pilih Produk --" />
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

            <div>
              <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Jumlah Pack yang Dithaw *</label>
              <input
                type="number"
                value={thawQtyPacks}
                onChange={(e) => setThawQtyPacks(Number(e.target.value))}
                placeholder="1"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 italic">
                * 1 Pack Beku otomatis dikonversi menjadi 20 Pcs Matang di kuah gerobak.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setIsThawOpen(false)}
              className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium"
            >
              Batal
            </button>
            <button
              onClick={handleThaw}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors"
            >
              {isSubmitting ? "Thawing..." : "Konversi Sekarang"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
