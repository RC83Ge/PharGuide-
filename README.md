# PharmaGuide 💊

Assistant intelligent et sécurisé pour la vérification des médicaments, leurs indications, contre-indications, posologies maximales et interactions potentielles.

## 🚀 Fonctionnalités

- **Recherche instantanée** : Base de données locale de secours + recherche enrichie en ligne via Google Gemini AI.
- **Scanner de code-barres / QR-Code** : Identification rapide par la caméra.
- **Ma Pharmacie locale** : Suivi des traitements quotidiens et des médicaments **en réserve / si besoin** avec persistance IndexedDB.
- **Bilan médical imprimable** : Génération d'un rapport PDF et TXT récapitulatif pour les consultations médicales.
- **Profil santé personnalisé** : Prise en compte des antécédents et allergies pour alerter sur d'éventuelles contre-indications.

## 🛠️ Stack technique

- **Frontend** : React 19, TypeScript, Vite
- **Styles** : Tailwind CSS v4, Lucide React
- **IA** : Google GenAI SDK (`@google/genai`)
- **Stockage** : IndexedDB (Local & Privé)
- **Export** : jsPDF

## 💻 Installation locale

1. **Cloner le projet** :
   ```bash
   git clone <URL_DE_VOTRE_DEPOT>
   cd pharmaguide
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement** :
   Créer un fichier `.env` à la racine :
   ```env
   GEMINI_API_KEY=votre_cle_api_gemini
   ```

4. **Lancer le serveur de développement** :
   ```bash
   npm run dev
   ```

5. **Tester le build de production** :
   ```bash
   npm run build
   ```

---

## 🌐 Déploiement sur Vercel

1. **Pousser le code sur GitHub** :
   ```bash
   git init
   git add .
   git commit -m "Initial commit - PharmaGuide"
   git branch -M main
   git remote add origin https://github.com/<votre-nom-utilisateur>/<nom-du-repo>.git
   git push -u origin main
   ```

2. **Connecter Vercel à votre dépôt GitHub** :
   - Rendez-vous sur [vercel.com](https://vercel.com) et connectez-vous.
   - Cliquez sur **Add New...** > **Project**.
   - Sélectionnez votre dépôt GitHub `pharmaguide`.

3. **Configurer le projet sur Vercel** :
   - **Framework Preset** : `Vite` (détecté automatiquement).
   - **Root Directory** : `./` (la racine).
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist`

4. **Ajouter la variable d'environnement sur Vercel** :
   Dans la section **Environment Variables** du projet Vercel :
   - **Name** : `GEMINI_API_KEY`
   - **Value** : *Votre clé API Gemini* (ex: `AQ.Ab8...`)
   - Cliquez sur **Add**.

5. **Déployer** :
   - Cliquez sur **Deploy**.
   - Vercel effectue le build et met en ligne l'application avec un domaine HTTPS personnalisé.
