import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-brand-900 text-white font-sans antialiased overflow-hidden selection:bg-brand-accent selection:text-white">
      {/* Background decoration elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-accent blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-blue-900 blur-[100px]"></div>
      </div>
      
      <main className="w-full h-full flex flex-col">
        {children}
      </main>
    </div>
  );
};
