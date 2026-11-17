import { restore, type Data } from './model';
const DB_NAME = 'aoiro-2026-local';
const key = 'return-2026';
function db(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const req = indexedDB.open(DB_NAME,1);
    req.onupgradeneeded = () => req.result.createObjectStore('works');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}
export async function read(): Promise<Data | undefined> {
  const conn = await db();
  try {
    return await new Promise((resolve,reject) => {
      const req = conn.transaction('works').objectStore('works').get(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        try { resolve(req.result === undefined ? undefined : restore(req.result)); } catch(e) { reject(e); }
      };
    });
  } finally { conn.close(); }
}
let queue: Promise<void> = Promise.resolve();
export function save(data: Data) {
  const run = async () => {
    const conn = await db();
    try {
      await new Promise<void>((resolve,reject) => {
        const tx = conn.transaction('works','readwrite');
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(tx.error);
        tx.objectStore('works').put(data,key);
      });
    } finally { conn.close(); }
  };
  queue = queue.then(run,run);
  return queue;
}
