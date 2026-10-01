import { MedicationInfo } from "../types";

const DB_NAME = "PharmaGuideDB";
const DB_VERSION = 1;

export interface StoredMedication extends MedicationInfo {
  id: string; // Nom normalisé unique
  addedAt: number;
  userNotes?: string;
}

export interface StoredSetting {
  key: string;
  value: any;
  updatedAt: number;
}

export interface CachedMedicationRecord {
  query: string;
  data: MedicationInfo;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

// Vérifie si IndexedDB est supporté dans l'environnement actuel
export const isIndexedDBSupported = (): boolean => {
  try {
    return typeof window !== "undefined" && "indexedDB" in window && window.indexedDB !== null;
  } catch {
    return false;
  }
};

// Initialise et ouvre la connexion IndexedDB avec gestion des versions
export const getDatabase = (): Promise<IDBDatabase> => {
  if (!isIndexedDBSupported()) {
    return Promise.reject(new Error("IndexedDB n'est pas supporté par ce navigateur."));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store 1 : Mes Médicaments (Pharmacie du patient)
        if (!db.objectStoreNames.contains("medications")) {
          const medStore = db.createObjectStore("medications", { keyPath: "id" });
          medStore.createIndex("name", "name", { unique: false });
          medStore.createIndex("addedAt", "addedAt", { unique: false });
        }

        // Store 2 : Préférences et Profil Santé
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }

        // Store 3 : Cache hors-ligne des recherches IA
        if (!db.objectStoreNames.contains("cached_searches")) {
          const cacheStore = db.createObjectStore("cached_searches", { keyPath: "query" });
          cacheStore.createIndex("timestamp", "timestamp", { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error("[IndexedDB] Erreur lors de l'ouverture de la base :", request.error);
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn("[IndexedDB] Base de données bloquée par une autre connexion ouverte.");
      };
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
};

// Normalisation des clés pour cohérence
export const normalizeMedKey = (name: string): string => {
  return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// ============================================================================
// GESTION DES MÉDICAMENTS (PHARMACIE)
// ============================================================================

export const getAllMedicationsFromDB = async (): Promise<MedicationInfo[]> => {
  if (!isIndexedDBSupported()) {
    // Fallback localStorage
    try {
      const raw = localStorage.getItem("pharmaguide_list");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  try {
    const db = await getDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction("medications", "readonly");
      const store = tx.objectStore("medications");
      const request = store.getAll();

      request.onsuccess = () => {
        const records: StoredMedication[] = request.result || [];
        // Trier par date d'ajout décroissante
        records.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        resolve(records);
      };

      request.onerror = () => {
        console.warn("[IndexedDB] Échec de getAllMedications, repli sur localStorage");
        const raw = localStorage.getItem("pharmaguide_list");
        resolve(raw ? JSON.parse(raw) : []);
      };
    });
  } catch (err) {
    console.warn("[IndexedDB] Exception getAllMedications :", err);
    const raw = localStorage.getItem("pharmaguide_list");
    return raw ? JSON.parse(raw) : [];
  }
};

export const saveMedicationToDB = async (med: MedicationInfo): Promise<void> => {
  const id = normalizeMedKey(med.name);
  const record: StoredMedication = {
    ...med,
    id,
    addedAt: Date.now()
  };

  if (isIndexedDBSupported()) {
    try {
      const db = await getDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("medications", "readwrite");
        const store = tx.objectStore("medications");
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("[IndexedDB] Erreur saveMedicationToDB :", e);
    }
  }

  // Double sauvegarde miroir dans localStorage pour compatibilité instantanée
  try {
    const raw = localStorage.getItem("pharmaguide_list");
    const list: MedicationInfo[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(m => normalizeMedKey(m.name) !== id);
    localStorage.setItem("pharmaguide_list", JSON.stringify([record, ...filtered]));
  } catch {
    // Ignore quota issues
  }
};

export const removeMedicationFromDB = async (name: string): Promise<void> => {
  const id = normalizeMedKey(name);

  if (isIndexedDBSupported()) {
    try {
      const db = await getDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("medications", "readwrite");
        const store = tx.objectStore("medications");
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("[IndexedDB] Erreur removeMedicationFromDB :", e);
    }
  }

  // Mise à jour miroir dans localStorage
  try {
    const raw = localStorage.getItem("pharmaguide_list");
    if (raw) {
      const list: MedicationInfo[] = JSON.parse(raw);
      const filtered = list.filter(m => normalizeMedKey(m.name) !== id);
      localStorage.setItem("pharmaguide_list", JSON.stringify(filtered));
    }
  } catch {
    // Ignore
  }
};

export const clearAllMedicationsInDB = async (): Promise<void> => {
  if (isIndexedDBSupported()) {
    try {
      const db = await getDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("medications", "readwrite");
        const store = tx.objectStore("medications");
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("[IndexedDB] Erreur clearAllMedicationsInDB :", e);
    }
  }
  localStorage.removeItem("pharmaguide_list");
};

// ============================================================================
// GESTION DU PROFIL SANTÉ & PARAMÈTRES
// ============================================================================

export const getSettingFromDB = async <T = any>(key: string, defaultValue: T): Promise<T> => {
  if (!isIndexedDBSupported()) {
    const raw = localStorage.getItem(`pharmaguide_${key}`);
    return raw !== null ? (raw as unknown as T) : defaultValue;
  }

  try {
    const db = await getDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction("settings", "readonly");
      const store = tx.objectStore("settings");
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.value !== undefined) {
          resolve(req.result.value);
        } else {
          // Vérifier fallback localStorage
          const localVal = localStorage.getItem(`pharmaguide_${key}`);
          resolve(localVal !== null ? (localVal as unknown as T) : defaultValue);
        }
      };
      req.onerror = () => {
        const localVal = localStorage.getItem(`pharmaguide_${key}`);
        resolve(localVal !== null ? (localVal as unknown as T) : defaultValue);
      };
    });
  } catch {
    const localVal = localStorage.getItem(`pharmaguide_${key}`);
    return localVal !== null ? (localVal as unknown as T) : defaultValue;
  }
};

export const saveSettingToDB = async (key: string, value: any): Promise<void> => {
  if (isIndexedDBSupported()) {
    try {
      const db = await getDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("settings", "readwrite");
        const store = tx.objectStore("settings");
        const req = store.put({ key, value, updatedAt: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("[IndexedDB] Erreur saveSettingToDB :", e);
    }
  }

  // Miroir localStorage
  try {
    if (typeof value === "string") {
      localStorage.setItem(`pharmaguide_${key}`, value);
    } else {
      localStorage.setItem(`pharmaguide_${key}`, JSON.stringify(value));
    }
  } catch {
    // Ignore
  }
};

// ============================================================================
// CACHE HORS-LIGNE DES RECHERCHES DANS INDEXEDDB
// ============================================================================

export const getCachedSearchFromDB = async (query: string): Promise<MedicationInfo | null> => {
  if (!isIndexedDBSupported()) return null;
  const key = normalizeMedKey(query);

  try {
    const db = await getDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction("cached_searches", "readonly");
      const store = tx.objectStore("cached_searches");
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve(req.result.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const saveCachedSearchToDB = async (query: string, data: MedicationInfo): Promise<void> => {
  if (!isIndexedDBSupported()) return;
  const key = normalizeMedKey(query);

  try {
    const db = await getDatabase();
    const tx = db.transaction("cached_searches", "readwrite");
    const store = tx.objectStore("cached_searches");
    store.put({
      query: key,
      data,
      timestamp: Date.now()
    });
  } catch {
    // Silently ignore cache write errors
  }
};

// ============================================================================
// MIGRATION INITIALE AUTOMATIQUE & SAUVEGARDE
// ============================================================================

export const syncAndMigrateLocalStorageToIndexedDB = async (): Promise<{
  medicationsCount: number;
  userContext: string;
}> => {
  console.log("[IndexedDB] Synchronisation de démarrage...");

  // 1. Médicaments
  let currentMeds = await getAllMedicationsFromDB();
  const rawLocalMeds = localStorage.getItem("pharmaguide_list");

  if (rawLocalMeds) {
    try {
      const parsedLocal: MedicationInfo[] = JSON.parse(rawLocalMeds);
      if (Array.isArray(parsedLocal) && parsedLocal.length > 0) {
        // Fusionner avec IndexedDB
        for (const med of parsedLocal) {
          const exists = currentMeds.some(m => normalizeMedKey(m.name) === normalizeMedKey(med.name));
          if (!exists) {
            await saveMedicationToDB(med);
          }
        }
        currentMeds = await getAllMedicationsFromDB();
      }
    } catch (e) {
      console.error("[IndexedDB] Erreur lors de la migration des médicaments :", e);
    }
  }

  // 2. Profil santé
  let currentContext = await getSettingFromDB<string>("context", "");
  const localContext = localStorage.getItem("pharmaguide_context");
  if (!currentContext && localContext) {
    currentContext = localContext;
    await saveSettingToDB("context", currentContext);
  }

  return {
    medicationsCount: currentMeds.length,
    userContext: currentContext
  };
};

// Exportation complète au format JSON pour transfert entre appareils sans cloud
export const exportPharmacyBackupJSON = async (): Promise<string> => {
  const meds = await getAllMedicationsFromDB();
  const context = await getSettingFromDB<string>("context", "");

  const backupData = {
    version: 1,
    exportDate: new Date().toISOString(),
    appName: "PharmaGuide",
    userContext: context,
    medications: meds
  };

  return JSON.stringify(backupData, null, 2);
};

// Importation d'une sauvegarde JSON depuis un autre appareil
export const importPharmacyBackupJSON = async (jsonString: string): Promise<{ success: boolean; importedCount: number; message: string }> => {
  try {
    const data = JSON.parse(jsonString);
    if (!data || !Array.isArray(data.medications)) {
      return { success: false, importedCount: 0, message: "Format de fichier invalide ou corrompu." };
    }

    let count = 0;
    for (const med of data.medications) {
      if (med && med.name) {
        await saveMedicationToDB(med);
        count++;
      }
    }

    if (data.userContext && typeof data.userContext === "string") {
      await saveSettingToDB("context", data.userContext);
    }

    return {
      success: true,
      importedCount: count,
      message: `${count} médicament(s) synchronisé(s) avec succès dans votre pharmacie !`
    };
  } catch (err: any) {
    return {
      success: false,
      importedCount: 0,
      message: `Erreur d'importation : ${err?.message || "Fichier JSON non reconnu."}`
    };
  }
};
