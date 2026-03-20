import React from 'react';
import { Database } from 'lucide-react';

export const SupabaseWarning = () => (
  <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
    <div className="bg-brand-800 border border-brand-accent p-8 rounded-2xl max-w-lg w-full shadow-2xl">
      <div className="flex flex-col items-center text-center">
        <div className="bg-brand-accent/20 p-4 rounded-full mb-4">
           <Database className="w-10 h-10 text-brand-accent" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Configuración Requerida</h2>
        <p className="text-gray-300 mb-6 leading-relaxed">
          Para utilizar <strong>GastroPOS</strong>, necesitas conectar tu proyecto de Supabase.
        </p>
        
        <div className="bg-brand-900 w-full p-4 rounded-lg text-left text-sm font-mono text-gray-400 overflow-x-auto mb-6 border border-brand-700">
          <p className="mb-2">// 1. Crea las tablas ejecutando el SQL en:</p>
          <p className="text-brand-accent">src/Supabase.ts</p>
          <p className="mt-4 mb-2">// 2. Configura las variables de entorno:</p>
          <p>VITE_SUPABASE_URL=...</p>
          <p>VITE_SUPABASE_ANON_KEY=...</p>
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="bg-brand-accent hover:bg-brand-accentHover text-white px-6 py-3 rounded-lg font-bold transition-colors w-full"
        >
          Recargar Aplicación
        </button>
      </div>
    </div>
  </div>
);
