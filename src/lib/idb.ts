import type { LibraryCard, Profile } from "./types";

const DB_NAME = "primer";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("cards")) {
        db.createObjectStore("cards", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction("kv", "readonly");
  const value = await requestToPromise(tx.objectStore("kv").get(key));
  return value as T | undefined;
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("kv", "readwrite");
  tx.objectStore("kv").put(value, key);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadLibrary(): Promise<{ profile: Profile | null; queue: string[]; cards: LibraryCard[] }> {
  const db = await openDb();
  const kvTx = db.transaction("kv", "readonly");
  const profile = (await requestToPromise(kvTx.objectStore("kv").get("profile"))) as Profile | undefined;
  const queue = (await requestToPromise(kvTx.objectStore("kv").get("queue"))) as string[] | undefined;
  const cardTx = db.transaction("cards", "readonly");
  const cards = (await requestToPromise(cardTx.objectStore("cards").getAll())) as LibraryCard[];
  return { profile: profile ?? null, queue: queue ?? [], cards };
}

export async function saveProfile(profile: Profile): Promise<void> {
  await idbSet("profile", profile);
}

export async function saveQueue(queue: string[]): Promise<void> {
  await idbSet("queue", queue);
}

export async function saveCard(card: LibraryCard): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("cards", "readwrite");
  tx.objectStore("cards").put(card);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function replaceCards(cards: LibraryCard[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("cards", "readwrite");
  const store = tx.objectStore("cards");
  store.clear();
  for (const card of cards) store.put(card);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function eraseLibrary(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(["kv", "cards"], "readwrite");
  tx.objectStore("kv").clear();
  tx.objectStore("cards").clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
