// IndexedDB cache for notification tones
import request from '../helper/api';
import constants from '../constants.json';
const DB_NAME = `${(constants.APP_NAME || 'app').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-cache`;
const STORE_NAME = 'notification-tones';

let db = null;
const pendingDownloads = new Map(); // toneUrl -> Promise

// Initialize IndexedDB
async function initDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'hotelId' });
      }
    };
  });
}

// Get tone from cache
export async function getCachedTone(hotelId) {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(hotelId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('❌ Cache read error:', error);
    return null;
  }
}

// Save tone to cache
export async function cacheTone(hotelId, toneUrl, blob) {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        hotelId,
        toneUrl,
        blob,
        cachedAt: new Date().getTime(),
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  } catch (error) {
    console.error('❌ Cache write error:', error);
    return false;
  }
}

// Get notification tone (with caching and promise deduping)
export async function getNotificationTone(hotelId, toneUrl, _backendUrl, token) {
  // Check cache first: if the toneUrl doesn't match, it's a stale cache (user uploaded a new tone)
  const cached = await getCachedTone(hotelId);
  if (cached?.blob && cached.toneUrl === toneUrl) {
    return cached.blob;
  }

  // Dedupe simultaneous requests for the same tone
  if (pendingDownloads.has(toneUrl)) {
    return pendingDownloads.get(toneUrl);
  }

  const downloadPromise = (async () => {
    try {
      // Get signed URL from backend
      const data = await request({
        endpoint: `/hotels/${hotelId}/notification-tone/signed-url`,
        method: 'GET',
        token,
      });
      if (!data) throw new Error('Failed to get signed URL');
      const { signedUrl, isBuiltIn } = data;

      // Handle built-in tones
      if (isBuiltIn) {
        return null; // Frontend will load from /assets/tones/
      }

      // Download tone from signed URL
      const toneResponse = await fetch(signedUrl);
      if (!toneResponse.ok) {
        throw new Error(`Failed to download tone: ${toneResponse.status}`);
      }

      const blob = await toneResponse.blob();

      // Cache for future use (overwrites old tone for this hotelId)
      await cacheTone(hotelId, toneUrl, blob);

      return blob;
    } catch (error) {
      return null;
    } finally {
      // Clean up the pending promise once resolved or rejected
      pendingDownloads.delete(toneUrl);
    }
  })();

  pendingDownloads.set(toneUrl, downloadPromise);
  return downloadPromise;
}

// Convert blob to audio element
export function createAudioFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  return audio;
}