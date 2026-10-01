import { GoogleGenAI, Type } from "@google/genai";
import { MedicationInfo } from "../types";
import { LOCAL_MEDICATIONS_DB, findLocalMedication } from "../data/localMedicationsDb";
import { getCachedSearchFromDB, saveCachedSearchToDB } from "./indexedDbService";

let aiInstance: GoogleGenAI | null = null;

// Modèles ordonnés par VITESSE de réponse (les modèles lite répondent en moins de 1 à 2 secondes)
export const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite", // Ultra-rapide (~600ms - 2s), idéal pour la recherche instantanée
  "gemini-3.1-flash-lite", // Très rapide en secours
  "gemini-3.6-flash",      // Flash standard
  "gemini-flash-latest",   // Modèle de référence
  "gemini-3.8-flash"       // Fallback
];

// Gestion du cache local ultra-rapide (0 ms)
const CACHE_PREFIX = "pharmaguide_fast_cache_";

export const getCachedMedication = (query: string, context: string): MedicationInfo | null => {
  try {
    const cleanKey = `${CACHE_PREFIX}${query.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}_${(context || "").trim().toLowerCase()}`;
    const cached = sessionStorage.getItem(cleanKey) || localStorage.getItem(cleanKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    // Ignore storage errors
  }
  return null;
};

export const setCachedMedication = (query: string, context: string, data: MedicationInfo) => {
  try {
    const cleanKey = `${CACHE_PREFIX}${query.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}_${(context || "").trim().toLowerCase()}`;
    const serialized = JSON.stringify(data);
    sessionStorage.setItem(cleanKey, serialized);
    localStorage.setItem(cleanKey, serialized);
  } catch (e) {
    // Ignore quota errors
  }
};

export const setCustomApiKey = (key: string) => {
  const trimmedKey = key.trim();
  if (trimmedKey) {
    localStorage.setItem("pharmaguide_custom_gemini_api_key", trimmedKey);
  } else {
    localStorage.removeItem("pharmaguide_custom_gemini_api_key");
  }
  aiInstance = null; // Réinitialiser l'instance pour appliquer la nouvelle clé
};

export const getStoredApiKey = (): string => {
  return localStorage.getItem("pharmaguide_custom_gemini_api_key") || "";
};

export const getEffectiveApiKey = (): string => {
  let apiKey = localStorage.getItem("pharmaguide_custom_gemini_api_key");
  if (!apiKey) {
    apiKey = (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) || "";
  }
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
  }
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    apiKey = (import.meta as any).env?.GEMINI_API_KEY || "";
  }
  return (apiKey || "").trim();
};

const getAI = () => {
  if (!aiInstance) {
    const apiKey = getEffectiveApiKey();
    
    if (!apiKey || apiKey === "undefined" || apiKey === "") {
      throw new Error(
        "Service de recherche en ligne temporairement indisponible. Veuillez vérifier votre connexion."
      );
    }
    
    aiInstance = new GoogleGenAI({
      apiKey
    });
  }
  return aiInstance;
};

// Exécute une promesse avec un délai maximal (timeout) pour basculer rapidement sans bloquer l'utilisateur
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Exécute une opération avec bascule automatique sur les modèles compatibles si un modèle est lent, déprécié ou indisponible (404/503/timeout)
async function callGeminiWithFallback<T>(
  ai: GoogleGenAI,
  operation: (model: string) => Promise<T>,
  timeoutPerModelMs: number = 8500
): Promise<T> {
  let lastError: any = null;
  
  for (const model of CANDIDATE_MODELS) {
    try {
      return await withTimeout(
        operation(model),
        timeoutPerModelMs,
        `Timeout de réponse (> ${timeoutPerModelMs / 1000}s) sur ${model}`
      );
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err);
      
      // Erreur de modèle 404 (non trouvé), modèle déprécié, timeout ou surchargé : passer au modèle suivant sans attendre
      if (
        msg.includes("404") ||
        msg.includes("not found") ||
        msg.includes("no longer available") ||
        msg.includes("not supported") ||
        msg.includes("is no longer available to new users") ||
        msg.includes("Timeout") ||
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("high demand") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("429")
      ) {
        console.warn(`[PharmaGuide] Bascule rapide depuis "${model}" : ${msg.slice(0, 90)}...`);
        continue;
      }
      
      // Erreur d'authentification ou clé révoquée / fuité : ne pas boucler inutilement
      if (
        msg.includes("leaked") ||
        msg.includes("API key was reported as leaked")
      ) {
        throw new Error("Clé API signalée comme publique ou révoquée par Google. Veuillez configurer votre propre clé API gratuite depuis les Paramètres pour effectuer des recherches en ligne.");
      }
      if (msg.includes("API_KEY_INVALID")) {
        throw new Error("Clé API invalide : vérifiez votre clé Google AI Studio (commence par AIzaSy...).");
      }
      if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
        throw new Error("Accès refusé par Google Gemini (403). Veuillez renseigner votre clé API personnelle sans restriction.");
      }
    }
  }
  throw lastError;
}

// Fonction de test direct de la validité de la clé
export const testApiKeyValidity = async (keyToTest?: string): Promise<{ success: boolean; message: string }> => {
  try {
    const key = keyToTest ? keyToTest.trim() : getEffectiveApiKey();
    if (!key) {
      return { success: false, message: "Aucune clé API fournie." };
    }
    const testAI = new GoogleGenAI({
      apiKey: key
    });
    
    let lastErr: any = null;
    for (const model of CANDIDATE_MODELS) {
      try {
        const res = await testAI.models.generateContent({
          model,
          contents: "ping",
        });
        if (res.text) {
          return { success: true, message: `Connexion réussie avec l'IA (${model}) !` };
        }
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || err);
        if (msg.includes("404") || msg.includes("not found") || msg.includes("no longer available")) {
          continue;
        }
        if (msg.includes("leaked") || msg.includes("API key was reported as leaked")) {
          return {
            success: false,
            message: "Cette clé a été révoquée par Google (marquée comme compromise/publique). Rendez-vous sur aistudio.google.com/app/apikey pour en créer une nouvelle gratuitement."
          };
        }
        if (msg.includes("permission denied") || msg.includes("403")) {
          return { 
            success: false, 
            message: "Accès refusé (403 Permission Denied) : vérifiez que la clé n'a aucune restriction d'URL/IP dans Google Cloud Console et que l'API Generative Language est active." 
          };
        }
        if (msg.includes("API_KEY_INVALID")) {
          return { success: false, message: "Clé API invalide : vérifiez le copier-coller (commence généralement par AIzaSy...)." };
        }
        throw err;
      }
    }
    throw lastErr;
  } catch (err: any) {
    console.error("Test API Key Error:", err);
    const msg = err?.message || String(err);
    return { success: false, message: `Erreur : ${msg}` };
  }
};

const medicationSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Nom officiel ou commercial du médicament" },
    description: { type: Type.STRING, description: "Brève description pharmacologique" },
    indications: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Liste des symptômes ou maladies traités (Soulagement)"
    },
    maxDailyDosage: {
      type: Type.OBJECT,
      description: "Dosage maximum du médicament par jour (24 heures) selon les indications et profils de patients",
      properties: {
        generalMax: {
          type: Type.STRING,
          description: "Dose maximale de référence par 24 heures pour un adulte ou dose plafond absolue (ex: '3 000 mg (3 g) par jour - jusqu'à 4 g max sous surveillance médicale')"
        },
        byIndication: {
          type: Type.ARRAY,
          description: "Détail du dosage maximal journalier pour chaque indication ou catégorie de patient",
          items: {
            type: Type.OBJECT,
            properties: {
              indication: { type: Type.STRING, description: "Nom de l'indication ou profil (ex: 'Douleur / Fièvre chez l'adulte (> 50 kg)', 'Enfant selon le poids', 'Crise aiguë')" },
              maxDaily: { type: Type.STRING, description: "Dose maximale par 24h (ex: '3 g / 24h (max 4 g/24h sur ordonnance)')" },
              frequencyOrInterval: { type: Type.STRING, description: "Dose par prise et intervalle minimal (ex: '500 mg à 1 000 mg par prise, espacer de 4 à 6 heures minimum')" },
              notes: { type: Type.STRING, description: "Précisions ou avertissements spécifiques" }
            },
            required: ["indication", "maxDaily"]
          }
        },
        safetyWarning: {
          type: Type.STRING,
          description: "Mise en garde vitale sur le surdosage et la toxicité en cas de dépassement du dosage maximal journalier"
        }
      },
      required: ["generalMax", "byIndication"]
    },
    contraindications: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Liste des situations où il ne faut JAMAIS prendre ce médicament (Interdictions formelles)"
    },
    interactions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Liste des interactions dangereuses (avec d'autres médicaments, alcool, etc.)"
    },
    alternatives: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Médicaments ou solutions alternatives plus sûres ou courantes"
    },
    warningLevel: {
      type: Type.STRING,
      enum: ["low", "medium", "high"],
      description: "Niveau de dangerosité générale ou de vigilance requis"
    },
    usageTips: { type: Type.STRING, description: "Conseil d'utilisation rapide (ex: prendre pendant les repas)" }
  },
  required: ["name", "description", "indications", "maxDailyDosage", "contraindications", "interactions", "alternatives", "warningLevel", "usageTips"]
};

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

export const identifyMedicationFromBarcode = async (barcode: string): Promise<string> => {
  try {
    const ai = getAI();
    return await callGeminiWithFallback(ai, async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: `Quel est le nom commercial du médicament français ou international associé au code-barres / CIP / EAN : "${barcode}" ? Réponds UNIQUEMENT par le nom du médicament (exemple : "Doliprane 1000mg", "Spasfon 80mg", "Dafalgan 1g") sans guillemets, sans politesse et sans texte d'accompagnement. Si tu n'as pas le nom exact, retourne uniquement le nom générique ou la molécule la plus probable.`,
      });
      const result = response.text?.trim() || barcode;
      return result.replace(/^["']|["']$/g, '');
    });
  } catch (error) {
    console.error("Erreur lors de la recherche du code-barres:", error);
    return barcode;
  }
};

export const identifyMedicationFromImage = async (base64ImageDataUrl: string): Promise<string> => {
  try {
    const ai = getAI();
    const matches = base64ImageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) throw new Error("Format d'image invalide");
    
    const mimeType = matches[1];
    const base64Data = matches[2];

    return await callGeminiWithFallback(ai, async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          "Analyse cette image de boîte de médicament ou de son code-barres/DataMatrix. Identifie le nom commercial du médicament écrit sur la boîte ou encodé dans le code (ex: Doliprane 1000mg, Spasfon, Dafalgan 1g, Advil 200mg). Réponds UNIQUEMENT avec le nom du médicament, sans explications, sans saut de ligne et sans guillemets.",
        ],
      });

      const name = response.text?.trim() || "";
      if (name) return name.replace(/^["']|["']$/g, '');
      throw new Error("Impossible d'identifier le médicament sur la photo.");
    });
  } catch (error: any) {
    console.error("Erreur identification photo:", error);
    throw new Error(error?.message || "Analyse visuelle échouée. Veuillez réessayer avec une photo plus nette.");
  }
};

export const fetchMedicationInfo = async (medicationName: string, userContext: string = ""): Promise<MedicationInfo> => {
  // 1. Recherche instantanée dans la base locale complète et via les alias (0 ms)
  const localMatch = findLocalMedication(medicationName);
  if (localMatch) {
    console.log(`[PharmaGuide] Données pré-vérifiées trouvées instantanément en local pour "${medicationName}".`);
    return localMatch;
  }

  // 2. Recherche instantanée dans le cache mémoire / session (0 ms)
  const cachedMatch = getCachedMedication(medicationName, userContext);
  if (cachedMatch) {
    console.log(`[PharmaGuide] Données récupérées instantanément depuis le cache pour "${medicationName}".`);
    return cachedMatch;
  }

  // 3. Recherche dans la base de données IndexedDB (accès persistant hors-ligne)
  try {
    const idbMatch = await getCachedSearchFromDB(medicationName);
    if (idbMatch) {
      console.log(`[PharmaGuide] Données récupérées depuis IndexedDB pour "${medicationName}".`);
      setCachedMedication(medicationName, userContext, idbMatch);
      return idbMatch;
    }
  } catch (e) {
    // Non bloquant
  }

  const ai = getAI();
  const contextPrompt = userContext 
    ? `IMPORTANT : L'utilisateur a le profil de santé suivant : "${userContext}". Analyse s'il existe des risques spécifiques, des ajustements posologiques ou des contre-indications majeures liées à ce profil pour ce médicament et mentionne-les explicitement.`
    : "";

  const contents = `Donne-moi des informations médicales précises et structurées pour le médicament : "${medicationName}".
${contextPrompt}

Points cruciaux à inclure :
1. Précise le DOSAGE MAXIMUM PAR JOUR (sur 24 heures consécutives) selon chaque indication thérapeutique (ex: adulte > 50kg pour douleurs/fièvre, enfant selon le poids, crise migraineuse, etc.).
2. Pour chaque indication, précise la dose maximale par prise et l'intervalle minimal obligatoire entre deux prises consécutives.
3. Fournis une mise en garde explicite sur les risques de toxicité et de surdosage si la dose journalière maximale est dépassée.
4. Réponds UNIQUEMENT au format JSON strict selon le schéma fourni.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: medicationSchema,
    systemInstruction: "Tu es un assistant pharmacien hospitalier et d'officine expert et rigoureux. Tu fournis des données pharmacologiques précises, fiables et à jour en français. Tu portes une attention extrême à la posologie maximale sur 24 heures et aux intervalles minimaux entre chaque prise pour prévenir les surdosages graves."
  };

  const result = await callGeminiWithFallback(ai, async (model) => {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });

      const text = response.text;
      if (!text) throw new Error("Aucune réponse générée par l'IA.");

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      const cleanedText = jsonStr.replace(/```json\n?|```/g, "").trim();
      
      const parsed = JSON.parse(cleanedText);
      return sanitizeMedicationInfo(parsed, medicationName);
    } catch (err: any) {
      const msg = String(err?.message || err);
      // Si le modèle a échoué à cause du modèle 404, propager pour déclencher le fallback de modèle
      if (
        msg.includes("404") ||
        msg.includes("not found") ||
        msg.includes("no longer available") ||
        msg.includes("not supported") ||
        msg.includes("is no longer available to new users")
      ) {
        throw err;
      }

      // Si c'est un problème de réponse JSON ou de formatage, tenter sans responseSchema strict
      console.warn(`[PharmaGuide] Tentative simplifiée sur ${model}...`);
      const retryResponse = await ai.models.generateContent({
        model,
        contents: `${contents}\n\nFormat attendu JSON valide avec clés: name, description, indications, maxDailyDosage, contraindications, interactions, alternatives, warningLevel, usageTips.`,
        config: {
          responseMimeType: "application/json"
        }
      });

      const fallbackText = retryResponse.text;
      if (!fallbackText) throw err;

      const jsonMatch = fallbackText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : fallbackText;
      const cleanedText = jsonStr.replace(/```json\n?|```/g, "").trim();
      
      const parsed = JSON.parse(cleanedText);
      return sanitizeMedicationInfo(parsed, medicationName);
    }
  });

  // Mise en cache immédiate pour que toute consultation ultérieure soit instantanée (Mémoire + IndexedDB)
  if (result) {
    setCachedMedication(medicationName, userContext, result);
    saveCachedSearchToDB(medicationName, result).catch(() => {});
  }

  return result;
};
