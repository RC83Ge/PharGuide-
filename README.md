# PharmaGuide 💊

Assistant intelligent et sécurisé pour la vérification des médicaments, leurs indications, contre-indications, posologies maximales et interactions potentielles.

## 🚀 Fonctionnalités

- **Recherche instantanée** : Base de données locale de secours + recherche enrichie en ligne via Google Gemini AI.
- **Scanner de code-barres / QR-Code** : Identification rapide par la caméra.
- **Ma Pharmacie locale** : Suivi des traitements quotidiens et des médicaments **en réserve / si besoin** avec persistance IndexedDB.
- **Journal des prises** : Noter chaque prise et voir le total sur 24 h glissantes, avec une alerte quand la dose maximale approche ou est dépassée.
- **Bilan médical imprimable** : Génération d'un rapport PDF et TXT récapitulatif pour les consultations médicales.
- **Profil santé personnalisé** : Prise en compte des antécédents et allergies pour alerter sur d'éventuelles contre-indications.

## 🛠️ Stack technique

- **Frontend** : React 19, TypeScript, Vite
- **Styles** : Tailwind CSS v4, Lucide React
- **IA** : Google Gemini (`@google/genai`), appelé uniquement depuis la fonction serveur `api/gemini.ts`
- **Stockage** : IndexedDB (local et privé)
- **Export** : jsPDF
- **Android** : Capacitor

## 🔐 Clé Gemini

La clé Gemini reste **sur le serveur**. Le navigateur et l'appli Android envoient leurs requêtes à `POST /api/gemini`, une fonction Vercel qui ajoute la clé et interroge Gemini.

- Ne jamais mettre la clé dans le code, dans un fichier commité, ni dans une variable préfixée par `VITE_` (elle serait intégrée au JavaScript public).
- Ne jamais commiter `android/app/src/main/assets/public` : c'est une copie du build, régénérée par `npm run cap:sync`.

## 💻 Installation locale

```bash
npm install
cp .env.example .env   # puis renseigner GEMINI_API_KEY
npm run dev            # http://localhost:3000, l'API /api/gemini est servie par Vite
```

Vérifications avant de pousser :

```bash
npm run lint    # vérification TypeScript
npm run build
npm test        # tests unitaires (node --test)
```

## 🌐 Déploiement sur Vercel

1. Importer le dépôt sur [vercel.com](https://vercel.com) (preset **Vite**, build `npm run build`, sortie `dist`).
2. Dans **Settings > Environment Variables**, ajouter `GEMINI_API_KEY` avec votre clé Gemini.
3. Déployer. Le site et la fonction `/api/gemini` sont publiés ensemble.

## 📱 Build Android

L'appli Android embarque le site en local et doit savoir où trouver l'API :

```bash
VITE_API_BASE_URL=https://votre-site.vercel.app npm run cap:sync
npm run cap:open
```
