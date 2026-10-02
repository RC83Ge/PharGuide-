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
const MAX_INTERACTION_MEDS = 30;
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

// --- Base de données publique des médicaments (BDPM, ANSM) ---
// Les codes-barres des boîtes françaises contiennent le code CIP13 (EAN-13 ou DataMatrix GS1).
// On le cherche dans la base officielle avant de demander à l'IA, qui peut se tromper.
const BDPM_BASE_URL = "https://base-donnees-publique.medicaments.gouv.fr/download/file";
const BDPM_TIMEOUT_MS = 15_000;
const BDPM_CACHE_MS = 24 * 60 * 60 * 1000;

interface BdpmIndex {
  byCip13: Map<string, string>; // CIP13 -> CIS
  byCip7: Map<string, string>;  // CIP7 -> CIS
  names: Map<string, string>;   // CIS -> dénomination
  loadedAt: number;
}

let bdpmIndex: Promise<BdpmIndex> | null = null;

// Les fichiers BDPM ont longtemps été encodés en Windows-1252 ; on accepte les deux encodages
function decodeBdpm(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

async function fetchBdpmFile(name: string): Promise<string> {
  const response = await withTimeout(fetch(`${BDPM_BASE_URL}/${name}`), BDPM_TIMEOUT_MS);
  if (!response.ok) throw new Error(`BDPM ${name} : HTTP ${response.status}`);
  return decodeBdpm(await response.arrayBuffer());
}

function parseBdpm(cisFile: string, cipFile: string): BdpmIndex {
  const names = new Map<string, string>();
  for (const line of cisFile.split(/\r?\n/)) {
    const cols = line.split("\t");
    if (cols.length > 1 && cols[0].trim()) names.set(cols[0].trim(), cols[1].trim());
  }
  const byCip13 = new Map<string, string>();
  const byCip7 = new Map<string, string>();
  for (const line of cipFile.split(/\r?\n/)) {
    const cols = line.split("\t");
    if (cols.length < 7) continue;
    const cis = cols[0].trim();
    if (cols[1].trim()) byCip7.set(cols[1].trim(), cis);
    if (cols[6].trim()) byCip13.set(cols[6].trim(), cis);
  }
  return { byCip13, byCip7, names, loadedAt: Date.now() };
}

async function getBdpmIndex(): Promise<BdpmIndex> {
  if (bdpmIndex) {
    const index = await bdpmIndex.catch(() => null);
    if (index && Date.now() - index.loadedAt < BDPM_CACHE_MS) return index;
  }
  bdpmIndex = Promise.all([fetchBdpmFile("CIS_bdpm.txt"), fetchBdpmFile("CIS_CIP_bdpm.txt")])
    .then(([cis, cip]) => parseBdpm(cis, cip));
  bdpmIndex.catch(() => { bdpmIndex = null; });
  return bdpmIndex;
}

// Extrait le CIP13 (3400 + 9 chiffres) ou le CIP7 d'un code scanné, y compris d'un DataMatrix GS1 (01 + 0 + CIP13)
function isValidEan13(code: string): boolean {
  const sum = code.slice(0, 12).split("").reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

function extractCip(code: string): { cip13?: string; cip7?: string } {
  const digits = code.replace(/\D/g, "");
  const cip13 = digits.match(/3400\d{9}/)?.[0];
  if (cip13 && isValidEan13(cip13)) return { cip13 };
  if (/^\d{7}$/.test(digits)) return { cip7: digits };
  return {};
}

// "DOLIPRANE 1000 mg, comprimé" -> "DOLIPRANE 1000 mg"
const shortBdpmName = (denomination: string) => denomination.split(",")[0].trim();

function lookupBdpm(index: BdpmIndex, code: string): string | null {
  const { cip13, cip7 } = extractCip(code);
  const cis = (cip13 && index.byCip13.get(cip13)) || (cip7 && index.byCip7.get(cip7));
  const denomination = cis ? index.names.get(cis) : undefined;
  return denomination ? shortBdpmName(denomination) : null;
}

// Pas de repli sur l'IA à partir des chiffres : deviner un médicament d'après un code-barres donne des noms faux.
// Ordre : base officielle française (codes CIP), puis catalogues ouverts de produits (autres pays).
// Si rien n'est trouvé, le client lit le nom imprimé sur la boîte (action "image") et le fait confirmer.

async function nameFromOfficialDatabase(barcode: string): Promise<string | null> {
  const { cip13, cip7 } = extractCip(barcode);
  if (!cip13 && !cip7) return null;
  try {
    return lookupBdpm(await getBdpmIndex(), barcode);
  } catch (err) {
    console.error("[PharmaGuide] BDPM indisponible :", String(err).slice(0, 200));
    return null;
  }
}

// GTIN-13 d'un code : EAN-13 direct, ou champ (01) d'un DataMatrix GS1 (14 chiffres, dont un 0 en tête)
function extractGtin(code: string): string | null {
  const raw = code.replace(/[^\x20-\x7E]/g, "").trim();
  const gs1 = raw.match(/^(?:\]d2)?01(\d{14})/);
  if (gs1) return gs1[1].replace(/^0/, "");
  const digits = raw.replace(/\D/g, "");
  return /^\d{8}$|^\d{12,13}$/.test(digits) && digits === raw ? digits : null;
}

const CATALOG_HOSTS = ["world.openproductsfacts.org", "world.openbeautyfacts.org", "world.openfoodfacts.org"];

async function nameFromCatalog(gtin: string): Promise<string | null> {
  const lookups = CATALOG_HOSTS.map(async (host) => {
    const response = await withTimeout(
      fetch(`https://${host}/api/v2/product/${gtin}.json?fields=product_name,product_name_fr,brands`, {
        headers: { "User-Agent": "PharmaGuide/1.0 (https://pharma-swart-seven.vercel.app)" }
      }),
      6000
    );
    if (!response.ok) throw new Error(`${host}: ${response.status}`);
    const data = await response.json();
    const product = data?.product;
    const name = (product?.product_name_fr || product?.product_name || "").trim();
    if (data?.status !== 1 || !name) throw new Error(`${host}: inconnu`);
    const brand = String(product?.brands || "").split(",")[0].trim();
    return brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;
  });
  return Promise.any(lookups).catch(() => null);
}

async function identifyBarcode(barcode: string): Promise<{ name: string; source: "bdpm" | "catalog" }> {
  const official = await nameFromOfficialDatabase(barcode);
  if (official) return { name: official, source: "bdpm" };

  const gtin = extractGtin(barcode);
  const fromCatalog = gtin ? await nameFromCatalog(gtin) : null;
  if (fromCatalog) return { name: fromCatalog, source: "catalog" };

  throw new HttpError(404, "Code-barres inconnu des bases de médicaments.");
}

const interactionsSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Synthèse en une ou deux phrases du niveau de risque global de cette association de médicaments" },
    interactions: {
      type: Type.ARRAY,
      description: "Interactions cliniquement pertinentes entre deux médicaments de la liste (ou plus). Liste vide s'il n'y en a aucune.",
      items: {
        type: Type.OBJECT,
        properties: {
          medications: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Noms des médicaments concernés, tels qu'écrits dans la liste" },
          severity: { type: Type.STRING, enum: ["low", "medium", "high"], description: "high = association contre-indiquée ou dangereuse, medium = précaution d'emploi, low = à surveiller" },
          description: { type: Type.STRING, description: "Nature et mécanisme du risque, en langage simple" },
          advice: { type: Type.STRING, description: "Conduite à tenir concrète pour le patient" }
        },
        required: ["medications", "severity", "description", "advice"]
      }
    },
    profileWarnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Risques liés au profil santé du patient (allergies, grossesse, maladies) pour un médicament de la liste. Liste vide si aucun."
    }
  },
  required: ["summary", "interactions", "profileWarnings"]
};

async function checkInteractions(ai: GoogleGenAI, names: string[], context: string) {
  const contents = `Voici la liste des médicaments pris par un patient :
${names.map((n) => `- ${n}`).join("\n")}
${context ? `\nProfil santé du patient : "${context}".\n` : ""}
Analyse toutes les interactions médicamenteuses entre ces médicaments (y compris les doublons de principe actif, par exemple deux médicaments contenant du paracétamol), puis les risques liés au profil santé.
Ne mentionne que des interactions réelles et documentées. Réponds UNIQUEMENT au format JSON strict selon le schéma fourni.`;

  return callWithFallback(async (model) => {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: interactionsSchema,
        systemInstruction: SYSTEM_INSTRUCTION
      }
    });
    if (!response.text) throw new Error("Aucune réponse générée par l'IA.");
    return parseJson(response.text);
  });
}

async function nameFromImage(ai: GoogleGenAI, mimeType: string, data: string) {
  return callWithFallback(async (model) => {
    const response = await ai.models.generateContent({
      model,
      contents: [
        { inlineData: { mimeType, data } },
        "Lis le nom commercial du médicament IMPRIMÉ sur cette boîte, avec son dosage s'il est visible (ex : Inderal 40 mg, Doliprane 1000 mg, Ben-u-ron 500 mg). Ne déduis jamais le nom à partir d'un code-barres. Réponds UNIQUEMENT avec le nom lu, sans explication ni guillemets. Si aucun nom de médicament n'est lisible sur l'image, réponds exactement INCONNU."
      ]
    });
    const name = stripQuotes(response.text || "");
    if (!name || /^inconnu\.?$/i.test(name)) throw new HttpError(422, "Aucun nom de médicament lisible sur l'image.");
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
  const bdpm = await getBdpmIndex()
    .then((index) => ({ ok: true, presentations: index.byCip13.size }))
    .catch((err) => ({ ok: false, error: String((err as Error)?.message || err).slice(0, 200) }));

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return json({ ok: false, problem: "GEMINI_API_KEY est absente pour cet environnement Vercel. Ajoutez-la puis redéployez.", bdpm }, 200, {});
  }

  const ai = new GoogleGenAI({ apiKey });
  const errors: Record<string, string> = {};
  for (const model of CANDIDATE_MODELS) {
    try {
      await withTimeout(ai.models.generateContent({ model, contents: "ping" }), TIMEOUT_PER_MODEL_MS);
      return json({ ok: true, model, keyLength: apiKey.length, bdpm }, 200, {});
    } catch (err) {
      errors[model] = String((err as Error)?.message || err).replaceAll(apiKey, "***").slice(0, 300);
    }
  }
  return json({ ok: false, problem: "Google refuse toutes les requêtes avec cette clé.", keyLength: apiKey.length, errors, bdpm }, 200, {});
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
        return json(await identifyBarcode(barcode), 200, cors);
      }
      case "interactions": {
        if (!Array.isArray(body.names) || body.names.length < 1 || body.names.length > MAX_INTERACTION_MEDS) {
          throw new HttpError(400, `Indiquez entre 1 et ${MAX_INTERACTION_MEDS} médicaments.`);
        }
        const names = body.names.map((n, i) => requireString(n, `names[${i}]`, MAX_NAME_LENGTH));
        const context = requireString(body.context, "context", MAX_CONTEXT_LENGTH, false);
        return json({ data: await checkInteractions(ai, names, context) }, 200, cors);
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
