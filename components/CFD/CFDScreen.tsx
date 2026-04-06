import React, { useState, useEffect } from 'react';
import { ArrowLeft, Monitor, QrCode, Receipt } from 'lucide-react';
import { db } from '../../db';
import { Table, Order } from '../../types';
import * as OrderService from '../../services/orderService';
import { supabase } from '../../Supabase';
import { QRCodeSVG } from 'qrcode.react';

interface CFDScreenProps {
  onNavigate: (view: any) => void;
}

const CFDScreen: React.FC<CFDScreenProps> = ({ onNavigate }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    const loadTables = async () => {
      const allTables = await db.restaurantTables.toArray();
      setTables(allTables);
    };
    loadTables();

    const storedLogo = localStorage.getItem('brandLogo');
    if (storedLogo) {
      setLogoBase64(storedLogo);
    }

    const params = new URLSearchParams(window.location.search);
    const tableIdParam = params.get('tableId');
    if (tableIdParam) {
        setSelectedTableId(tableIdParam);
    }
  }, []);

  useEffect(() => {
    if (!selectedTableId) return;

    const fetchOrder = async () => {
      const order = await OrderService.getActiveOrderForTable(selectedTableId);
      setCurrentOrder(order);
    };

    fetchOrder();

    // Subscribe to realtime changes
    const orderSubscription = supabase
      .channel(`cfd-orders-${selectedTableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `table_id=eq.${selectedTableId}` }, () => {
        fetchOrder();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        fetchOrder();
      })
      .subscribe();

    // Listen to local BroadcastChannel for live cart updates from POS
    const channel = new BroadcastChannel(`cfd-sync-${selectedTableId}`);
    channel.onmessage = (event) => {
        if (event.data.type === 'SYNC_ORDER') {
            setCurrentOrder(event.data.order);
        } else if (event.data.type === 'PING') {
            channel.postMessage({ type: 'PONG' });
        }
    };

    channel.postMessage({ type: 'CFD_OPENED' });

    const handleUnload = () => {
        channel.postMessage({ type: 'CFD_CLOSED' });
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      supabase.removeChannel(orderSubscription);
      channel.postMessage({ type: 'CFD_CLOSED' });
      channel.close();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [selectedTableId]);

  if (!selectedTableId) {
    return (
      <div className="flex flex-col h-screen bg-brand-900 p-6">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => onNavigate('dashboard')}
            className="p-3 bg-brand-800 hover:bg-brand-700 rounded-xl text-white transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Monitor className="text-brand-accent" />
            Configurar Visor de Cliente (CFD)
          </h1>
        </div>
        
        <div className="bg-brand-800 rounded-2xl p-6 border border-brand-700 max-w-2xl mx-auto w-full">
          <h2 className="text-lg text-gray-300 mb-4">Selecciona la mesa o terminal a reflejar:</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {tables.map(table => (
              <button
                key={table.id}
                onClick={() => setSelectedTableId(table.id)}
                className="p-4 bg-brand-900 border border-brand-700 hover:border-brand-accent rounded-xl text-white font-bold transition-all active:scale-95"
              >
                {table.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const selectedTable = tables.find(t => t.id === selectedTableId);
  const total = currentOrder?.total || 0;
  const items = currentOrder?.items || [];

  // Generate a dummy payment URL for the QR code
  const paymentUrl = `https://gastropos.app/pay/${currentOrder?.id || 'demo'}`;

  return (
    <div className="flex flex-col h-screen bg-brand-900 text-white overflow-hidden">
      {/* Header */}
      <header className="p-6 bg-brand-800 border-b border-brand-700 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          {logoBase64 ? (
            <img src={logoBase64} alt="Logo" className="h-12 w-auto object-contain" />
          ) : (
            <h1 className="text-3xl font-bold">GastroPOS</h1>
          )}
        </div>
        <div className="text-xl text-gray-400 font-medium">
          {selectedTable?.name}
        </div>
        <button 
          onClick={() => setSelectedTableId(null)}
          className="p-2 text-gray-500 hover:text-white transition-colors"
          title="Cambiar Mesa"
        >
          <Monitor size={24} />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side: Order Items */}
        <div className="flex-1 flex flex-col border-r border-brand-700 bg-brand-900/50">
          <div className="p-4 border-b border-brand-700 bg-brand-800/50 flex items-center gap-2">
            <Receipt className="text-brand-accent" />
            <h2 className="text-xl font-bold">Tu Pedido</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                <Receipt size={64} className="opacity-20" />
                <p className="text-xl">Esperando artículos...</p>
              </div>
            ) : (
              items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-4 bg-brand-800 rounded-xl border border-brand-700 text-lg">
                  <div className="flex items-center gap-4">
                    <span className="bg-brand-900 text-brand-accent font-bold px-3 py-1 rounded-lg border border-brand-700">
                      {item.quantity}x
                    </span>
                    <div>
                      <div className="font-bold">{item.product_name}</div>
                      {item.notes && <div className="text-sm text-gray-400">{item.notes}</div>}
                    </div>
                  </div>
                  <div className="font-bold">
                    {(item.price * item.quantity).toFixed(2)}€
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Total and QR */}
        <div className="w-full md:w-96 flex flex-col bg-brand-800 shrink-0">
          <div className="p-8 flex-1 flex flex-col items-center justify-center gap-8">
            <div className="text-center w-full">
              <h3 className="text-gray-400 text-xl mb-2">Total a Pagar</h3>
              <div className="text-6xl font-bold text-brand-accent">
                {total.toFixed(2)}€
              </div>
            </div>

            {total > 0 && (
              <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-500">
                <QRCodeSVG value={paymentUrl} size={200} level="H" />
                <div className="text-slate-900 text-center">
                  <p className="font-bold flex items-center justify-center gap-2">
                    <QrCode size={18} />
                    Escanea para pagar
                  </p>
                  <p className="text-sm opacity-80">o dejar propina</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-6 bg-brand-900 border-t border-brand-700 text-center text-gray-400 text-sm">
            ¡Gracias por tu visita!
          </div>
        </div>

      </div>
    </div>
  );
};

export default CFDScreen;
