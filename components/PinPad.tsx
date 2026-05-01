import React, { useState, useEffect, useRef } from 'react';
import { Delete, Lock, AlertCircle, LogIn, Loader2 } from 'lucide-react';
import CurrentTime from './CurrentTime';

interface PinPadProps {
  onSuccess: (pin: string) => void;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

const PinPad: React.FC<PinPadProps> = ({ onSuccess, isLoading, error, clearError }) => {
  const [pin, setPin] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  // Use a ref to hold the latest callback. This allows us to call it in useEffect
  // without adding it to the dependency array, preventing infinite loops if the parent
  // passes a new function reference on every render.
  const onSuccessRef = useRef(onSuccess);
  
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
      const loadLogo = () => {
          const storedLogo = localStorage.getItem('brandLogo');
          setLogoUrl(storedLogo);
      };
      loadLogo();
      window.addEventListener('brandUpdated', loadLogo);
      return () => window.removeEventListener('brandUpdated', loadLogo);
  }, []);

  const handleNumberClick = (num: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    if (isLoading) return;
    if (pin.length < 4) {
      setPin(prev => prev + num);
      if (error) clearError();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    setPin(prev => prev.slice(0, -1));
    if (error) clearError();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    setPin('');
    if (error) clearError();
  };

  // Auto-submit when pin reaches 4 digits
  useEffect(() => {
    if (pin.length === 4) {
      // Trigger success callback
      onSuccessRef.current(pin);
      
      // Clear the pin after a short delay to allow the user to see the last dot filled
      // We use a timeout to ensure the UI updates first.
      const timer = setTimeout(() => {
        setPin('');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [pin]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-4 lg:p-0">
      
      {/* Top Section: Clock & Logo */}
      <div className="mb-6 flex flex-row items-center justify-center gap-4 w-full">
        {logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-12 sm:h-16 w-auto object-contain shrink-0" />
        )}
        <CurrentTime />
      </div>

      <div className="bg-brand-800/80 backdrop-blur-md p-6 sm:p-8 rounded-3xl shadow-2xl border border-brand-700 w-full relative overflow-hidden transition-colors duration-300">
        
        {/* Status Indicator Bar */}
        <div className={`absolute top-0 left-0 w-full h-1.5 transition-colors duration-300 ${isLoading ? 'bg-blue-500 animate-pulse' : error ? 'bg-red-500' : 'bg-brand-accent'}`} />

        <div className="mb-4 sm:mb-6 mt-2 text-center h-8 flex items-center justify-center gap-2">
           {isLoading ? (
             <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
           ) : (
             <LogIn className={`w-5 h-5 ${error ? 'text-red-400' : 'text-brand-accent'}`} />
           )}
           <h3 className="text-white font-medium opacity-90">
              {isLoading ? 'Verificando...' : (error ? 'Acceso denegado' : 'Introduce tu código personal')}
           </h3>
        </div>

        {/* Pin Dots */}
        <div className="w-full mb-6 sm:mb-8 relative flex justify-center">
          <div className={`h-12 sm:h-14 px-8 bg-brand-900/50 rounded-full flex items-center justify-center space-x-4 border transition-colors duration-300 ${error ? 'border-red-500/50' : 'border-brand-700/50'}`}>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  i < pin.length 
                    ? (error ? 'bg-red-500' : 'bg-brand-accent scale-125')
                    : 'bg-brand-700'
                }`}
              />
            ))}
          </div>
          
          {/* Error Message */}
          <div className={`absolute -bottom-6 left-0 w-full text-center transition-all duration-300 ${error ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
             <span className="text-red-400 text-sm flex items-center justify-center gap-1 font-medium">
               <AlertCircle size={14} /> {error}
             </span>
          </div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={(e) => handleNumberClick(num.toString(), e)}
              disabled={isLoading}
              className="h-14 sm:h-16 bg-brand-700/50 hover:bg-brand-600/50 active:bg-brand-600 backdrop-blur-sm rounded-xl text-2xl sm:text-3xl font-light text-white transition-all shadow-sm active:scale-95 border border-brand-600/20 touch-manipulation select-none disabled:opacity-50 disabled:active:scale-100"
            >
              {num}
            </button>
          ))}
          
          <button
            type="button"
            onClick={handleClear}
            disabled={isLoading}
            className="h-14 sm:h-16 bg-brand-800/50 hover:bg-brand-700/50 rounded-xl text-sm font-bold text-gray-400 transition-all active:scale-95 border border-brand-700/30 uppercase touch-manipulation select-none disabled:opacity-50 disabled:active:scale-100"
          >
            C
          </button>
          
          <button
            type="button"
            onClick={(e) => handleNumberClick('0', e)}
            disabled={isLoading}
            className="h-14 sm:h-16 bg-brand-700/50 hover:bg-brand-600/50 backdrop-blur-sm rounded-xl text-2xl sm:text-3xl font-light text-white transition-all shadow-sm active:scale-95 border border-brand-600/20 touch-manipulation select-none disabled:opacity-50 disabled:active:scale-100"
          >
            0
          </button>
          
          <button
            type="button"
            onClick={handleDelete}
            disabled={isLoading}
            className="h-14 sm:h-16 bg-brand-800/50 hover:bg-brand-700/50 rounded-xl flex items-center justify-center text-gray-400 transition-all active:scale-95 border border-brand-700/30 touch-manipulation select-none disabled:opacity-50 disabled:active:scale-100"
          >
            <Delete size={24} className="sm:w-7 sm:h-7" />
          </button>
        </div>
        
        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-gray-600 uppercase tracking-widest font-bold">
          <Lock size={10} />
          <span>Sistema Seguro GastroPOS</span>
        </div>
      </div>
    </div>
  );
};

export default PinPad;