import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { AlertTriangle, HelpCircle, History, Pill, RefreshCw, WifiOff } from 'lucide-react';
import { SearchState, MedicationInfo } from './types';
import { fetchMedicationInfo } from './services/medicationService';
import {
  syncAndMigrateLocalStorageToIndexedDB,
  getAllMedicationsFromDB,
  saveMedicationToDB,
  removeMedicationFromDB,
  saveSettingToDB
} from './services/indexedDbService';
import { generatePharmacyPDF } from './services/pdfExportService';
import { downloadPharmacyText } from './services/textExportService';
import { SearchBar } from './components/SearchBar';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { Logo } from './components/Logo';
import { PharmacyPanel } from './components/PharmacyPanel';
import { InfoPanel } from './components/InfoPanel';
import { MedicationDetails } from './components/MedicationDetails';
import { AppFooter } from './components/AppFooter';
import { useOnlineStatus } from './hooks/useOnlineStatus';

const App: React.FC = () => {
  const [state, setState] = useState<SearchState>({
    query: '',
    loading: false,
    error: null,
    data: null,
  });

  const [patientMedications, setPatientMedications] = useState<MedicationInfo[]>(() => {
    const saved = localStorage.getItem('pharmaguide_list');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error("PharmaGuide: Error parsing list", e); }
    }
    return [];
  });
  const [showPharmacy, setShowPharmacy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const [userContext, setUserContext] = useState<string>(() => {
    return localStorage.getItem('pharmaguide_context') || '';
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const isOnline = useOnlineStatus();

  // Synchronisation et migration automatique avec IndexedDB
  useEffect(() => {
    syncAndMigrateLocalStorageToIndexedDB()
      .then(async ({ userContext: syncedContext }) => {
        const meds = await getAllMedicationsFromDB();
        if (meds && meds.length > 0) {
          setPatientMedications(meds);
        }
        if (syncedContext) {
          setUserContext(syncedContext);
        }
        setIsDbReady(true);
      })
      .catch((err) => {
        console.warn("[PharmaGuide] Repli sur localStorage :", err);
        setIsDbReady(false);
      });
  }, []);

  useEffect(() => {
    // Handle install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Handle shortcut from manifest
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'pharmacy') {
      setShowPharmacy(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pharmaguide_list', JSON.stringify(patientMedications));
  }, [patientMedications]);

  useEffect(() => {
    localStorage.setItem('pharmaguide_context', userContext);
  }, [userContext]);

  const handleSearch = async (query: string) => {
    if (navigator.vibrate) navigator.vibrate(10);
    setState(prev => ({ ...prev, query, loading: true, error: null, data: null }));
    try {
      const result = await fetchMedicationInfo(query, userContext);
      setState(prev => ({ ...prev, loading: false, data: result }));
      setShowPharmacy(false);
      setShowInfo(false);
      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    } catch (err: any) {
      console.error("Search error:", err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: err?.message || "Erreur lors de la récupération des données."
      }));
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleShare = async () => {
    if (!state.data) return;
    const maxDosageText = state.data.maxDailyDosage?.generalMax 
      ? `\n\nDosage max / 24h : ${state.data.maxDailyDosage.generalMax}` 
      : '';
    const shareText = `${state.data.name.toUpperCase()}\n\n${state.data.description}\n\nIndications : ${state.data.indications.join(', ')}${maxDosageText}\n\nVia PharmaGuide.`;
    if (navigator.share) {
      try { await navigator.share({ title: `PharmaGuide - ${state.data.name}`, text: shareText, url: window.location.href }); } catch (e) {}
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("Copié dans le presse-papier !");
    }
  };

  const addToPatientList = async (asReserve: boolean = false) => {
    if (!state.data) return;
    const target: MedicationInfo = {
      ...state.data,
      isReserve: asReserve
    };
    
    const existingIndex = patientMedications.findIndex(
      m => m.name.toLowerCase() === target.name.toLowerCase()
    );

    if (existingIndex >= 0) {
      const updated = [...patientMedications];
      updated[existingIndex] = {
        ...updated[existingIndex],
        isReserve: asReserve
      };
      setPatientMedications(updated);
      setState(prev => prev.data ? { ...prev, data: { ...prev.data, isReserve: asReserve } } : prev);
      try {
        await saveMedicationToDB(updated[existingIndex]);
        toast.success(
          asReserve 
            ? `${target.name} placé dans vos médicaments en réserve.`
            : `${target.name} placé dans vos traitements réguliers.`
        );
      } catch {
        toast.success(`${target.name} mis à jour.`);
      }
      return;
    }

    setPatientMedications(prev => [target, ...prev]);
    setState(prev => prev.data ? { ...prev, data: { ...prev.data, isReserve: asReserve } } : prev);
    try {
      await saveMedicationToDB(target);
      toast.success(
        asReserve
          ? `${target.name} ajouté en réserve (si besoin / secours) !`
          : `${target.name} synchronisé dans votre pharmacie !`,
        {
          description: asReserve
            ? "Classé dans votre réserve pour prises ponctuelles ou secours."
            : "Enregistré de manière permanente dans IndexedDB locale"
        }
      );
    } catch {
      toast.success(`${target.name} ajouté à votre pharmacie !`);
    }
  };

  const toggleMedicationReserve = async (e: React.MouseEvent, medName: string) => {
    e.stopPropagation();
    const medIndex = patientMedications.findIndex(
      m => m.name.toLowerCase() === medName.toLowerCase()
    );
    if (medIndex === -1) {
      // If not yet in list, add it as reserve
      if (state.data && state.data.name.toLowerCase() === medName.toLowerCase()) {
        await addToPatientList(true);
      }
      return;
    }

    const currentMed = patientMedications[medIndex];
    const newReserveStatus = !currentMed.isReserve;
    const updatedMed: MedicationInfo = {
      ...currentMed,
      isReserve: newReserveStatus
    };

    const updatedList = [...patientMedications];
    updatedList[medIndex] = updatedMed;
    setPatientMedications(updatedList);

    if (state.data && state.data.name.toLowerCase() === medName.toLowerCase()) {
      setState(prev => prev.data ? { ...prev, data: { ...prev.data, isReserve: newReserveStatus } } : prev);
    }

    try {
      await saveMedicationToDB(updatedMed);
      toast.success(
        newReserveStatus
          ? `${currentMed.name} placé en réserve (si besoin / secours)`
          : `${currentMed.name} placé en traitement régulier`,
        {
          description: newReserveStatus 
            ? "Ce traitement est identifié pour un usage ponctuel ou d'urgence." 
            : "Ce traitement est identifié comme traitement habituel au quotidien."
        }
      );
    } catch {
      toast.success(`${currentMed.name} mis à jour.`);
    }
  };

  const removeFromPatientList = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setPatientMedications(prev => prev.filter(m => m.name !== name));
    try {
      await removeMedicationFromDB(name);
      toast.info(`${name} retiré de votre pharmacie.`);
    } catch {
      toast.info(`${name} retiré.`);
    }
  };

  const handleExportPDF = () => {
    if (patientMedications.length === 0 && !userContext.trim()) {
      toast.error("Votre pharmacie est vide, rien à exporter en PDF.");
      return;
    }
    try {
      generatePharmacyPDF(patientMedications, userContext);
      toast.success("Document PDF généré avec succès !", {
        description: "Fiche médicale récapitulative prête à imprimer ou partager."
      });
    } catch (err: any) {
      toast.error("Erreur lors de la génération du PDF : " + (err?.message || "Inconnue"));
    }
  };

  const exportMedications = () => {
    if (patientMedications.length === 0 && !userContext.trim()) {
      toast.error("Rien à exporter.");
      return;
    }
    downloadPharmacyText(patientMedications, userContext);
    toast.success("Exportation réussie !");
  };

  const handleUserContextChange = (value: string) => {
    setUserContext(value);
    saveSettingToDB("context", value).catch(() => {});
  };

  const selectFromList = (med: MedicationInfo) => {
    setState(prev => ({ ...prev, query: med.name, data: med, error: null }));
    setShowPharmacy(false);
    document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const savedMedData = state.data ? patientMedications.find(m => m.name.toLowerCase() === state.data!.name.toLowerCase()) : undefined;
  const isAlreadyInList = Boolean(savedMedData);
  const isCurrentMedInReserve = Boolean(savedMedData?.isReserve ?? state.data?.isReserve);

  const togglePharmacy = () => {
    setShowPharmacy(!showPharmacy);
    setShowInfo(false);
  };

  const toggleInfo = () => {
    setShowInfo(!showInfo);
    setShowPharmacy(false);
  };

  return (
    <div className="min-h-screen bg-slate-200 flex justify-center items-center font-sans text-slate-900">
      <Toaster position="top-center" richColors />
      <div className="w-full min-h-screen max-w-[480px] md:h-[92vh] bg-slate-50 md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative md:border border-slate-200">
        
        <header className="bg-white border-b border-slate-100 sticky top-0 z-50 pt-safe shadow-sm">
          <div className="px-5 h-16 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => window.location.reload()}>
              <Logo className="w-10 h-10" />
              <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-600 block">PharmaGuide</h1>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={togglePharmacy}
                className={`relative p-2 rounded-xl transition-all active:scale-95 flex items-center gap-2 ${showPharmacy ? 'bg-blue-50 text-blue-600 shadow-inner' : 'text-slate-500 hover:bg-slate-50'}`}
                title="Ma Pharmacie"
              >
                <History className="w-5 h-5" />
                {patientMedications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                    {patientMedications.length}
                  </span>
                )}
              </button>

              <button 
                onClick={toggleInfo}
                className={`p-2 rounded-xl transition-all active:scale-95 flex items-center gap-2 ${showInfo ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400 hover:bg-slate-50'}`}
                title="Aide et Paramètres"
              >
                <HelpCircle className="w-6 h-6" />
              </button>
            </div>
          </div>

          {showPharmacy && (
            <PharmacyPanel
              medications={patientMedications}
              userContext={userContext}
              onUserContextChange={handleUserContextChange}
              isDbReady={isDbReady}
              onExportPDF={handleExportPDF}
              onExportText={exportMedications}
              onSelect={selectFromList}
              onToggleReserve={toggleMedicationReserve}
              onRemove={removeFromPatientList}
              onClose={() => setShowPharmacy(false)}
            />
          )}

          {showInfo && (
            <InfoPanel
              canInstall={Boolean(deferredPrompt) && !isInstalled}
              onInstall={handleInstall}
              onClose={() => setShowInfo(false)}
            />
          )}
        </header>

        {!isOnline && (
          <div className="bg-slate-800 text-white text-[11px] font-medium px-4 py-1.5 flex items-center justify-center gap-2">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            Hors ligne : votre pharmacie et les fiches déjà consultées restent disponibles.
          </div>
        )}

        <main id="main-scroll" className="flex-grow w-full px-5 py-6 overflow-y-auto no-scrollbar pb-10">
          <div className={`transition-all duration-500 ${state.data ? 'mb-4' : 'mb-8 mt-4 text-center'}`}>
            {!state.data && (
              <div className="animate-fade-in-up">
                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Bonjour, <span className="text-blue-600">PharmaGuide</span></h2>
                <p className="text-sm text-slate-500 mb-6 px-4">L'assistant intelligent pour vos traitements et votre sécurité médicale.</p>
              </div>
            )}
            <SearchBar 
              onSearch={handleSearch} 
              isLoading={state.loading} 
              externalQuery={state.query} 
              onOpenScanner={() => setIsScannerOpen(true)}
            />
          </div>

          {state.error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm space-y-3 mb-6 shadow-sm animate-fade-in">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-red-800">Impossible de compléter la recherche</p>
                  <p className="text-red-700 leading-relaxed text-xs sm:text-sm">{state.error}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {state.query && (
                  <button
                    onClick={() => handleSearch(state.query)}
                    className="py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Réessayer la recherche
                  </button>
                )}
              </div>
            </div>
          )}

          {state.data && !state.loading && (
            <MedicationDetails
              med={state.data}
              isInList={isAlreadyInList}
              isInReserve={isCurrentMedInReserve}
              onShare={handleShare}
              onAdd={addToPatientList}
              onToggleReserve={toggleMedicationReserve}
              onSearch={handleSearch}
            />
          )}

          {!state.data && !state.loading && !state.error && (
            <div className="mt-12 flex flex-col items-center justify-center opacity-30 animate-fade-in delay-300">
              <Pill className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-sm text-slate-400 font-medium text-center">Indiquez vos allergies dans votre profil <br/>avant de rechercher un médicament.</p>
            </div>
          )}

          <AppFooter />
        </main>
        <div className="h-safe bg-slate-50"></div>
      </div>

      {/* Modal de Scan Caméra / Code-Barres */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(medicationName) => {
          setIsScannerOpen(false);
          handleSearch(medicationName);
        }}
      />
    </div>
  );
};

export default App;