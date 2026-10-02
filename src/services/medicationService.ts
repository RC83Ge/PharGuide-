import { MedicationInfo } from "../types";
import { findLocalMedication } from "../data/localMedicationsDb";
import { getCachedSearchFromDB, saveCachedSearchToDB } from "./indexedDbService";

// Les requêtes IA passent par la fonction serveur /api/gemini : la clé Gemini ne quitte jamais le serveur.
// Sur le web, l'API est sur le même domaine. Dans l'appli Android, VITE_API_BASE_URL pointe vers le site Vercel.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 45_000;

// Gestion du cache local ultra-rapide (0 ms)
const CACHE_PREFIX = "pharmaguide_fast_cache_";

const cacheKey = (query: string, context: string) =>
  `${CACHE_PREFIX}${query.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}_${(context || "").trim().toLowerCase()}`;

const getCachedMedication = (query: string, context: string): MedicationInfo | null => {
  try {
    const key = cacheKey(query, context);
    const cached = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch {
    // Ignore storage errors
  }
  return null;
};

const setCachedMedication = (query: string, context: string, data: MedicationInfo) => {
  try {
    const key = cacheKey(query, context);
    const serialized = JSON.stringify(data);
    sessionStorage.setItem(key, serialized);
    localStorage.setItem(key, serialized);
  } catch {
    // Ignore quota errors
  }
};

async function callApi<T>(payload: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/gemini`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch {
    throw new Error("Service de recherche en ligne injoignable. Vérifiez votre connexion internet.");
  } finally {
    clearTimeout(timer);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || "Une erreur est survenue lors de l'analyse. Veuillez réessayer.");
  }
  return body as T;
}

function sanitizeMedicationInfo(raw: any, fallbackName: string): MedicationInfo {
  return {
    name: raw?.name || fallbackName,
    description: raw?.description || "Description médicale non disponible.",
    indications: Array.isArray(raw?.indications) ? raw.indications : [],
    maxDailyDosage: {
      generalMax: raw?.maxDailyDosage?.generalMax || "Consulter la notice médicale",
      byIndication: Array.isArray(raw?.maxDailyDosage?.byIndication) ? raw.maxDailyDosage.byIndication : [],
      safetyWarning: raw?.maxDailyDosage?.safetyWarning || "Ne jamais dépasser la dose maximale prescrite ou recommandée."
    },
    contraindications: Array.isArray(raw?.contraindications) ? raw.contraindications : [],
    interactions: Array.isArray(raw?.interactions) ? raw.interactions : [],
    alternatives: Array.isArray(raw?.alternatives) ? raw.alternatives : [],
    warningLevel: (["low", "medium", "high"].includes(raw?.warningLevel) ? raw.warningLevel : "medium") as "low" | "medium" | "high",
    usageTips: raw?.usageTips || "Respectez scrupuleusement les consignes de votre médecin ou pharmacien."
  };
}

// Réduit la photo avant envoi : les photos de téléphone dépassent souvent la taille acceptée par le serveur
function downscaleImage(dataUrl: string, maxSide = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Identifie un médicament par son code CIP13 dans la base officielle (BDPM).
// Lève une erreur avec un message lisible si le code est inconnu ou la base injoignable.
export const identifyMedicationFromBarcode = async (cip13: string): Promise<string> => {
  if (!navigator.onLine) throw new Error("Vous êtes hors ligne. Le scan nécessite une connexion.");
  const { name } = await callApi<{ name: string }>({ action: "barcode", barcode: cip13 });
  return name;
};

export const identifyMedicationFromImage = async (imageDataUrl: string): Promise<string> => {
  if (!/^data:image\//.test(imageDataUrl)) throw new Error("Format d'image invalide");
  const image = await downscaleImage(imageDataUrl);
  const { name } = await callApi<{ name: string }>({ action: "image", image });
  return name;
};

const offlineError = () =>
  new Error("Vous êtes hors ligne. Seuls les médicaments de la base locale et les fiches déjà consultées sont disponibles.");

export const fetchMedicationInfo = async (medicationName: string, userContext: string = ""): Promise<MedicationInfo> => {
  // 1. Base locale vérifiée et alias (0 ms)
  const localMatch = findLocalMedication(medicationName);
  if (localMatch) return localMatch;

  // 2. Cache mémoire / session (0 ms)
  const cachedMatch = getCachedMedication(medicationName, userContext);
  if (cachedMatch) return cachedMatch;

  // 3. IndexedDB (accès persistant hors-ligne)
  try {
    const idbMatch = await getCachedSearchFromDB(medicationName);
    if (idbMatch) {
      setCachedMedication(medicationName, userContext, idbMatch);
      return idbMatch;
    }
  } catch {
    // Non bloquant
  }

  // 4. Recherche en ligne via le serveur
  if (!navigator.onLine) throw offlineError();
  const { data } = await callApi<{ data: unknown }>({ action: "info", name: medicationName, context: userContext });
  const result = sanitizeMedicationInfo(data, medicationName);

  setCachedMedication(medicationName, userContext, result);
  saveCachedSearchToDB(medicationName, result).catch(() => {});
  return result;
};

export interface InteractionItem {
  medications: string[];
  severity: "low" | "medium" | "high";
  description: string;
  advice: string;
}

export interface InteractionReport {
  summary: string;
  interactions: InteractionItem[];
  profileWarnings: string[];
  checkedAt: string;
  medications: string[];
}

const INTERACTIONS_CACHE_KEY = "pharmaguide_interactions_report";

const interactionsCacheId = (names: string[], context: string) =>
  JSON.stringify([[...names].map(n => n.toLowerCase()).sort(), context.trim().toLowerCase()]);

// Dernier rapport, s'il correspond toujours à la pharmacie et au profil actuels
export const getCachedInteractionReport = (names: string[], context: string): InteractionReport | null => {
  try {
    const cached = JSON.parse(localStorage.getItem(INTERACTIONS_CACHE_KEY) || "null");
    if (cached?.id === interactionsCacheId(names, context)) return cached.report;
  } catch {
    // Ignore storage errors
  }
  return null;
};

export const checkPharmacyInteractions = async (names: string[], context: string): Promise<InteractionReport> => {
  const cached = getCachedInteractionReport(names, context);
  if (cached) return cached;
  if (!navigator.onLine) throw new Error("Vous êtes hors ligne. La vérification des interactions nécessite une connexion.");

  const { data } = await callApi<{ data: any }>({ action: "interactions", names, context });
  const severities = ["low", "medium", "high"];
  const report: InteractionReport = {
    summary: data?.summary || "",
    interactions: (Array.isArray(data?.interactions) ? data.interactions : [])
      .filter((i: any) => i && Array.isArray(i.medications))
      .map((i: any) => ({
        medications: i.medications.map(String),
        severity: severities.includes(i.severity) ? i.severity : "medium",
        description: i.description || "",
        advice: i.advice || ""
      })),
    profileWarnings: Array.isArray(data?.profileWarnings) ? data.profileWarnings.map(String) : [],
    checkedAt: new Date().toISOString(),
    medications: names
  };

  try {
    localStorage.setItem(INTERACTIONS_CACHE_KEY, JSON.stringify({ id: interactionsCacheId(names, context), report }));
  } catch {
    // Ignore quota errors
  }
  return report;
};
