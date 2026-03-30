import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Armchair, Sun, Beer, User, Loader2, UtensilsCrossed, LayoutGrid, ArrowLeft, Link as LinkIcon, Check, X, Combine, AlertCircle, Unlink } from 'lucide-react';
import { Table, Zone, Employee, ViewState } from '../types';
import { getAllTables, joinTables, unjoinTable } from '../services/tableService';
import { getAllZones } from '../services/zoneService';
import { getOpenOrders } from '../services/orderService';
import { supabase } from '../Supabase';
import AdminNavigation from './AdminNavigation';

interface TablePlanProps {
  user: Employee;
  onLogout: () => void;
  onSelectTable: (table: Table) => void;
  onBack: () => void;
  onNavigate: (view: ViewState) => void;
}

const TablePlan: React.FC<TablePlanProps> = ({ user, onLogout, onSelectTable, onBack, onNavigate }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeZone, setActiveZone] = useState<string>('');
  const [occupiedTableIds, setOccupiedTableIds] = useState<Set<string>>(new Set());
  const [tableTotals, setTableTotals] = useState<Record<string, number>>({});

  // Join Mode State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTablesForJoin, setSelectedTablesForJoin] = useState<Set<string>>(new Set());
  
  // Custom Modals State
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinConfig, setJoinConfig] = useState<{ parentId: string; childIds: string[]; parentName: string } | null>(null);
  
  const [unjoinModalOpen, setUnjoinModalOpen] = useState(false);
  const [tableToUnjoin, setTableToUnjoin] = useState<Table | null>(null);

  const [processingJoin, setProcessingJoin] = useState(false);

  // Long Press Refs
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    loadData();

    // Subscribe to changes in orders to update status in real-time
    const subscription = supabase
        .channel('table_plan_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
            fetchOrdersStatus();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
            loadData();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(subscription);
    };
  }, []);

  const fetchOrdersStatus = async () => {
      try {
        const openOrders = await getOpenOrders();
        const occupiedIds = new Set(openOrders.map(o => o.table_id));
        const totals = openOrders.reduce((acc, curr) => ({ ...acc, [curr.table_id]: curr.total }), {});
        
        setOccupiedTableIds(occupiedIds);
        setTableTotals(totals);
      } catch (error) {
          console.error("Error fetching order status", error);
      }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [tableData, zoneData] = await Promise.all([getAllTables(), getAllZones()]);
      setTables(tableData.filter(t => t.active)); // Only show active tables
      setZones(zoneData);
      
      if (zoneData.length > 0 && !activeZone) {
          setActiveZone(zoneData[0].name);
      }
      
      await fetchOrdersStatus();

    } catch (err) {
      console.error('Error loading tables', err);
    } finally {
      setLoading(false);
    }
  };

  const getZoneIcon = (zoneName: string) => {
    const name = zoneName.toLowerCase();
    if (name.includes('interior') || name.includes('salon')) return <Armchair size={18} />;
    if (name.includes('terraza') || name.includes('patio')) return <Sun size={18} />;
    if (name.includes('barra')) return <Beer size={18} />;
    return <LayoutGrid size={18} />;
  };

  // --- INTERACTION HANDLERS ---

  const handleTouchStart = (table: Table) => {
      isLongPress.current = false;
      timerRef.current = setTimeout(() => {
          isLongPress.current = true;
          handleLongPress(table);
      }, 600); // 600ms for long press
  };

  const handleTouchEnd = () => {
      if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
      }
  };

  const handleLongPress = (table: Table) => {
      // Vibrate if supported
      if (navigator.vibrate) navigator.vibrate(50);

      if (table.parent_id) {
          // If already joined (child), open unjoin modal
          setTableToUnjoin(table);
          setUnjoinModalOpen(true);
      } else {
          // Enter selection mode for joining
          setSelectionMode(true);
          const newSet = new Set(selectedTablesForJoin);
          newSet.add(table.id);
          setSelectedTablesForJoin(newSet);
      }
  };

  const handleTableClick = (table: Table) => {
      if (isLongPress.current) return; // Prevent click after long press triggers

      if (selectionMode) {
          // Toggle selection
          const newSet = new Set(selectedTablesForJoin);
          if (newSet.has(table.id)) {
              newSet.delete(table.id);
              if (newSet.size === 0) setSelectionMode(false);
          } else {
              if (!table.parent_id) { // Cannot select already joined tables as children candidates (unless we implement re-linking)
                  newSet.add(table.id);
              }
          }
          setSelectedTablesForJoin(newSet);
      } else {
          // Normal Click
          if (table.parent_id) {
              // Redirect to parent
              const parent = tables.find(t => t.id === table.parent_id);
              if (parent) onSelectTable(parent);
          } else {
              onSelectTable(table);
          }
      }
  };

  const openJoinModal = () => {
      if (selectedTablesForJoin.size < 2) return;
      
      const selectedIds = Array.from(selectedTablesForJoin);
      
      // Sort logic: Tables with orders (occupied) act as parents preferably
      selectedIds.sort((a, b) => {
          const aOcc = occupiedTableIds.has(a) ? 1 : 0;
          const bOcc = occupiedTableIds.has(b) ? 1 : 0;
          return bOcc - aOcc; // Descending: 1 first, then 0
      });

      const parentId = selectedIds[0];
      const childIds = selectedIds.slice(1);
      const parentTable = tables.find(t => t.id === parentId);

      if (!parentTable) return;

      setJoinConfig({
          parentId,
          childIds,
          parentName: parentTable.name
      });
      setJoinModalOpen(true);
  };

  const handleConfirmJoin = async () => {
      if (!joinConfig) return;
      
      setProcessingJoin(true);
      try {
          await joinTables(joinConfig.parentId, joinConfig.childIds, user.id);
          await loadData();
          setSelectionMode(false);
          setSelectedTablesForJoin(new Set());
          setJoinModalOpen(false);
          setJoinConfig(null);
      } catch (e: any) {
          alert("Error uniendo mesas: " + (e?.message || String(e)));
      } finally {
          setProcessingJoin(false);
      }
  };

  const handleConfirmUnjoin = async () => {
      if (!tableToUnjoin) return;
      setProcessingJoin(true);
      try {
          await unjoinTable(tableToUnjoin.id);
          await loadData();
          setUnjoinModalOpen(false);
          setTableToUnjoin(null);
      } catch (e: any) {
          alert("Error desuniendo: " + (e?.message || String(e)));
      } finally {
          setProcessingJoin(false);
      }
  };

  const cancelSelection = () => {
      setSelectionMode(false);
      setSelectedTablesForJoin(new Set());
  };

  const filteredTables = tables.filter(t => t.zone === activeZone);

  return (
    <div className="flex flex-col h-screen w-full bg-brand-900 text-white overflow-hidden relative">
      
      {/* Top Bar */}
      <header className="flex justify-between items-center bg-brand-800 p-4 border-b border-brand-700 shadow-md shrink-0">
        <div className="flex items-center gap-4">
           {/* Back Button */}
           <button 
             onClick={onBack}
             className="p-2 rounded-xl bg-brand-900 border border-brand-700 text-gray-400 hover:text-white hover:bg-brand-700 transition-colors active:scale-95"
             title="Volver al Panel Principal"
           >
             <ArrowLeft size={20} />
           </button>

           <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-brand-700 flex items-center justify-center text-brand-accent font-bold border border-brand-600">
                  {user.name.substring(0, 2).toUpperCase()}
               </div>
               <div>
                  <h1 className="font-bold text-lg leading-tight">{user.name}</h1>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{user.role}</p>
               </div>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
            <AdminNavigation onNavigate={onNavigate} currentView="tables" />
            
            <button 
              onClick={onLogout}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 p-2.5 rounded-xl transition-colors active:scale-95"
              title="Cerrar Sesión"
            >
              <LogOut size={20} />
            </button>
        </div>
      </header>

      {/* JOIN TOOLBAR (Overlay) - z-[60] to cover AdminMenu (z-50) */}
      {selectionMode && (
          <div className="bg-brand-accent text-white p-3 flex items-center justify-between animate-in slide-in-from-top absolute top-0 left-0 w-full z-[60] shadow-xl">
              <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-full"><Combine size={20} /></div>
                  <div>
                      <p className="font-bold text-sm">Modo Unir Mesas</p>
                      <p className="text-xs opacity-80">{selectedTablesForJoin.size} seleccionadas</p>
                  </div>
              </div>
              <div className="flex gap-2">
                  <button onClick={cancelSelection} className="bg-black/20 hover:bg-black/30 px-3 py-2 rounded-lg font-medium text-sm transition-colors">Cancelar</button>
                  <button 
                    onClick={openJoinModal} 
                    disabled={selectedTablesForJoin.size < 2 || processingJoin}
                    className="bg-white text-brand-accent hover:bg-gray-100 px-4 py-2 rounded-lg font-bold text-sm shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                      {processingJoin ? <Loader2 className="animate-spin" size={16}/> : <Check size={16}/>} Unir
                  </button>
              </div>
          </div>
      )}

      {/* Zone Tabs */}
      <div className="flex bg-brand-800/50 border-b border-brand-700 overflow-x-auto shrink-0">
        {zones.length === 0 && !loading && (
             <div className="p-4 text-sm text-gray-500">No hay zonas configuradas.</div>
        )}
        {zones.map((zone) => (
          <button
            key={zone.id}
            onClick={() => setActiveZone(zone.name)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 font-medium text-sm transition-all border-b-2 min-w-[100px] ${
              activeZone === zone.name 
                ? 'border-brand-accent text-brand-accent bg-brand-accent/5' 
                : 'border-transparent text-gray-400 hover:text-white hover:bg-brand-700/30'
            }`}
          >
            {getZoneIcon(zone.name)}
            <span className="capitalize text-base">{zone.name}</span>
            <span className="ml-1 text-xs bg-brand-900 px-2 py-0.5 rounded-full text-gray-500">
               {tables.filter(t => t.zone === zone.name).length}
            </span>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 relative select-none">
        
        {loading ? (
           <div className="flex items-center justify-center h-full">
             <Loader2 className="animate-spin text-brand-accent w-10 h-10" />
           </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-20">
            {filteredTables.map((table) => {
              // Calculate status
              const isOccupied = occupiedTableIds.has(table.id) || occupiedTableIds.has(table.parent_id || '');
              const isSelected = selectedTablesForJoin.has(table.id);
              
              // Resolve Parent/Child Status
              const isChild = !!table.parent_id;
              const parentName = isChild ? tables.find(t => t.id === table.parent_id)?.name : null;
              
              // Total Logic: If child, usually total is 0 or part of master. 
              // We display Master Total on Master Table.
              const total = tableTotals[table.id] || 0;

              return (
                <button
                  key={table.id}
                  onMouseDown={() => handleTouchStart(table)}
                  onMouseUp={handleTouchEnd}
                  onTouchStart={() => handleTouchStart(table)}
                  onTouchEnd={handleTouchEnd}
                  onClick={() => handleTableClick(table)}
                  className={`
                    group relative border-2 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-all aspect-square
                    ${isSelected 
                        ? 'border-brand-accent bg-brand-accent/20 scale-95 shadow-inner' 
                        : isChild
                            ? 'border-gray-600 bg-gray-800/50 opacity-80 border-dashed'
                            : isOccupied 
                                ? 'bg-red-900/20 border-red-500/50 hover:border-red-400 shadow-xl' 
                                : 'bg-brand-800 border-brand-700 hover:border-brand-accent hover:shadow-brand-accent/10 hover:-translate-y-1'
                    }
                  `}
                >
                   {/* Status Indicator */}
                   {!isChild && (
                        <div className={`absolute top-3 right-3 w-3 h-3 rounded-full shadow-[0_0_10px] ${isOccupied ? 'bg-red-500 shadow-red-500/50' : 'bg-green-500 shadow-green-500/50'}`}></div>
                   )}

                   {/* Selection Check */}
                   {isSelected && (
                       <div className="absolute top-2 left-2 bg-brand-accent text-white rounded-full p-1 shadow-lg animate-in zoom-in">
                           <Check size={14} />
                       </div>
                   )}

                   <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors relative ${
                       isChild ? 'bg-gray-700 text-gray-500' : 
                       isOccupied ? 'bg-red-500/10 text-red-400' : 'bg-brand-900 text-gray-500 group-hover:text-brand-accent group-hover:bg-brand-accent/10'
                   }`}>
                      {getZoneIcon(table.zone)}
                      {isChild && (
                          <div className="absolute -bottom-1 -right-1 bg-gray-700 rounded-full p-1 border border-gray-500">
                              <LinkIcon size={12} className="text-gray-300" />
                          </div>
                      )}
                   </div>
                   
                   <div className="text-center w-full">
                     <h3 className={`font-bold text-xl truncate w-full ${isChild ? 'text-gray-400' : 'text-white'}`}>{table.name}</h3>
                     
                     {isChild ? (
                         <div className="flex flex-col items-center">
                             <span className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                 <LinkIcon size={10}/> {parentName}
                             </span>
                         </div>
                     ) : isOccupied ? (
                        <span className="text-sm text-red-400 font-bold font-mono">{total.toFixed(2)}€</span>
                     ) : (
                        <span className="text-xs text-green-400 font-medium uppercase tracking-wide">Libre</span>
                     )}
                   </div>
                </button>
              );
            })}

            {filteredTables.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center h-64 text-gray-500">
                    <UtensilsCrossed size={48} className="mb-4 opacity-30" />
                    <p className="text-lg font-medium">No hay mesas en esta zona.</p>
                </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Info Bar */}
      <div className="bg-brand-900 border-t border-brand-700 p-2 text-center text-xs text-gray-600 uppercase tracking-widest shrink-0 flex justify-center gap-4">
          <span>GastroPOS v2.1</span>
          <span className="text-gray-700">|</span>
          <span>Mantén pulsado para unir/desunir</span>
      </div>

      {/* CUSTOM JOIN MODAL */}
      {joinModalOpen && joinConfig && (
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center animate-in zoom-in-95">
                  <div className="w-16 h-16 bg-brand-accent/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-accent/30">
                      <Combine className="text-brand-accent w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Unir Mesas</h3>
                  <p className="text-gray-400 mb-6">
                      ¿Deseas unir <strong>{joinConfig.childIds.length}</strong> mesas a la mesa principal <strong>{joinConfig.parentName}</strong>?
                  </p>
                  
                  <div className="flex gap-3">
                      <button 
                          onClick={() => setJoinModalOpen(false)}
                          className="flex-1 py-3 rounded-xl bg-brand-900 text-gray-300 hover:bg-brand-700 font-medium transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={handleConfirmJoin}
                          disabled={processingJoin}
                          className="flex-1 py-3 rounded-xl bg-brand-accent hover:bg-brand-accentHover text-white font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                          {processingJoin ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                          Confirmar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* CUSTOM UNJOIN MODAL */}
      {unjoinModalOpen && tableToUnjoin && (
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center animate-in zoom-in-95">
                  <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-600">
                      <Unlink className="text-gray-300 w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Desunir Mesa</h3>
                  <p className="text-gray-400 mb-6">
                      ¿Deseas separar la mesa <strong>{tableToUnjoin.name}</strong> de la mesa principal?
                  </p>
                  
                  <div className="flex gap-3">
                      <button 
                          onClick={() => { setUnjoinModalOpen(false); setTableToUnjoin(null); }}
                          className="flex-1 py-3 rounded-xl bg-brand-900 text-gray-300 hover:bg-brand-700 font-medium transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={handleConfirmUnjoin}
                          disabled={processingJoin}
                          className="flex-1 py-3 rounded-xl bg-white hover:bg-gray-200 text-brand-900 font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                          {processingJoin ? <Loader2 className="animate-spin" size={18} /> : <Unlink size={18} />}
                          Separar
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default TablePlan;