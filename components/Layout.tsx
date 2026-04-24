import React, { useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { Info } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useAuthStore();
  const isTour = user?.role?.toLowerCase() === 'tour';

  useEffect(() => {
    if (!isTour) return;

    const handleTourClickCapture = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        
        // Find closest button or input
        const interactable = target.closest('button, input[type="submit"], input[type="radio"], input[type="checkbox"]') as HTMLElement | null;
        if (!interactable) return;

        const attrClass = (interactable.className || '').toLowerCase();
        const attrLabel = (interactable.getAttribute('aria-label') || '').toLowerCase();
        const attrTitle = (interactable.title || '').toLowerCase();
        const attrText = (interactable.innerText || '').toLowerCase();

        const combinedInfo = `${attrClass} ${attrLabel} ${attrTitle} ${attrText}`;

        // Safe actions: Navigations, close modals, view details, etc
        const isSafe = /(cancel|close|cerrar|volver|atrás|nav|inicio|dashboard|mesas|cocina|inventario|caja|finanzas|configuración|ingeniería|visor|ticket|ver)/i.test(combinedInfo);

        // State altering actions
        const isWrite = /(guardar|crear|añadir|aplicar|nuevo|pagar|cobrar|eliminar|borrar|actualizar|save|add|delete|trash|plus|edit|update|confirmar|merma|abrir caja|terminar|enviar)/i.test(combinedInfo) || interactable.tagName === 'INPUT';

        if (isWrite && !isSafe) {
            e.stopPropagation();
            e.preventDefault();
            alert("Estás en modo Tour. Para realizar cambios, solicita un perfil con permisos de edición.");
        }
    };

    document.addEventListener('click', handleTourClickCapture, true);
    return () => document.removeEventListener('click', handleTourClickCapture, true);
  }, [isTour]);

  return (
    <div className="h-[100dvh] w-screen bg-brand-900 text-white font-sans antialiased overflow-hidden selection:bg-brand-accent selection:text-white flex flex-col relative">
      {/* Background decoration elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-accent blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-blue-900 blur-[100px]"></div>
      </div>
      
      {isTour && (
          <div className="bg-blue-600/90 backdrop-blur-md text-white text-center py-2 px-4 text-xs sm:text-sm font-bold tracking-widest uppercase flex items-center justify-center gap-2 shadow-lg relative z-[9999] border-b border-blue-400/30 w-full shrink-0">
              <Info size={16} className="animate-pulse" />
              <span>Modo de Visualización (Rol Tour) - Sólo Lectura</span>
          </div>
      )}

      <main className="w-full flex-1 min-h-0 flex flex-col relative">
        {children}
      </main>
    </div>
  );
};
