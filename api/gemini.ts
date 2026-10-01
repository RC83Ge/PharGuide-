// Fonction serveur Vercel : seul endroit où la clé Gemini est utilisée.
// Le navigateur et l'appli Android appellent POST /api/gemini et ne voient jamais la clé.
import { GoogleGenAI, Type } from "@google/genai";

// Modèles ordonnés par vitesse de réponse ; on bascule sur le suivant en cas d'indisponibilité
const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.8-flash"
];

const TIMEOUT_PER_MODEL_MS = 8500;
const MAX_NAME_LENGTH = 120;
const MAX_CONTEXT_LENGTH = 1500;
const MAX_IMAGE_BASE64_LENGTH = 4_000_000; // Limite de corps des fonctions Vercel : 4,5 Mo

// Origines autorisées en plus du site lui-même : l'appli Android (Capacitor) et le développement local
const EXTRA_ALLOWED_ORIGINS = [
  "https://localhost",
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:3000"
];

const SYSTEM_INSTRUCTION =
  "Tu es un assistant pharmacien hospitalier et d'officine expert et rigoureux. Tu fournis des données pharmacologiques précises, fiables et à jour en français. Tu portes une attention extrême à la posologie maximale sur 24 heures et aux intervalles minimaux entre chaque prise pour prévenir les surdosages graves.";

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

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout (> ${ms / 1000}s)`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

const isModelUnavailable = (msg: string) =>
  /404|not found|no longer available|not supported|Timeout|503|UNAVAILABLE|high demand|RESOURCE_EXHAUSTED|429/.test(msg);

// Essaie chaque modèle dans l'ordre ; les erreurs de clé arrêtent tout de suite
async function callWithFallback<T>(operation: (model: string) => Promise<T>): Promise<T> {
  let lastError: unknown = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      return await withTimeout(operation(model), TIMEOUT_PER_MODEL_MS);
    } catch (err) {
      lastError = err;
      const msg = String((err as Error)?.message || err);
      if (/leaked|API_KEY_INVALID|PERMISSION_DENIED|403/.test(msg)) {
        console.error("[PharmaGuide] Clé Gemini refusée :", msg.slice(0, 200));
        throw new HttpError(503, "Service de recherche en ligne temporairement indisponible.");
      }
      if (isModelUnavailable(msg)) {
        console.warn(`[PharmaGuide] Bascule depuis "${model}" : ${msg.slice(0, 90)}`);
        continue;
      }
      throw err;
    }
  }
  const msg = String((lastError as Error)?.message || lastError);
  if (/429|RESOURCE_EXHAUSTED/.test(msg)) {
    throw new HttpError(429, "Limite temporaire de requêtes atteinte. Veuillez patienter une trentaine de secondes avant de réessayer.");
  }
  throw new HttpError(503, "Les serveurs de recherche connaissent actuellement une forte affluence. Veuillez réessayer dans quelques secondes.");
}

const stripQuotes = (text: string) => text.trim().replace(/^["']|["']$/g, "");

function parseJson(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const jsonStr = (jsonMatch ? jsonMatch[0] : text).replace(/```json\n?|```/g, "").trim();
  return JSON.parse(jsonStr);
}

async function medicationInfo(ai: GoogleGenAI, name: string, context: string) {
  const contextPrompt = context
    ? `IMPORTANT : L'utilisateur a le profil de santé suivant : "${context}". Analyse s'il existe des risques spécifiques, des ajustements posologiques ou des contre-indications majeures liées à ce profil pour ce médicament et mentionne-les explicitement.`
    : "";

  const contents = `Donne-moi des informations médicales précises et structurées pour le médicament : "${name}".
${contextPrompt}

Points cruciaux à inclure :
1. Précise le DOSAGE MAXIMUM PAR JOUR (sur 24 heures consécutives) selon chaque indication thérapeutique (ex: adulte > 50kg pour douleurs/fièvre, enfant selon le poids, crise migraineuse, etc.).
2. Pour chaque indication, précise la dose maximale par prise et l'intervalle minimal obligatoire entre deux prises consécutives.
3. Fournis une mise en garde explicite sur les risques de toxicité et de surdosage si la dose journalière maximale est dépassée.
4. Réponds UNIQUEMENT au format JSON strict selon le schéma fourni.`;

  return callWithFallback(async (model) => {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: medicationSchema,
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });
      if (!response.text) throw new Error("Aucune réponse générée par l'IA.");
      return parseJson(response.text);
    } catch (err) {
      const msg = String((err as Error)?.message || err);
      if (isModelUnavailable(msg) || /leaked|API_KEY_INVALID|PERMISSION_DENIED|403/.test(msg)) throw err;

      // Réponse mal formée : nouvel essai sans schéma strict
      console.warn(`[PharmaGuide] Tentative simplifiée sur ${model}...`);
      const retry = await ai.models.generateContent({
        model,
        contents: `${contents}\n\nFormat attendu JSON valide avec clés: name, description, indications, maxDailyDosage, contraindications, interactions, alternatives, warningLevel, usageTips.`,
        config: { responseMimeType: "application/json", systemInstruction: SYSTEM_INSTRUCTION }
      });
      if (!retry.text) throw err;
      return parseJson(retry.text);
    }
  });
}

async function nameFromBarcode(ai: GoogleGenAI, barcode: string) {
  return callWithFallback(async (model) => {
    const response = await ai.models.generateContent({
      model,
      contents: `Quel est le nom commercial du médicament français ou international associé au code-barres / CIP / EAN : "${barcode}" ? Réponds UNIQUEMENT par le nom du médicament (exemple : "Doliprane 1000mg", "Spasfon 80mg", "Dafalgan 1g") sans guillemets, sans politesse et sans texte d'accompagnement. Si tu n'as pas le nom exact, retourne uniquement le nom générique ou la molécule la plus probable.`
    });
    return stripQuotes(response.text || "") || barcode;
  });
}

async function nameFromImage(ai: GoogleGenAI, mimeType: string, data: string) {
  return callWithFallback(async (model) => {
    const response = await ai.models.generateContent({
      model,
      contents: [
        { inlineData: { mimeType, data } },
        "Analyse cette image de boîte de médicament ou de son code-barres/DataMatrix. Identifie le nom commercial du médicament écrit sur la boîte ou encodé dans le code (ex: Doliprane 1000mg, Spasfon, Dafalgan 1g, Advil 200mg). Réponds UNIQUEMENT avec le nom du médicament, sans explications, sans saut de ligne et sans guillemets."
      ]
    });
    const name = stripQuotes(response.text || "");
    if (!name) throw new HttpError(422, "Impossible d'identifier le médicament sur la photo.");
    return name;
  });
}

function requireString(value: unknown, field: string, maxLength: number, required = true): string {
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(400, `Champ "${field}" manquant.`);
    return "";
  }
  if (typeof value !== "string") throw new HttpError(400, `Champ "${field}" invalide.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new HttpError(413, `Champ "${field}" trop long.`);
  if (required && !trimmed) throw new HttpError(400, `Champ "${field}" manquant.`);
  return trimmed;
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const selfOrigin = new URL(request.url).origin;
  if (origin && (origin === selfOrigin || EXTRA_ALLOWED_ORIGINS.includes(origin))) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
  }
  return {};
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });

// Diagnostic : ouvrir /api/gemini dans le navigateur indique si la clé est présente et acceptée par Google.
// Ne renvoie jamais la clé elle-même.
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return json({ ok: false, problem: "GEMINI_API_KEY est absente pour cet environnement Vercel. Ajoutez-la puis redéployez." }, 200, {});
  }

  const ai = new GoogleGenAI({ apiKey });
  const errors: Record<string, string> = {};
  for (const model of CANDIDATE_MODELS) {
    try {
      await withTimeout(ai.models.generateContent({ model, contents: "ping" }), TIMEOUT_PER_MODEL_MS);
      return json({ ok: true, model, keyLength: apiKey.length }, 200, {});
    } catch (err) {
      errors[model] = String((err as Error)?.message || err).replaceAll(apiKey, "***").slice(0, 300);
    }
  }
  return json({ ok: false, problem: "Google refuse toutes les requêtes avec cette clé.", keyLength: apiKey.length, errors }, 200, {});
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const cors = corsHeaders(request);
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.error("[PharmaGuide] GEMINI_API_KEY n'est pas configurée sur le serveur.");
      throw new HttpError(503, "Service de recherche en ligne temporairement indisponible.");
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Requête invalide.");
    }

    const ai = new GoogleGenAI({ apiKey });

    switch (body?.action) {
      case "info": {
        const name = requireString(body.name, "name", MAX_NAME_LENGTH);
        const context = requireString(body.context, "context", MAX_CONTEXT_LENGTH, false);
        return json({ data: await medicationInfo(ai, name, context) }, 200, cors);
      }
      case "barcode": {
        const barcode = requireString(body.barcode, "barcode", MAX_NAME_LENGTH);
        return json({ name: await nameFromBarcode(ai, barcode) }, 200, cors);
      }
      case "image": {
        const image = requireString(body.image, "image", MAX_IMAGE_BASE64_LENGTH);
        const match = image.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
        if (!match) throw new HttpError(400, "Format d'image invalide.");
        return json({ name: await nameFromImage(ai, match[1], match[2]) }, 200, cors);
      }
      default:
        throw new HttpError(400, "Action inconnue.");
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: err.message }, err.status, cors);
    }
    console.error("[PharmaGuide] Erreur inattendue :", err);
    return json({ error: "Une erreur est survenue lors de l'analyse. Veuillez réessayer." }, 500, cors);
  }
}
