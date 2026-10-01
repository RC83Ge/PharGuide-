import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Mic, MicOff, Camera } from 'lucide-react';
import { COMMON_MEDICATIONS } from '../data/commonMedications';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  externalQuery?: string;
  onOpenScanner?: () => void;
}

// Déclaration pour TypeScript car l'API SpeechRecognition n'est pas standard partout
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading, externalQuery, onOpenScanner }) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Vérification du support navigateur au montage
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setIsSupported(false);
    }

    // Gestion du clic en dehors pour fermer les suggestions
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Met à jour le champ texte si la recherche change depuis l'extérieur
  useEffect(() => {
    if (externalQuery) {
      setInput(externalQuery);
      setShowSuggestions(false);
    }
  }, [externalQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    if (value.length > 1) {
      const filtered = COMMON_MEDICATIONS.filter(med => 
        med.toLowerCase().startsWith(value.toLowerCase())
      ).slice(0, 5); // Limiter à 5 suggestions
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setInput(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
    onSearch(suggestion);
  };

  const startListening = () => {
    if (isLoading) return;
    setShowSuggestions(false); // Cacher les suggestions pendant l'écoute

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setInput(transcript);
        onSearch(transcript); 
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Erreur reconnaissance vocale:", event.error);
      setIsListening(false);
    };

    recognition.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (input.trim()) {
      onSearch(input.trim());
    }
  };

  return (
    <div ref={wrapperRef} className="w-full relative z-20">
      <form onSubmit={handleSubmit} className="w-full relative group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          )}
        </div>
        
        <input
          type="text"
          className={`block w-full pl-10 ${onOpenScanner ? 'pr-[8rem]' : 'pr-[5.5rem]'} py-3.5 bg-white border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all duration-300 text-base
            ${isListening ? 'border-red-400 ring-2 ring-red-500/20' : 'border-slate-200 focus:border-blue-500'}
            ${showSuggestions && suggestions.length > 0 ? 'rounded-b-none border-b-0' : ''}
          `}
          placeholder={isListening ? "Parlez maintenant..." : "Rechercher (ex: Doliprane)"}
          value={input}
          onChange={handleInputChange}
          onFocus={() => input.length > 1 && suggestions.length > 0 && setShowSuggestions(true)}
          disabled={isLoading}
          autoComplete="off"
        />

        <div className="absolute right-1.5 top-1.5 bottom-1.5 flex gap-1">
          {/* Bouton Scanner Caméra */}
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-300 flex items-center justify-center active:scale-95"
              title="Scanner un code-barres ou une boîte"
            >
              <Camera className="w-5 h-5" />
            </button>
          )}

          {/* Bouton Micro */}
          {isSupported && (
            <button
              type="button"
              onClick={startListening}
              disabled={isLoading}
              className={`p-2 rounded-lg transition-all duration-300 flex items-center justify-center
                ${isListening 
                  ? 'bg-red-50 text-red-600 animate-pulse ring-2 ring-red-100' 
                  : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'
                }
              `}
              title="Recherche vocale"
            >
              {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
          )}

          {/* Bouton Go */}
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md hover:shadow-lg"
          >
            Go
          </button>
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute w-full bg-white border border-t-0 border-slate-200 rounded-b-xl shadow-lg max-h-60 overflow-y-auto animate-fade-in z-30">
          {suggestions.map((suggestion, index) => (
            <li 
              key={index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-slate-700 hover:text-blue-700 transition-colors border-b border-slate-50 last:border-0 flex items-center gap-2"
            >
              <Search className="w-4 h-4 text-slate-300" />
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
