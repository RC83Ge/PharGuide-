import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { identifyMedicationFromBarcode } from '../services/medicationService';
import { extractCip13 } from '../utils/cip';
import { toast } from 'sonner';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (medicationName: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const [scannerState, setScannerState] = useState<'idle' | 'starting' | 'scanning' | 'processing' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Initialisation de la caméra...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isComponentMounted = useRef<boolean>(true);

  // Seuls formats utilisés sur les boîtes de médicaments : les autres provoquaient de fausses lectures
  const formatsToSupport = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
  ];

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn("Erreur lors de l'arrêt du scanner:", err);
      } finally {
        html5QrCodeRef.current = null;
      }
    }
  };

  // Des refs (et non l'état React) car le scanner appelle ce callback jusqu'à 15 fois par seconde
  // avec la version de la fonction créée au démarrage : un état lu ici serait périmé.
  const isProcessingRef = useRef<boolean>(false);
  const lastReadRef = useRef<string | null>(null);
  const lastInvalidNoticeRef = useRef<number>(0);

  const handleBarcodeDecoded = async (decodedText: string) => {
    if (isProcessingRef.current) return;

    const cip13 = extractCip13(decodedText);
    if (!cip13) {
      if (Date.now() - lastInvalidNoticeRef.current > 4000) {
        lastInvalidNoticeRef.current = Date.now();
        toast.warning("Ce code n'est pas un code de médicament. Visez le code-barres ou le DataMatrix de la boîte.");
      }
      return;
    }

    // Exiger deux lectures identiques de suite pour écarter les lectures partielles
    if (lastReadRef.current !== cip13) {
      lastReadRef.current = cip13;
      return;
    }

    isProcessingRef.current = true;
    if (navigator.vibrate) {
      navigator.vibrate([20, 50, 20]);
    }

    setDetectedCode(cip13);
    setScannerState('processing');
    setStatusMessage("Recherche dans la base officielle des médicaments...");
    await stopScanner();

    try {
      const medicationName = await identifyMedicationFromBarcode(cip13);
      if (!isComponentMounted.current) return;

      toast.success(`Médicament identifié : ${medicationName}`, { description: "Source : base officielle des médicaments (ANSM)" });
      onScanSuccess(medicationName);
      onClose();
    } catch (err: any) {
      console.error("Erreur identification code-barres:", err);
      if (!isComponentMounted.current) return;
      toast.error(err?.message || "Impossible d'identifier ce code. Tapez le nom du médicament.");
      startScanner();
    }
  };

  const startScanner = async () => {
    await stopScanner();
    isProcessingRef.current = false;
    lastReadRef.current = null;
    setErrorMessage(null);
    setDetectedCode(null);
    setScannerState('starting');
    setStatusMessage("Démarrage de la caméra...");

    try {
      const elementId = "reader-camera-view";
      const html5QrCode = new Html5Qrcode(elementId, {
        formatsToSupport: formatsToSupport,
        verbose: false
      });
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Adaptatif pour mobile et desktop
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.floor(minEdge * 0.75),
            height: Math.floor(minEdge * 0.55)
          };
        },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleBarcodeDecoded(decodedText);
        },
        () => {
          // Erreur de frame individuelle ignorée
        }
      );

      if (isComponentMounted.current) {
        setScannerState('scanning');
        setStatusMessage("Pointez la caméra vers le code-barres ou le code DataMatrix de la boîte.");
      }
    } catch (err: any) {
      console.error("Erreur démarrage caméra:", err);
      if (isComponentMounted.current) {
        setScannerState('error');
        setErrorMessage("Impossible d'accéder à la caméra. Vérifiez les autorisations de votre navigateur.");
      }
    }
  };

  useEffect(() => {
    isComponentMounted.current = true;
    if (isOpen) {
      // Un léger délai pour s'assurer que le DOM est affiché
      const timer = setTimeout(() => {
        startScanner();
      }, 150);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
      setScannerState('idle');
    }

    return () => {
      isComponentMounted.current = false;
      stopScanner();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* En-tête */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Scanner une boîte de médicament
              </h2>
              <p className="text-xs text-slate-400">
                Code-barres ou DataMatrix de la boîte
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Zone de scan vidéo */}
        <div className="relative flex-1 bg-black min-h-[300px] flex items-center justify-center overflow-hidden">
          {/* Element conteneur du scanner HTML5 */}
          <div 
            id="reader-camera-view" 
            className="w-full h-full min-h-[300px] flex items-center justify-center [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          />

          {/* Viseur visuel superposé */}
          {scannerState === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="relative w-64 h-48 border-2 border-blue-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] flex flex-col justify-between p-3">
                {/* Coins dorés/lumineux */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />

                {/* Ligne laser animée */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_#3b82f6] animate-pulse my-auto" />
              </div>
              
              <span className="mt-4 px-3 py-1 bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 text-slate-300 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-lg">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                Alignez le code-barres ou le logo
              </span>
            </div>
          )}

          {/* Overlay de chargement / analyse */}
          {scannerState === 'processing' && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="relative p-4 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full mb-4 animate-bounce">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-white font-bold text-base mb-1">Analyse en cours...</h3>
              <p className="text-slate-300 text-xs max-w-xs">{statusMessage}</p>
              {detectedCode && (
                <div className="mt-3 px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-emerald-400 font-mono text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Code: {detectedCode}
                </div>
              )}
            </div>
          )}

          {/* State d'erreur */}
          {scannerState === 'error' && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl mb-3">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-white font-bold text-sm mb-1">Accès Caméra</h3>
              <p className="text-slate-400 text-xs mb-4 max-w-xs leading-relaxed">
                {errorMessage}
              </p>
              <button
                onClick={startScanner}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg active:scale-95 mb-3"
              >
                <RefreshCw className="w-4 h-4" /> Réessayer la caméra
              </button>
            </div>
          )}
        </div>

        {/* Pied du scanner */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <p className="text-[11px] text-slate-500 text-center leading-snug">
            Lit les codes CIP13, EAN-13 et DataMatrix des boîtes de médicaments.
          </p>
        </div>

      </div>
    </div>
  );
};
