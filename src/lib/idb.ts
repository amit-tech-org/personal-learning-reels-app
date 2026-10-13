import type { LibraryCard, Profile } from "./types";

const DB_NAME = "primer";
const DB_VERSION = 1;
const OPEN_TIMEOUT_MS = 1500;

let dbPromise: Promise<IDBDatabase> | null = null;
let disabled = false;

const emptyLibrary = { profile: null as Profile | null, queue: [] as string[], cards: [] as LibraryCard[] };

function openDb(): Promise<IDBDatabase> {
  if (disabled || typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, db?: IDBDatabase) => {
      if (settled) {
        db?.close();
        return;
      }
      settled = true;
      if (error || !db) {
        dbPromise = null;
        disabled = true;
        reject(error ?? new Error("IndexedDB failed"));
        return;
      }
      resolve(db);
    };

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      finish(error instanceof Error ? error : new Error("IndexedDB failed"));
      return;
    }

    const timer = setTimeout(() => finish(new Error("IndexedDB timed out")), OPEN_TIMEOUT_MS);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("cards")) db.createObjectStore("cards", { keyPath: "id" });
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      finish(undefined, request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      finish(request.error ?? new Error("IndexedDB failed"));
    };
    request.onblocked = () => {
      clearTimeout(timer);
      finish(new Error("IndexedDB blocked"));
    };
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

async function run<T>(work: (db: IDBDatabase) => Promise<T>, fallback: T): Promise<T> {
  if (disabled) return fallback;
  try {
    const db = await openDb();
    return await work(db);
  } catch {
    disabled = true;
    dbPromise = null;
    return fallback;
  }
}

export async function loadLibrary(): Promise<{ profile: Profile | null; queue: string[]; cards: LibraryCard[] }> {
  return run(async (db) => {
    const tx = db.transaction(["kv", "cards"], "readonly");
    const profileRequest = tx.objectStore("kv").get("profile");
    const queueRequest = tx.objectStore("kv").get("queue");
    const cardsRequest = tx.objectStore("cards").getAll();
    const [profile, queue, cards] = await Promise.all([
      requestToPromise(profileRequest),
      requestToPromise(queueRequest),
      requestToPromise(cardsRequest),
    ]);
    return {
      profile: (profile as Profile | undefined) ?? null,
      queue: (queue as string[] | undefined) ?? [],
      cards: cards as LibraryCard[],
    };
  }, emptyLibrary);
}

export async function saveProfile(profile: Profile): Promise<void> {
  await run(async (db) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(profile, "profile");
    await transactionDone(tx);
  }, undefined);
}

export async function saveQueue(queue: string[]): Promise<void> {
  await run(async (db) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(queue, "queue");
    await transactionDone(tx);
  }, undefined);
}

export async function saveCard(card: LibraryCard): Promise<void> {
  await run(async (db) => {
    const tx = db.transaction("cards", "readwrite");
    tx.objectStore("cards").put(card);
    await transactionDone(tx);
  }, undefined);
}

export async function replaceCards(cards: LibraryCard[]): Promise<void> {
  await run(async (db) => {
    const tx = db.transaction("cards", "readwrite");
    const store = tx.objectStore("cards");
    store.clear();
    for (const card of cards) store.put(card);
    await transactionDone(tx);
  }, undefined);
}

export async function eraseLibrary(): Promise<void> {
  await run(async (db) => {
    const tx = db.transaction(["kv", "cards"], "readwrite");
    tx.objectStore("kv").clear();
    tx.objectStore("cards").clear();
    await transactionDone(tx);
  }, undefined);
}
