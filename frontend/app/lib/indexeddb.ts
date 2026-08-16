const DB_NAME = "andaya_erp_db";
const DB_VERSION = 1;
const STORE_NAME = "transactions_queue";

export interface QueuedTransaction {
  client_uuid: string;
  business_id: string;
  outlet_id?: string;
  type: "sale" | "internal_take" | "void";
  payload: any;
  status: "pending_sync" | "synced" | "failed";
  created_at: string;
}

// Open IndexedDB connection
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[IndexedDB] Database failed to open");
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "client_uuid" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("created_at", "created_at", { unique: false });
        console.log("[IndexedDB] Store created successfully:", STORE_NAME);
      }
    };
  });
};

// Add transaction to the queue
export const enqueueTransaction = async (transaction: Omit<QueuedTransaction, "status" | "created_at">): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const queuedItem: QueuedTransaction = {
      ...transaction,
      status: "pending_sync",
      created_at: new Date().toISOString(),
    };

    const request = store.add(queuedItem);

    request.onsuccess = () => {
      console.log("[IndexedDB] Transaction queued for sync:", transaction.client_uuid);
      resolve();
    };

    request.onerror = () => {
      console.error("[IndexedDB] Failed to enqueue transaction:", request.error);
      reject(request.error);
    };
  });
};

// Retrieve all transactions that are pending sync
export const getPendingTransactions = async (): Promise<QueuedTransaction[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("status");
    const request = index.getAll("pending_sync");

    request.onsuccess = () => {
      resolve(request.result as QueuedTransaction[]);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

// Mark transaction as synced
export const markTransactionSynced = async (client_uuid: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(client_uuid);

    getRequest.onsuccess = () => {
      const data = getRequest.result as QueuedTransaction;
      if (data) {
        data.status = "synced";
        const updateRequest = store.put(data);
        updateRequest.onsuccess = () => {
          console.log("[IndexedDB] Transaction marked synced:", client_uuid);
          resolve();
        };
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
};
