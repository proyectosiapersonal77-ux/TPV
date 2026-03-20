import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, AlertCircle, Loader2, AlertTriangle, LayoutGrid, Armchair, Sun, Beer, Settings2, ArrowLeft } from 'lucide-react';
import { Table, Zone } from '../../types';
import { getAllTables, createTable, updateTable, deleteTable } from '../../services/tableService';
import { getAllZones, createZone, deleteZone } from '../../services/zoneService';

const TableManagement: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter State (Zones)
  const [activeZone, setActiveZone] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState<'table-form' | 'zone-manager'>('table-form');
  
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [formData, setFormData] = useState<{name: string; zone: string}>({
    name: '',
    zone: ''
  });
  
  // Zone Manager State inside Modal
  const [newZoneName, setNewZoneName] = useState('');
  const [zoneLoading, setZoneLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  // Delete Table Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete Zone Modal State
  const [deleteZoneModalOpen, setDeleteZoneModalOpen] = useState(false);
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);

  // Notification
  const [notification, setNotification] = useState<{show: boolean; message: string; type: 'error' | 'success'}>({
    show: false, message: '', type: 'success'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tableData, zoneData] = await Promise.all([getAllTables(), getAllZones()]);
      setTables(tableData);
      setZones(zoneData);
      
      // Set default active zone if exists and none selected
      if (zoneData.length > 0 && !activeZone) {
          setActiveZone(zoneData[0].name);
      }
      
      setError(null);
    } catch (err: any) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (table?: Table) => {
    setModalView('table-form');
    if (table) {
      setEditingTable(table);
      setFormData({
        name: table.name,
        zone: table.zone
      });
    } else {
      setEditingTable(null);
      setFormData({
        name: '',
        zone: activeZone || (zones.length > 0 ? zones[0].name : '')
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    if (!formData.zone) {
         setNotification({ show: true, message: 'Debes seleccionar una zona', type: 'error' });
         return;
    }

    setSaving(true);
    try {
      if (editingTable) {
        await updateTable(editingTable.id, { ...formData, active: true });
      } else {
        await createTable({ ...formData, active: true });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setNotification({ show: true, message: err.message, type: 'error' });
      setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000);
    } finally {
      setSaving(false);
    }
  };

  // --- Zone Logic ---

  const handleCreateZone = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!newZoneName.trim()) return;
      setZoneLoading(true);
      try {
          const newZone = await createZone(newZoneName);
          setZones(prev => [...prev, newZone]);
          setFormData(prev => ({ ...prev, zone: newZone.name }));
          setNewZoneName('');
      } catch (err: any) {
          setNotification({ show: true, message: err.message || 'Error creando zona', type: 'error' });
      } finally {
          setZoneLoading(false);
      }
  };

  const onRequestDeleteZone = (zone: Zone) => {
      setZoneToDelete(zone);
      setDeleteZoneModalOpen(true);
  };

  const confirmDeleteZone = async () => {
      if (!zoneToDelete) return;
      setZoneLoading(true);
      try {
          await deleteZone(zoneToDelete.id);
          
          setZones(prev => prev.filter(z => z.id !== zoneToDelete.id));
          
          // If the deleted zone was selected in the form, clear it
          if (formData.zone === zoneToDelete.name) {
              setFormData(prev => ({ ...prev, zone: '' }));
          }
          
          // If the active filter was this zone, switch to another
          if (activeZone === zoneToDelete.name) {
             const remaining = zones.filter(z => z.id !== zoneToDelete.id);
             setActiveZone(remaining.length > 0 ? remaining[0].name : '');
          }

          setDeleteZoneModalOpen(false);
          setZoneToDelete(null);
          
      } catch (err: any) {
           setNotification({ show: true, message: 'Error eliminando zona. Asegúrate de que existe en la base de datos.', type: 'error' });
      } finally {
          setZoneLoading(false);
      }
  };

  // --- Delete Table Logic ---

  const onRequestDelete = (e: React.MouseEvent, table: Table) => {
    e.stopPropagation();
    setTableToDelete(table);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!tableToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTable(tableToDelete.id);
      setDeleteModalOpen(false);
      setTableToDelete(null);
      await loadData();
    } catch (err: any) {
      setNotification({ show: true, message: 'No se pudo eliminar la mesa.', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered tables for current view
  const filteredTables = tables.filter(t => t.zone === activeZone);

  const getZoneIcon = (zoneName: string) => {
    const name = zoneName.toLowerCase();
    if (name.includes('interior') || name.includes('salon')) return <Armchair size={18} />;
    if (name.includes('terraza') || name.includes('patio')) return <Sun size={18} />;
    if (name.includes('barra')) return <Beer size={18} />;
    return <LayoutGrid size={18} />;
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-brand-accent" /></div>;

  return (
    <div className="bg-brand-800 rounded-2xl border border-brand-700 shadow-xl overflow-hidden flex flex-col h-full w-full relative">
      
      {/* Header */}
      <div className="p-6 border-b border-brand-700 flex justify-between items-center bg-brand-800/50 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Gestión de Mesas
            <span className="text-xs bg-brand-700 text-gray-300 px-2 py-0.5 rounded-full">{tables.length}</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">Configura las zonas y disposición del restaurante</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-brand-accent hover:bg-brand-accentHover text-white px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-brand-accent/20 active:scale-95"
        >
          <Plus size={18} />
          Nueva Mesa
        </button>
      </div>

      {/* Zone Tabs */}
      <div className="flex border-b border-brand-700 bg-brand-900/30 overflow-x-auto">
        {zones.length === 0 && (
            <div className="p-4 text-sm text-gray-500">No hay zonas. Crea una nueva mesa para gestionar zonas.</div>
        )}
        {zones.map((zone) => (
          <button
            key={zone.id}
            onClick={() => setActiveZone(zone.name)}
            className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
              activeZone === zone.name 
                ? 'border-brand-accent text-brand-accent bg-brand-accent/5' 
                : 'border-transparent text-gray-400 hover:text-white hover:bg-brand-700/30'
            }`}
          >
            {getZoneIcon(zone.name)}
            <span className="capitalize">{zone.name}</span>
            <span className="ml-1 text-xs bg-brand-800/80 px-1.5 py-0.5 rounded-full text-gray-500">
               {tables.filter(t => t.zone === zone.name).length}
            </span>
          </button>
        ))}
      </div>

      {/* Tables Grid */}
      <div className="overflow-auto flex-1 p-6 relative">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredTables.map((table) => (
              <div 
                key={table.id}
                onClick={() => handleOpenModal(table)}
                className="group relative bg-brand-900/50 border-2 border-brand-700 hover:border-brand-accent rounded-xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:shadow-lg hover:shadow-brand-accent/10 active:scale-95 aspect-square"
              >
                 <div className="w-12 h-12 rounded-full bg-brand-800 flex items-center justify-center text-gray-400 group-hover:text-brand-accent group-hover:bg-brand-accent/10 transition-colors">
                    {getZoneIcon(table.zone)}
                 </div>
                 <h3 className="text-white font-bold text-lg text-center leading-tight truncate w-full">{table.name}</h3>
                 
                 {/* Quick Delete Button */}
                 <button 
                   onClick={(e) => onRequestDelete(e, table)}
                   className="absolute top-2 right-2 p-1.5 rounded-lg text-gray-600 hover:bg-red-500/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                   title="Eliminar Mesa"
                 >
                   <Trash2 size={16} />
                 </button>
              </div>
            ))}
            
            {/* Empty State Add Button */}
            <button
               onClick={() => handleOpenModal()}
               className="border-2 border-dashed border-brand-700 hover:border-brand-500 hover:bg-brand-700/20 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-gray-500 hover:text-gray-300 aspect-square"
            >
               <Plus size={24} />
               <span className="text-xs font-bold uppercase">Añadir Mesa</span>
            </button>
        </div>
        
        {filteredTables.length === 0 && zones.length > 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500 mt-10">
                <p className="text-sm">No hay mesas en esta zona.</p>
            </div>
        )}
      </div>

      {/* Unified Modal (Table Form & Zone Manager) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-brand-700 flex justify-between items-center bg-brand-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {modalView === 'zone-manager' && (
                    <button onClick={() => setModalView('table-form')} className="mr-1 hover:text-brand-accent transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                )}
                {modalView === 'zone-manager' ? 'Gestionar Zonas' : (editingTable ? 'Editar Mesa' : 'Nueva Mesa')}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white p-2">
                <X size={24} />
              </button>
            </div>
            
            {/* View: Table Form */}
            {modalView === 'table-form' && (
                <form onSubmit={handleSaveTable} className="p-6 space-y-4">
                    <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Nombre / Número</label>
                    <input 
                        required
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-brand-900 border border-brand-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all"
                        placeholder="Ej. Mesa 1, Barra 3..."
                        autoFocus
                    />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-400">Zona</label>
                            <button 
                                type="button"
                                onClick={() => setModalView('zone-manager')}
                                className="text-xs text-brand-accent hover:text-white flex items-center gap-1 font-medium transition-colors"
                            >
                                <Settings2 size={12} /> Gestionar
                            </button>
                        </div>
                        
                        {zones.length === 0 ? (
                            <div className="p-4 bg-brand-900/50 border border-dashed border-brand-700 rounded-lg text-center">
                                <p className="text-sm text-gray-500 mb-2">No existen zonas creadas.</p>
                                <button type="button" onClick={() => setModalView('zone-manager')} className="text-brand-accent text-sm font-bold">Crear Zona</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                                {zones.map((zone) => (
                                    <button
                                        type="button"
                                        key={zone.id}
                                        onClick={() => setFormData({...formData, zone: zone.name})}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                                            formData.zone === zone.name 
                                            ? 'bg-brand-accent/20 border-brand-accent text-brand-accent' 
                                            : 'bg-brand-900 border-brand-700 text-gray-400 hover:border-brand-500'
                                        }`}
                                    >
                                        {getZoneIcon(zone.name)}
                                        <span className="text-[10px] uppercase font-bold truncate w-full text-center">{zone.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3">
                    <button 
                        type="button" 
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 px-4 py-3 rounded-xl bg-brand-900 text-gray-300 hover:bg-brand-700 font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit"
                        disabled={saving}
                        className="flex-1 px-4 py-3 rounded-xl bg-brand-accent hover:bg-brand-accentHover text-white font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Guardar
                    </button>
                    </div>
                </form>
            )}

            {/* View: Zone Manager */}
            {modalView === 'zone-manager' && (
                <div className="flex flex-col h-[400px]">
                    <div className="p-4 bg-brand-900/30 border-b border-brand-700">
                        <form onSubmit={handleCreateZone} className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Nombre nueva zona..."
                                value={newZoneName}
                                onChange={(e) => setNewZoneName(e.target.value)}
                                className="flex-1 bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-accent outline-none text-sm"
                            />
                            <button 
                                type="submit"
                                disabled={zoneLoading || !newZoneName.trim()}
                                className="bg-brand-accent hover:bg-brand-accentHover text-white px-3 py-2 rounded-lg font-bold disabled:opacity-50"
                            >
                                <Plus size={18} />
                            </button>
                        </form>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {zones.length === 0 && (
                             <p className="text-center text-gray-500 text-sm mt-4">Lista vacía.</p>
                        )}
                        {zones.map((zone) => (
                            <div key={zone.id} className="flex items-center justify-between p-3 bg-brand-900/50 rounded-lg border border-brand-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="text-gray-400">{getZoneIcon(zone.name)}</div>
                                    <span className="font-medium text-gray-200 capitalize">{zone.name}</span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => onRequestDeleteZone(zone)} 
                                    disabled={zoneLoading} 
                                    className="text-red-400 hover:text-red-300 p-2 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer" 
                                    title="Eliminar Zona"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-brand-700 bg-brand-900/30 text-center">
                        <button type="button" onClick={() => setModalView('table-form')} className="text-brand-accent hover:text-white text-sm font-medium transition-colors">Volver a Mesa</button>
                    </div>
                </div>
            )}

          </div>
        </div>
      )}

      {/* Delete Table Modal */}
      {deleteModalOpen && tableToDelete && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-red-500 w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">¿Eliminar mesa?</h3>
                <p className="text-gray-400 mb-6">
                  Se eliminará <span className="text-white font-bold">{tableToDelete.name}</span>.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setDeleteModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-brand-900 text-gray-300 hover:bg-brand-700 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    Eliminar
                  </button>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* Delete Zone Modal */}
      {deleteZoneModalOpen && zoneToDelete && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-red-500 w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">¿Eliminar zona?</h3>
                <p className="text-gray-400 mb-6">
                  Se eliminará la zona <span className="text-white font-bold uppercase">{zoneToDelete.name}</span>.<br/>
                  <span className="text-xs text-orange-400 mt-2 block">Las mesas en esta zona podrían dejar de ser visibles.</span>
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setDeleteZoneModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-brand-900 text-gray-300 hover:bg-brand-700 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmDeleteZone}
                    disabled={zoneLoading}
                    className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    {zoneLoading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    Eliminar
                  </button>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* Local Notification */}
      {notification.show && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in z-[80] w-max max-w-[90%]">
              <AlertCircle size={16} />
              <span className="text-sm font-medium">{notification.message}</span>
          </div>
      )}

    </div>
  );
};

export default TableManagement;