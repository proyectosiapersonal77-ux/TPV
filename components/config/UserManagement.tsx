import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Shield, ChefHat, Utensils, X, Save, AlertCircle, Loader2, AlertTriangle, Settings2, ArrowLeft, Check, XCircle, Lock } from 'lucide-react';
import { Employee, Role, UserRole } from '../../types';
import { getAllEmployees, createEmployee, updateEmployee, deleteEmployee } from '../../services/employeeService';
import { getAllRoles, createRole, deleteRole, updateRole } from '../../services/roleService';
import { supabase } from '../../Supabase';
import { MODULES, hasModuleAccess } from '../../utils/permissions';
import { applyTourRestrictionNoThrow } from '../../utils/tourMode';

const UserManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Custom Notification State
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'error' | 'success' | 'info';
    title: string;
    message: string;
  }>({ show: false, type: 'info', title: '', message: '' });

  // Modal State for Edit/Create User
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalView, setModalView] = useState<'user-form' | 'role-manager'>('user-form');
  
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    pin: '',
    role: 'waiter',
    active: true
  });
  const [userModulePermissions, setUserModulePermissions] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Role Manager State
  const [newRoleName, setNewRoleName] = useState('');
  const [roleLoading, setRoleLoading] = useState(false);
  
  // State for Editing an existing Role
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState('');
  const [editingRolePermissions, setEditingRolePermissions] = useState<any>({});

  // Delete Modals
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteRoleModalOpen, setDeleteRoleModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (title: string, message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setNotification({ show: true, title, message, type });
  };

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, show: false }));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [empData, roleData] = await Promise.all([getAllEmployees(), getAllRoles()]);
      setEmployees(empData);
      setRoles(roleData);
      setError(null);
    } catch (err: any) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (employee?: Employee) => {
    setModalView('user-form');
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name,
        pin: '', // SECURITY: Do not pre-fill PIN. Empty means "no change"
        role: employee.role,
        active: employee.active
      });
      setUserModulePermissions(employee.preferences?.module_permissions || {});
    } else {
      setEditingEmployee(null);
      const defaultRole = roles.length > 0 ? roles[0].name : 'waiter';
      setFormData({
        name: '',
        pin: '',
        role: defaultRole,
        active: true
      });
      setUserModulePermissions({});
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (applyTourRestrictionNoThrow()) return;
    
    // 1. Validation
    if (!formData.name.trim()) {
        showNotification("Datos faltantes", "El nombre es obligatorio.");
        return;
    }

    // New User: PIN is mandatory
    if (!editingEmployee && (formData.pin.length !== 4 || isNaN(Number(formData.pin)))) {
        showNotification("PIN Inválido", "Para crear un usuario, el PIN debe tener exactamente 4 números.");
        return;
    }

    // Edit User: PIN is optional (if empty, we don't change it)
    if (editingEmployee && formData.pin !== '' && (formData.pin.length !== 4 || isNaN(Number(formData.pin)))) {
        showNotification("PIN Inválido", "Si deseas cambiar el PIN, debe tener exactamente 4 números.");
        return;
    }

    // SECURITY: We removed the frontend "duplicate PIN check" because 
    // the frontend no longer knows the PINs of other users.
    // We rely 100% on the Database UNIQUE constraint.

    setSaving(true);
    try {
      if (editingEmployee) {
        // Only include PIN in updates if the user actually typed something
        const updates: any = {
            name: formData.name,
            role: formData.role,
            active: formData.active,
            preferences: {
                ...(editingEmployee?.preferences || {}),
                module_permissions: userModulePermissions
            }
        };
        if (formData.pin.trim() !== '') {
            updates.pin = formData.pin;
        }
        await updateEmployee(editingEmployee.id, updates);
      } else {
        await createEmployee({
            ...formData, 
            preferences: { module_permissions: userModulePermissions }
        } as any);
      }
      setIsModalOpen(false);
      await loadData(); 
    } catch (err: any) {
      console.error("Save error:", err);
      
      if (err.code === '23514' || (err.message && err.message.includes('employees_role_check'))) {
         showNotification('Error de Base de Datos', 'Restricción de roles antigua detectada. Contacta soporte.');
      } 
      else if (err.code === '23505' || (err.message && err.message.includes('unique'))) {
         showNotification("PIN Duplicado", `El PIN "${formData.pin}" ya existe en la base de datos. Elige otro.`);
      }
      else {
         showNotification('Error al guardar', err.message || 'Error desconocido');
      }
    } finally {
      setSaving(false);
    }
  };

  // --- Role Management Functions ---
  
  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (applyTourRestrictionNoThrow()) return;
    if (!newRoleName.trim()) return;
    setRoleLoading(true);
    try {
      const newRole = await createRole(newRoleName);
      setRoles(prev => [...prev, newRole]);
      setNewRoleName('');
    } catch (err: any) {
      showNotification('Error', 'Error creando rol: ' + err.message);
    } finally {
      setRoleLoading(false);
    }
  };

  const startEditRole = (role: Role) => {
    setEditingRoleId(role.id);
    setEditingRoleName(role.name);
    setEditingRolePermissions(role.permissions || {});
  };

  const cancelEditRole = () => {
    setEditingRoleId(null);
    setEditingRoleName('');
    setEditingRolePermissions({});
  };

  const handleUpdateRole = async (originalRoleName: string) => {
    if (!editingRoleId || !editingRoleName.trim()) return;
    if (applyTourRestrictionNoThrow()) return;
    setRoleLoading(true);
    try {
        const newNameNormalized = editingRoleName.toLowerCase();
        await updateRole(editingRoleId, { name: newNameNormalized, permissions: editingRolePermissions });
        
        if (originalRoleName !== newNameNormalized) {
             const { error: updateEmpsError } = await supabase
                .from('employees')
                .update({ role: newNameNormalized })
                .eq('role', originalRoleName);
             if (updateEmpsError) console.error("Error updating employees", updateEmpsError);
             const updatedEmps = await getAllEmployees();
             setEmployees(updatedEmps);
        }
        setRoles(prev => prev.map(r => r.id === editingRoleId ? { ...r, name: newNameNormalized, permissions: editingRolePermissions } : r));
        setEditingRoleId(null);
    } catch (err: any) {
        showNotification('Error', 'Error actualizando rol: ' + err.message);
    } finally {
        setRoleLoading(false);
    }
  };

  const handleRequestDeleteRole = (e: React.MouseEvent, role: Role) => {
    e.preventDefault();
    e.stopPropagation();
    const inUse = employees.some(emp => emp.role.toLowerCase() === role.name.toLowerCase());
    if (inUse) {
      showNotification('Acción Bloqueada', `No puedes eliminar el rol "${role.name}" porque hay usuarios asignados.`);
      return;
    }
    setRoleToDelete(role);
    setDeleteRoleModalOpen(true);
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;
    if (applyTourRestrictionNoThrow()) return;
    setRoleLoading(true);
    try {
      await deleteRole(roleToDelete.id);
      setRoles(prev => prev.filter(r => r.id !== roleToDelete.id));
      if (formData.role === roleToDelete.name && roles.length > 0) {
         const remaining = roles.filter(r => r.id !== roleToDelete.id);
         setFormData(prev => ({...prev, role: remaining.length > 0 ? remaining[0].name : 'waiter'}));
      }
      setDeleteRoleModalOpen(false);
      setRoleToDelete(null);
    } catch (err: any) {
      showNotification('Error', 'Error eliminando rol: ' + err.message);
    } finally {
      setRoleLoading(false);
    }
  };

  const onRequestDeleteUser = (e: React.MouseEvent, emp: Employee) => {
    e.stopPropagation();
    setEmployeeToDelete(emp);
    setDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!employeeToDelete) return;
    if (applyTourRestrictionNoThrow()) return;
    setIsDeleting(true);
    try {
      await deleteEmployee(employeeToDelete.id);
      setDeleteModalOpen(false);
      setEmployeeToDelete(null);
      await loadData();
    } catch (err: any) {
      showNotification('Error', 'No se pudo eliminar el usuario.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleBadge = (roleName: string) => {
    const rLower = roleName.toLowerCase();
    const role = roles.find(r => r.name.toLowerCase() === rLower);
    const color = role?.color;

    if (rLower === UserRole.ADMIN) {
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 w-fit"><Shield size={12} /> {roleName.toUpperCase()}</span>;
    }
    if (rLower === UserRole.KITCHEN) {
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1 w-fit"><ChefHat size={12} /> {roleName.toUpperCase()}</span>;
    }
    if (rLower === UserRole.WAITER) {
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1 w-fit"><Utensils size={12} /> {roleName.toUpperCase()}</span>;
    }
    return (
        <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1 w-fit">
            <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color || '#3b82f6' }}></span>
            {roleName.toUpperCase()}
        </span>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-brand-accent" /></div>;

  return (
    <div className="bg-brand-800 rounded-2xl border border-brand-700 shadow-xl overflow-hidden flex flex-col h-full w-full relative">
      {/* Header */}
      <div className="p-6 border-b border-brand-700 flex justify-between items-center bg-brand-800/50 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Gestión de Usuarios
            <span className="text-xs bg-brand-700 text-gray-300 px-2 py-0.5 rounded-full">{employees.length}</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">Administra el personal y sus permisos</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-brand-accent hover:bg-brand-accentHover text-white px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-brand-accent/20 active:scale-95"
        >
          <Plus size={18} />
          Nuevo Usuario
        </button>
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1 p-0 relative">
        <table className="w-full text-left border-collapse">
          <thead className="bg-brand-900/50 sticky top-0 z-10 text-xs uppercase tracking-wider text-gray-400 font-medium backdrop-blur-sm">
            <tr>
              <th className="p-4 border-b border-brand-700">Nombre</th>
              <th className="p-4 border-b border-brand-700">Rol</th>
              <th className="p-4 border-b border-brand-700 hidden sm:table-cell">Estado PIN</th>
              <th className="p-4 border-b border-brand-700 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-700/50">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-brand-700/20 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-700 flex items-center justify-center text-sm font-bold text-brand-300 border border-brand-600">
                      {emp.name.substring(0,2).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-200 text-base">{emp.name}</span>
                  </div>
                </td>
                <td className="p-4">{getRoleBadge(emp.role)}</td>
                <td className="p-4">
                     <span className="flex items-center gap-1 text-xs font-mono text-gray-500 bg-brand-900/50 px-2 py-1 rounded w-fit border border-brand-700/50">
                        <Lock size={10} className="text-brand-accent" />
                        PROTEGIDO
                     </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-3">
                    <button 
                      type="button"
                      onClick={() => handleOpenModal(emp)}
                      className="p-3 bg-brand-900 border border-brand-600 hover:bg-blue-500/20 hover:border-blue-500/50 text-blue-400 rounded-xl transition-all active:scale-95 touch-manipulation"
                      title="Editar usuario"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => onRequestDeleteUser(e, emp)}
                      className="p-3 bg-brand-900 border border-brand-600 hover:bg-red-500/20 hover:border-red-500/50 text-red-400 rounded-xl transition-all active:scale-95 touch-manipulation"
                      title="Eliminar usuario"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {employees.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500 absolute inset-0">
                <AlertCircle size={48} className="mb-4 opacity-50" />
                <p>No hay empleados registrados.</p>
            </div>
        )}
      </div>

      {/* Unified Modal (User Form & Role Manager) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-6 border-b border-brand-700 flex justify-between items-center bg-brand-900/50 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {modalView === 'role-manager' && (
                  <button onClick={() => setModalView('user-form')} className="mr-1 hover:text-brand-accent transition-colors">
                    <ArrowLeft size={20} />
                  </button>
                )}
                {modalView === 'role-manager' ? 'Gestionar Roles' : (editingEmployee ? 'Editar Usuario' : 'Nuevo Usuario')}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white p-2">
                <X size={24} />
              </button>
            </div>

            {/* View: User Form */}
            {modalView === 'user-form' && (
                <form onSubmit={handleSaveUser} className="flex flex-col h-full overflow-hidden">
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Nombre Completo</label>
                        <input 
                            required
                            type="text" 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full bg-brand-900 border border-brand-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all"
                            placeholder="Ej. Juan Pérez"
                        />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    {editingEmployee ? "Nuevo PIN (Opcional)" : "PIN (4 dígitos)"}
                                </label>
                                <input 
                                required={!editingEmployee} // Required only for new users
                                type="tel" 
                                inputMode="numeric"
                                maxLength={4}
                                pattern="\d{4}"
                                value={formData.pin}
                                onChange={(e) => setFormData({...formData, pin: e.target.value.replace(/\D/g,'')})}
                                className="w-full bg-brand-900 border border-brand-700 rounded-lg px-4 py-3 text-white font-mono text-center tracking-widest focus:ring-2 focus:ring-brand-accent outline-none placeholder:text-gray-600 placeholder:text-xs placeholder:tracking-normal"
                                placeholder={editingEmployee ? "Sin cambios" : "0000"}
                                />
                            </div>
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-400 mb-1">Rol</label>
                                <div className="flex gap-2">
                                    <select 
                                    value={formData.role}
                                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                                    className="w-full bg-brand-900 border border-brand-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-accent outline-none appearance-none capitalize"
                                    >
                                    {roles.map(r => (
                                        <option key={r.id} value={r.name}>{r.name}</option>
                                    ))}
                                    </select>
                                    <button 
                                        type="button"
                                        onClick={() => setModalView('role-manager')}
                                        className="px-3 bg-brand-700 rounded-lg text-gray-300 hover:bg-brand-600 hover:text-white transition-colors border border-brand-600"
                                        title="Gestionar Roles"
                                    >
                                        <Settings2 size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-brand-700/50">
                            <p className="text-sm font-bold text-gray-300 uppercase mb-3 px-1">Permisos por Módulo</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {MODULES.map(mod => {
                                    const isAllowed = hasModuleAccess(mod.id, formData.role, userModulePermissions);
                                    
                                    return (
                                        <label key={mod.id} className={`flex items-center justify-between cursor-pointer group p-3 rounded-lg border transition-colors ${isAllowed ? 'bg-brand-900 border-brand-600/50 hover:border-brand-500' : 'bg-brand-900/30 border-brand-700/30 hover:border-brand-600/50'}`}>
                                            <span className={`text-sm transition-colors ${isAllowed ? 'text-white font-medium' : 'text-gray-400 group-hover:text-gray-300'}`}>{mod.label}</span>
                                            <div className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer"
                                                    checked={isAllowed}
                                                    onChange={(e) => {
                                                        const newVal = e.target.checked;
                                                        setUserModulePermissions(prev => ({
                                                            ...prev,
                                                            [mod.id]: newVal
                                                        }));
                                                    }}
                                                />
                                                <div className="w-9 h-5 bg-brand-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-accent opacity-90"></div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg flex items-start gap-2">
                                <AlertCircle size={16} className="text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-300/80 leading-relaxed">
                                    Por defecto los accesos se pre-calculan dependiendo del rol elegido. Si cambias el interruptor, estarás estableciendo un <strong>permiso específico (forzado)</strong> que sobrescribirá el permiso predeterminado del rol para ese usuario concreto.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t border-brand-700 bg-brand-900/30 flex justify-end gap-3 shrink-0">
                        <button 
                        type="button" 
                        onClick={() => setIsModalOpen(false)}
                        className="px-6 py-3 rounded-lg text-gray-300 hover:bg-brand-700 transition-colors font-medium"
                        >
                        Cancelar
                        </button>
                        <button 
                        type="submit"
                        disabled={saving}
                        className="bg-brand-accent hover:bg-brand-accentHover text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Guardar
                        </button>
                    </div>
                </form>
            )}

            {/* View: Role Manager */}
            {modalView === 'role-manager' && (
                <div className="flex flex-col h-full overflow-hidden">
                    <div className="p-4 bg-brand-900/30 border-b border-brand-700">
                        <form onSubmit={handleAddRole} className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Nombre nuevo rol..."
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                className="flex-1 bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-accent outline-none text-sm"
                            />
                            <button 
                                type="submit"
                                disabled={roleLoading || !newRoleName.trim()}
                                className="bg-brand-accent hover:bg-brand-accentHover text-white px-3 py-2 rounded-lg font-bold disabled:opacity-50"
                            >
                                <Plus size={18} />
                            </button>
                        </form>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {roles.map((role) => (
                            <div key={role.id} className="flex items-center justify-between p-3 bg-brand-900/50 rounded-lg border border-brand-700/50">
                                {editingRoleId === role.id ? (
                                    <div className="flex flex-col gap-3 w-full">
                                        <div className="flex gap-2 w-full">
                                            <input 
                                                type="text" 
                                                value={editingRoleName}
                                                onChange={(e) => setEditingRoleName(e.target.value)}
                                                className="flex-1 bg-brand-800 border border-brand-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-brand-accent"
                                                autoFocus
                                            />
                                            <button type="button" onClick={() => handleUpdateRole(role.name)} className="text-green-400 p-1 hover:bg-green-500/10 rounded"><Check size={20} /></button>
                                            <button type="button" onClick={cancelEditRole} className="text-gray-400 p-1 hover:bg-gray-500/10 rounded"><X size={20} /></button>
                                        </div>
                                        <div className="space-y-3 mt-2 border-t border-brand-700/50 pt-3">
                                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Permisos</p>
                                            {[
                                                { id: 'can_discount', label: 'Aplicar descuentos' },
                                                { id: 'can_open_drawer', label: 'Abrir cajón portamonedas' },
                                                { id: 'can_void_ticket', label: 'Anular tickets cerrados' },
                                                { id: 'can_manage_inventory', label: 'Gestionar inventario' },
                                                { id: 'can_manage_employees', label: 'Gestionar empleados' },
                                                { id: 'can_view_reports', label: 'Ver informes y analíticas' },
                                                { id: 'can_manage_settings', label: 'Configuración del sistema' }
                                            ].map(perm => (
                                                <label key={perm.id} className="flex items-center justify-between cursor-pointer group">
                                                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{perm.label}</span>
                                                    <div className="relative inline-flex items-center cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            className="sr-only peer"
                                                            checked={!!editingRolePermissions[perm.id]}
                                                            onChange={(e) => setEditingRolePermissions({...editingRolePermissions, [perm.id]: e.target.checked})}
                                                        />
                                                        <div className="w-9 h-5 bg-brand-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-accent"></div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }}></div>
                                            <span className="font-medium text-gray-200 capitalize">{role.name}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button type="button" onClick={() => startEditRole(role)} disabled={roleLoading} className="text-blue-400 hover:text-blue-300 p-2 hover:bg-blue-400/10 rounded-lg transition-colors"><Edit2 size={16} /></button>
                                            <button type="button" onClick={(e) => handleRequestDeleteRole(e, role)} disabled={roleLoading} className="text-red-400 hover:text-red-300 p-2 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer" title="Eliminar rol"><Trash2 size={16} /></button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-brand-700 bg-brand-900/30 text-center">
                        <button type="button" onClick={() => setModalView('user-form')} className="text-brand-accent hover:text-white text-sm font-medium transition-colors">Volver al formulario de usuario</button>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Role Modal */}
      {deleteRoleModalOpen && roleToDelete && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-red-500 w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">¿Eliminar rol?</h3>
                <p className="text-gray-400 mb-6">Se eliminará el rol <span className="text-white font-bold uppercase">{roleToDelete.name}</span>.<br/><span className="text-xs text-gray-500">Esta acción no se puede deshacer.</span></p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteRoleModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-brand-900 text-gray-300 hover:bg-brand-700 font-medium transition-colors">Cancelar</button>
                  <button onClick={confirmDeleteRole} disabled={roleLoading} className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors flex items-center justify-center gap-2">{roleLoading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />} Eliminar</button>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteModalOpen && employeeToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-brand-800 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-500 w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">¿Eliminar usuario?</h3>
              <p className="text-gray-400 mb-6">Estás a punto de eliminar a <span className="text-white font-bold">{employeeToDelete.name}</span>. Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-brand-900 text-gray-300 hover:bg-brand-700 font-medium transition-colors">Cancelar</button>
                <button onClick={confirmDeleteUser} disabled={isDeleting} className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors flex items-center justify-center gap-2">{isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />} Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Notification Modal */}
      {notification.show && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-brand-800 border-2 border-brand-600 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
                <div className={`h-2 w-full ${notification.type === 'error' ? 'bg-red-500' : notification.type === 'success' ? 'bg-green-500' : 'bg-brand-accent'}`}></div>
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full shrink-0 ${notification.type === 'error' ? 'bg-red-500/20 text-red-500' : notification.type === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-brand-accent/20 text-brand-accent'}`}>
                             {notification.type === 'error' ? <XCircle size={24} /> : notification.type === 'success' ? <Check size={24} /> : <AlertCircle size={24} />}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-1">{notification.title}</h3>
                            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{notification.message}</p>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button onClick={closeNotification} className="bg-brand-700 hover:bg-brand-600 text-white px-5 py-2.5 rounded-xl font-medium transition-colors w-full sm:w-auto">Entendido</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;