import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Package, Search, Plus, Edit2, Trash2, Save, X, Filter, 
  TrendingUp, AlertTriangle, CheckCircle, Truck, Tag, DollarSign,
  Loader2, MoreHorizontal, ArrowLeft, Info, GitFork, CheckSquare, Square, FolderInput,
  ChevronLeft, ChevronRight, XCircle, ShieldAlert, Wheat, Layers, Scroll, Scale, Utensils,
  Droplets, Box, Ruler, Upload, Image as ImageIcon, History as HistoryIcon, Clock, TrendingDown, Ban, Download, Barcode, Percent
} from 'lucide-react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Product, ProductCategory, ProductSubcategory, Supplier, Allergen, ProductVariant, ProductIngredient, StockUnit, UnitOfMeasure, StockMovement, Employee, WasteReason, ViewState, ProductModifier, Course, Promotion } from '../../types';
import * as InventoryService from '../../services/inventoryService';
import { useAuthStore } from '../../stores/useAuthStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../db';
import { supabase } from '../../Supabase';
import AdminNavigation from '../AdminNavigation';
import BarcodeLib from 'react-barcode';

type InventoryTab = 'products' | 'categories' | 'subcategories' | 'suppliers' | 'allergens' | 'units' | 'waste_reasons' | 'courses' | 'purchase_orders' | 'promotions';
type EditableField = 'cost_price' | 'selling_price' | 'stock_current';

interface InventoryManagementProps {
  onBack: () => void;
  onNavigate: (view: ViewState) => void;
}

// --- ROW COMPONENTS (Standard Functional Components) ---

// Define prop type explicitly matching what react-window passes
interface ProductRowData {
    items: Product[];
    selectedIds: Set<string>;
    toggleSelection: (id: string) => void;
    handleStartEdit: (p: Product, f: EditableField) => void;
    handleEditKeyDown: (e: React.KeyboardEvent) => void;
    handleSaveEdit: () => void;
    editingCell: { id: string, field: EditableField } | null;
    editValue: string;
    setEditValue: (val: string) => void;
    onRequestDelete: (item: any, type: InventoryTab, e?: React.MouseEvent) => void;
    handleOpenModal: (item: any) => void;
    handleOpenWasteModal: (p: Product) => void;
    handleOpenHistory: (p: Product) => void;
    handleOpenBarcodeModal: (p: Product) => void;
    isEditable: (p: Product, f: EditableField) => boolean;
    getStockDisplay: (p: Product) => string;
    getPriceDisplay: (p: Product) => string;
    getCategoryName: (id: string) => string;
}

const ProductRow: React.FC<ListChildComponentProps<ProductRowData>> = ({ index, style, data }) => {
    const [menuPos, setMenuPos] = useState<{ top: number, right: number, openUpwards: boolean } | null>(null);

    useEffect(() => {
        const closeMenu = (e: MouseEvent | Event) => {
            // Don't close if clicking inside the menu
            const target = e.target as HTMLElement;
            if (target.closest('.action-menu-portal')) {
                return;
            }
            setMenuPos(null);
        };
        if (menuPos) {
            document.addEventListener('mousedown', closeMenu);
            window.addEventListener('scroll', closeMenu, true);
        }
        return () => {
            document.removeEventListener('mousedown', closeMenu);
            window.removeEventListener('scroll', closeMenu, true);
        };
    }, [menuPos]);

    // Safety check: ensure data and items exist
    if (!data || !data.items || !data.items[index]) return null;

    const product = data.items[index];
    const { 
        selectedIds, toggleSelection, handleStartEdit, editingCell, 
        editValue, setEditValue, handleSaveEdit, handleEditKeyDown,
        onRequestDelete, handleOpenModal, handleOpenWasteModal, handleOpenHistory,
        isEditable, getStockDisplay, getPriceDisplay, getCategoryName
    } = data;

    const isSelected = selectedIds.has(product.id);
    const displayStock = getStockDisplay(product);
    const displayPrice = getPriceDisplay(product);

    const handleToggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (menuPos) {
            setMenuPos(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = 200; // approx height of 5 items
            const openUpwards = spaceBelow < menuHeight && rect.top > menuHeight;

            setMenuPos({
                top: openUpwards ? rect.top - 4 : rect.bottom + 4,
                right: window.innerWidth - rect.right,
                openUpwards
            });
        }
    };

    return (
        <div style={style} className={`flex items-center border-b border-brand-700/50 hover:bg-brand-700/30 transition-colors ${isSelected ? 'bg-brand-700/20' : ''}`}>
            {/* Checkbox */}
            <div className="w-12 text-center shrink-0">
                <button onClick={() => toggleSelection(product.id)} className={`${isSelected ? 'text-brand-accent' : 'text-gray-600 hover:text-gray-400'}`}>
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
            </div>

            {/* Product Name & Image */}
            <div className="flex-1 min-w-0 p-2 pl-0 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-900 border border-brand-700 overflow-hidden shrink-0 flex items-center justify-center">
                    {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-brand-700" />}
                </div>
                <div className="truncate flex flex-col justify-center">
                    <div className="font-medium text-white truncate leading-tight">{product.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400 truncate">{getCategoryName(product.category_id)}</span>
                        {product.variants && product.variants.length > 0 && <span className="text-[9px] bg-brand-700 text-gray-300 px-1 py-0.5 rounded border border-brand-600 leading-none">{product.variants.length} Var.</span>}
                    </div>
                </div>
            </div>

            {/* Type (Hidden on Mobile) */}
            <div className="w-24 hidden md:flex items-center p-2">
                {product.is_compound ? 
                    <span className="text-[10px] uppercase font-bold text-brand-accent bg-brand-accent/10 px-2 py-1 rounded flex items-center gap-1 w-fit"><Scroll size={10} /> Receta</span> :
                    <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded flex items-center gap-1 w-fit"><Package size={10} /> Simple</span>
                }
            </div>

            {/* Tags (Hidden on Mobile) */}
            <div className="w-64 hidden lg:flex items-center p-2" title={InventoryService.getRegularAttributes(product).join(', ')}>
                <div className="flex flex-wrap gap-1 overflow-hidden max-h-14">
                    {InventoryService.getRegularAttributes(product).map((tag, i) => (
                        <span key={i} className="text-[9px] bg-brand-900 border border-brand-700 px-1.5 py-0.5 rounded text-gray-400 whitespace-nowrap">{tag}</span>
                    ))}
                </div>
            </div>

            {/* Cost */}
            <div className="w-24 text-right p-2 text-gray-300 font-mono" onClick={() => handleStartEdit(product, 'cost_price')}>
                {editingCell?.id === product.id && editingCell.field === 'cost_price' ? (
                    <input autoFocus type="number" step="0.01" className="w-full bg-brand-900 border border-brand-accent rounded px-1 py-0.5 text-right outline-none text-white font-mono" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={handleSaveEdit} onKeyDown={handleEditKeyDown} onClick={e => e.stopPropagation()} />
                ) : (
                    <span className={isEditable(product, 'cost_price') ? "cursor-pointer hover:text-white border-b border-dashed border-transparent hover:border-gray-500 transition-all" : ""}>
                        {product.cost_price.toFixed(2).replace('.', ',')}€
                    </span>
                )}
            </div>

            {/* PVP */}
            <div className="w-24 text-right p-2 font-bold text-white font-mono" onClick={() => handleStartEdit(product, 'selling_price')}>
                {editingCell?.id === product.id && editingCell.field === 'selling_price' ? (
                    <input autoFocus type="number" step="0.01" className="w-full bg-brand-900 border border-brand-accent rounded px-1 py-0.5 text-right outline-none text-white font-bold font-mono" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={handleSaveEdit} onKeyDown={handleEditKeyDown} onClick={e => e.stopPropagation()} />
                ) : (
                    <span className={isEditable(product, 'selling_price') ? "cursor-pointer hover:text-brand-accent border-b border-dashed border-transparent hover:border-brand-accent/50 transition-all" : ""}>
                        {displayPrice}
                    </span>
                )}
            </div>

            {/* Stock */}
            <div className="w-20 text-center p-2 font-mono text-sm" onClick={() => handleStartEdit(product, 'stock_current')}>
                {editingCell?.id === product.id && editingCell.field === 'stock_current' ? (
                    <input autoFocus type="number" className="w-full bg-brand-900 border border-brand-accent rounded px-1 py-0.5 text-center outline-none text-white font-mono" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={handleSaveEdit} onKeyDown={handleEditKeyDown} onClick={e => e.stopPropagation()} />
                ) : (
                    <span className={isEditable(product, 'stock_current') ? "cursor-pointer hover:text-white border-b border-dashed border-transparent hover:border-gray-500 transition-all" : ""}>
                        {displayStock}
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className="w-16 text-right p-2 pr-4 flex justify-end">
                <div className="relative">
                    <button 
                        onClick={handleToggleMenu} 
                        className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-brand-700 transition-colors"
                    >
                        <MoreHorizontal size={18} />
                    </button>
                    {menuPos && createPortal(
                        <div 
                            className="action-menu-portal fixed w-48 bg-brand-800 border border-brand-600 rounded-lg shadow-xl z-[9999] py-1 overflow-y-auto"
                            style={{ 
                                top: menuPos.top,
                                right: menuPos.right,
                                transform: menuPos.openUpwards ? 'translateY(-100%)' : 'none',
                                maxHeight: menuPos.openUpwards ? `${menuPos.top - 8}px` : `${window.innerHeight - menuPos.top - 8}px`
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button onClick={() => { setMenuPos(null); data.handleOpenBarcodeModal(product); }} className="w-full text-left px-4 py-2 text-sm text-green-400 hover:bg-brand-700 flex items-center gap-2"><Barcode size={14} className="shrink-0" /> Imprimir Etiqueta</button>
                            <button onClick={() => { setMenuPos(null); handleOpenWasteModal(product); }} className="w-full text-left px-4 py-2 text-sm text-orange-400 hover:bg-brand-700 flex items-center gap-2"><TrendingDown size={14} className="shrink-0" /> Merma</button>
                            <button onClick={() => { setMenuPos(null); handleOpenHistory(product); }} className="w-full text-left px-4 py-2 text-sm text-purple-400 hover:bg-brand-700 flex items-center gap-2"><HistoryIcon size={14} className="shrink-0" /> Historial</button>
                            <button onClick={() => { setMenuPos(null); handleOpenModal(product); }} className="w-full text-left px-4 py-2 text-sm text-blue-400 hover:bg-brand-700 flex items-center gap-2"><Edit2 size={14} className="shrink-0" /> Editar</button>
                            <button onClick={(e) => { setMenuPos(null); onRequestDelete(product, 'products', e); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-brand-700 flex items-center gap-2"><Trash2 size={14} className="shrink-0" /> Eliminar</button>
                        </div>,
                        document.body
                    )}
                </div>
            </div>
        </div>
    );
};

const HistoryRow: React.FC<ListChildComponentProps<StockMovement[]>> = ({ index, style, data }) => {
    // Safety check
    if (!data || !data[index]) return null;
    
    const log = data[index];
    const isWaste = log.reason.startsWith('Merma');
    return (
        <div style={style} className="flex items-center border-b border-brand-700/30 hover:bg-brand-700/20 text-sm">
            <div className="w-1/4 p-3 text-gray-300">{new Date(log.created_at).toLocaleString()}</div>
            <div className="w-1/4 p-3 font-medium text-white">{log.employees?.name || 'Sistema'}</div>
            <div className="w-1/4 p-3">
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${log.reason === 'Venta' ? 'bg-green-500/10 text-green-400' : isWaste ? 'bg-red-500/10 text-red-400' : 'bg-gray-700 text-gray-300'}`}>
                    {log.reason}
                </span>
            </div>
            <div className={`w-1/8 p-3 text-right font-mono font-bold ${log.quantity_change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
            </div>
            <div className="w-1/8 p-3 text-center font-mono text-gray-400 flex-1">
                {log.new_stock_level}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const InventoryManagement: React.FC<InventoryManagementProps> = ({ onBack, onNavigate }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<InventoryTab>('products');
  
  // React Query Data Fetching
  const { data: products = [], isLoading: loadingProducts } = useQuery({ queryKey: ['products'], queryFn: InventoryService.getAllProducts });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: InventoryService.getAllCategories });
  const { data: subcategories = [] } = useQuery({ queryKey: ['subcategories'], queryFn: InventoryService.getAllSubcategories });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: InventoryService.getAllSuppliers });
  const { data: allergens = [] } = useQuery({ queryKey: ['allergens'], queryFn: InventoryService.getAllAllergens });
  const { data: units = [] } = useQuery({ queryKey: ['units'], queryFn: InventoryService.getAllUnits });
  const { data: wasteReasons = [] } = useQuery({ queryKey: ['wasteReasons'], queryFn: InventoryService.getAllWasteReasons });
  const { data: courses = [] } = useQuery({ queryKey: ['courses'], queryFn: InventoryService.getAllCourses });
  const { data: promotions = [] } = useQuery({ queryKey: ['promotions'], queryFn: InventoryService.getPromotions });

  // Purchase Orders Query
  const { data: purchaseOrders = [], refetch: refetchPurchaseOrders } = useQuery({
      queryKey: ['purchase_orders'],
      queryFn: async () => {
          const { data, error } = await supabase
              .from('purchase_orders')
              .select(`
                  *,
                  suppliers (name),
                  purchase_order_items (
                      *,
                      products (name)
                  )
              `)
              .order('created_at', { ascending: false });
          if (error) throw error;
          return data;
      }
  });

  const loading = loadingProducts;
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [subcategoryFilter, setSubcategoryFilter] = useState('all');
  const [allergenFilter, setAllergenFilter] = useState<string>('all'); 
  const [typeFilter, setTypeFilter] = useState<'all' | 'simple' | 'compound'>('all');

  // Bulk Selection State
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set<string>());
  const [bulkMoveModalOpen, setBulkMoveModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<{categoryId: string, subcategoryId: string}>({ categoryId: '', subcategoryId: '' });

  // Edit/Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline Editing State
  const [editingCell, setEditingCell] = useState<{ id: string, field: EditableField } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);
  const [historyLogs, setHistoryLogs] = useState<StockMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Barcode Modal State
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<Product | null>(null);

  // Waste Registration Modal State
  const [wasteModalOpen, setWasteModalOpen] = useState(false);
  const [selectedProductForWaste, setSelectedProductForWaste] = useState<Product | null>(null);
  const [wasteForm, setWasteForm] = useState<{ quantity: string; reasonId: string }>({ quantity: '', reasonId: '' });

  // Delivery Note Modal State
  const [isDeliveryNoteModalOpen, setIsDeliveryNoteModalOpen] = useState(false);
  const [deliveryNoteItems, setDeliveryNoteItems] = useState<Array<{ product_id: string; quantity: string; price: string }>>([]);
  const [deliveryNoteNotes, setDeliveryNoteNotes] = useState('');

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Image Upload State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: InventoryTab; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Blocked Delete State (Frontend Logic Warning)
  const [blockedDelete, setBlockedDelete] = useState<{ type: string, name: string, count: number } | null>(null);

  // Foreign Key Violation Modal State (Backend Logic Warning)
  const [fkViolation, setFkViolation] = useState<{ 
      show: boolean; 
      productName: string; 
      productId: string; 
      type: 'orders' | 'ingredients' | 'other';
  }>({ show: false, productName: '', productId: '', type: 'other' });

  // Update Category/Subcategory Confirmation State
  const [confirmUpdateModalOpen, setConfirmUpdateModalOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string, name: string, categoryId?: string, type: 'categories' | 'subcategories', affectedCount: number } | null>(null);

  // Product Form State
  const [productForm, setProductForm] = useState<Partial<Product> & { selectedAllergens: Set<string>, variants: ProductVariant[], hasVariants: boolean, ingredients: ProductIngredient[], modifiers: ProductModifier[] }>({
    name: '',
    category_id: '',
    subcategory_id: '',
    supplier_id: '',
    cost_price: 0,
    selling_price: 0,
    tax_rate: 10,
    stock_current: 0,
    stock_min: 5,
    stock_unit: 'u',
    attributes: [],
    active: true,
    is_compound: false,
    selectedAllergens: new Set<string>(),
    variants: [],
    hasVariants: false,
    ingredients: [],
    image_url: '',
    barcode: '',
    modifiers: []
  });

  // Ingredient Form State (Inside Product Modal)
  const [ingredientForm, setIngredientForm] = useState<{ productId: string, quantity: string, yieldPercentage: string }>({ productId: '', quantity: '', yieldPercentage: '100' });
  
  // Tag Input State
  const [tagInput, setTagInput] = useState('');

  // Local state for adding a new variant inside the modal
  const [newVariant, setNewVariant] = useState<Partial<ProductVariant>>({
      name: '',
      cost_price: 0,
      selling_price: 0,
      stock_current: 0
  });
  
  const [promotionForm, setPromotionForm] = useState<Partial<Promotion>>({
      name: '',
      discount_type: 'percentage',
      discount_value: 0,
      start_time: '00:00',
      end_time: '23:59',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      applicable_categories: [],
      is_active: true
  });

  // Forms for simple entities
  const [simpleFormName, setSimpleFormName] = useState(''); 
  const [simpleFormParentId, setSimpleFormParentId] = useState(''); 
  const [simpleFormKdsStation, setSimpleFormKdsStation] = useState<'kitchen' | 'bar' | 'none' | ''>('');
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({ name: '', phone: '', contact_name: '' });
  const [unitForm, setUnitForm] = useState({ name: '', abbreviation: '' });
  const [courseForm, setCourseForm] = useState({ name: '', order_index: 0 });
  const [purchaseOrderForm, setPurchaseOrderForm] = useState<{
    supplier_id: string;
    expected_date: string;
    notes: string;
    items: Array<{ product_id: string; quantity: number; cost_price: number }>;
  }>({ supplier_id: '', expected_date: '', notes: '', items: [] });

  useEffect(() => {
    setSubcategoryFilter('all');
  }, [categoryFilter]);

  const refreshData = () => {
      queryClient.invalidateQueries();
  };

  const normalizeText = (text: string) => {
      return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const filteredProducts = useMemo(() => {
    let result = products;
    if (searchTerm.trim()) {
        const term = normalizeText(searchTerm);
        const searchTokens = term.split(' ').filter(t => t.length > 0);
        result = result.filter(p => {
            const categoryName = categories.find(c => c.id === p.category_id)?.name || '';
            const supplierName = suppliers.find(s => s.id === p.supplier_id)?.name || '';
            const searchableString = normalizeText(`
                ${p.name} 
                ${supplierName} 
                ${p.attributes?.join(' ') || ''} 
                ${p.variants?.map(v => v.name).join(' ') || ''}
                ${categoryName}
            `);
            return searchTokens.every(token => searchableString.includes(token));
        });
    }

    if (categoryFilter !== 'all') {
        result = result.filter(p => p.category_id === categoryFilter);
    }
    if (subcategoryFilter !== 'all') {
        result = result.filter(p => p.subcategory_id === subcategoryFilter);
    }
    if (allergenFilter !== 'all') {
        result = result.filter(p => !p.allergens?.some(a => a.id === allergenFilter));
    }
    if (typeFilter === 'simple') result = result.filter(p => !p.is_compound);
    if (typeFilter === 'compound') result = result.filter(p => p.is_compound);

    return result;
  }, [products, searchTerm, categoryFilter, subcategoryFilter, allergenFilter, typeFilter, categories, suppliers]);

  useEffect(() => {
    if (productForm.is_compound && productForm.ingredients) {
        const calculatedCost = productForm.ingredients.reduce((acc, ing) => {
            const child = products.find(p => p.id === ing.child_product_id);
            const cost = child ? child.cost_price : 0;
            const yieldPct = ing.yield_percentage || 100;
            return acc + ((cost * ing.quantity) / (yieldPct / 100));
        }, 0);
        
        if (Math.abs(calculatedCost - (productForm.cost_price || 0)) > 0.001) {
            setProductForm(prev => ({ ...prev, cost_price: parseFloat(calculatedCost.toFixed(3)) }));
        }
    }
  }, [productForm.ingredients, productForm.is_compound, products]);

  const handleExport = async () => {
      try {
          await InventoryService.downloadInventoryCSV();
      } catch (err) {
          alert("Error descargando inventario.");
      }
  };

  const handleImportClick = () => {
      importFileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setIsImporting(true);
          try {
              const result = await InventoryService.processInventoryImport(file, user?.id);
              alert(`Importación completada.\nCorrectos: ${result.success}\nErrores: ${result.errors}`);
              refreshData();
          } catch (err: any) {
              alert("Error importando archivo: " + err.message);
          } finally {
              setIsImporting(false);
              if (importFileInputRef.current) importFileInputRef.current.value = '';
          }
      }
  };

  const handleStartEdit = (product: Product, field: EditableField) => {
      if (product.is_compound && field === 'cost_price') return;
      if (product.is_compound && field === 'stock_current') return;
      if (product.variants && product.variants.length > 0) return;

      setEditingCell({ id: product.id, field });
      setEditValue(String(product[field]));
  };

  const handleSaveEdit = async () => {
      if (!editingCell) return;
      const newValue = parseFloat(editValue);
      if (isNaN(newValue)) {
          setEditingCell(null);
          return;
      }
      const { id, field } = editingCell;
      try {
          await InventoryService.updateProduct(id, { [field]: newValue }, user?.id);
          queryClient.invalidateQueries({ queryKey: ['products'] });
      } catch (err: any) {
          alert("Error actualizando: " + err.message);
      } finally {
          setEditingCell(null);
      }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleSaveEdit();
      } else if (e.key === 'Escape') {
          setEditingCell(null);
      }
  };

  const handleOpenHistory = async (product: Product) => {
      setSelectedProductForHistory(product);
      setHistoryModalOpen(true);
      setLoadingHistory(true);
      try {
          const logs = await InventoryService.getStockMovements(product.id);
          setHistoryLogs(logs);
      } catch (error) {
          console.error("Error loading history", error);
      } finally {
          setLoadingHistory(false);
      }
  };

  const handleOpenWasteModal = (product: Product) => {
      setSelectedProductForWaste(product);
      setWasteForm({ quantity: '', reasonId: '' });
      setWasteModalOpen(true);
  };

  const handleRegisterWaste = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedProductForWaste || !wasteForm.quantity || !wasteForm.reasonId) return;
      const qty = parseFloat(wasteForm.quantity);
      if (isNaN(qty) || qty <= 0) {
          alert("Cantidad inválida");
          return;
      }
      const reason = wasteReasons.find(r => r.id === wasteForm.reasonId)?.name || 'Desconocido';
      setSaving(true);
      try {
          await InventoryService.registerWaste(selectedProductForWaste.id, qty, reason, user?.id || '');
          setWasteModalOpen(false);
          refreshData();
      } catch (error: any) {
          alert("Error registrando merma: " + error.message);
      } finally {
          setSaving(false);
      }
  };

  const toggleSelectAll = () => {
      if (selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0) {
          setSelectedProductIds(new Set<string>());
      } else {
          const allIds = new Set(filteredProducts.map(p => p.id));
          setSelectedProductIds(allIds);
      }
  };

  const toggleProductSelection = (id: string) => {
      const newSet = new Set(selectedProductIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedProductIds(newSet);
  };

  const handleBulkUpdate = async () => {
     if (selectedProductIds.size === 0) return;
     if (!bulkForm.categoryId) {
         alert("Selecciona una categoría destino.");
         return;
     }
     setSaving(true);
     try {
         const ids = Array.from(selectedProductIds) as string[];
         await InventoryService.bulkUpdateProductCategory(ids, bulkForm.categoryId, bulkForm.subcategoryId || null);
         setBulkMoveModalOpen(false);
         setBulkForm({ categoryId: '', subcategoryId: '' });
         refreshData();
     } catch (err: any) {
         alert("Error en actualización masiva: " + err.message);
     } finally {
         setSaving(false);
     }
  };

  const handleBulkDelete = async () => {
      if (selectedProductIds.size === 0) return;
      setIsDeleting(true);
      try {
          const ids = Array.from(selectedProductIds) as string[];
          await InventoryService.bulkDeleteProducts(ids);
          setBulkDeleteModalOpen(false);
          refreshData();
      } catch (err: any) {
          alert("Error eliminando productos: " + err.message);
      } finally {
          setIsDeleting(false);
      }
  };

  const handleOpenModal = (item?: any) => {
    setEditingItem(item || null);
    // ... [Previous handleOpenModal logic remains exactly same as original file, omitted for brevity but assumed present]
    if (activeTab === 'products') {
      if (item) {
        // Explicit typing of Set to fix TypeScript inference error (Set<unknown> vs Set<string>)
        const rawAllergens = (item.allergens || []) as Allergen[];
        const allergenIds = new Set<string>(rawAllergens.map((a) => a.id));
        const hasVariants = item.variants && item.variants.length > 0;
        
        const modifiers = InventoryService.getProductModifiers(item);
        const regularAttributes = InventoryService.getRegularAttributes(item);

        setProductForm({
            ...item,
            selectedAllergens: allergenIds,
            variants: item.variants || [],
            ingredients: item.ingredients || [],
            hasVariants: hasVariants,
            is_compound: item.is_compound || false,
            stock_unit: item.stock_unit || 'u',
            attributes: regularAttributes,
            modifiers: modifiers,
            image_url: item.image_url || '',
            barcode: item.barcode || ''
        });
        setImagePreview(item.image_url || null);
      } else {
        setProductForm({
          name: '',
          category_id: categories.length > 0 ? categories[0].id : '',
          subcategory_id: '',
          supplier_id: '',
          cost_price: 0,
          selling_price: 0,
          tax_rate: 10,
          stock_current: 0,
          stock_min: 5,
          stock_unit: units.length > 0 ? units[0].abbreviation : 'u',
          attributes: [],
          modifiers: [],
          active: true,
          is_compound: false,
          selectedAllergens: new Set<string>(),
          variants: [],
          hasVariants: false,
          ingredients: [],
          image_url: '',
          barcode: ''
        });
        setImagePreview(null);
      }
      setImageFile(null);
      setTagInput('');
      setNewVariant({ name: '', cost_price: 0, selling_price: 0, stock_current: 0 });
      setIngredientForm({ productId: '', quantity: '', yieldPercentage: '100' });
    } else if (activeTab === 'categories') {
       setSimpleFormName(item ? item.name : '');
       setSimpleFormKdsStation(item ? (item.kds_station || 'none') : 'none');
    } else if (activeTab === 'subcategories') {
       setSimpleFormName(item ? item.name : '');
       setSimpleFormParentId(item ? item.category_id : (categories.length > 0 ? categories[0].id : ''));
    } else if (activeTab === 'suppliers') {
       setSupplierForm(item ? item : { name: '', phone: '', contact_name: '' });
    } else if (activeTab === 'allergens' || activeTab === 'waste_reasons') {
       setSimpleFormName(item ? item.name : '');
    } else if (activeTab === 'units') {
        setUnitForm(item ? { name: item.name, abbreviation: item.abbreviation } : { name: '', abbreviation: '' });
    } else if (activeTab === 'courses') {
        setCourseForm(item ? { name: item.name, order_index: item.order_index } : { name: '', order_index: 0 });
    } else if (activeTab === 'purchase_orders') {
        if (item) {
            setPurchaseOrderForm({
                supplier_id: item.supplier_id || '',
                expected_date: item.expected_date ? new Date(item.expected_date).toISOString().split('T')[0] : '',
                notes: item.notes || '',
                items: item.purchase_order_items ? item.purchase_order_items.map((i: any) => ({
                    product_id: i.product_id,
                    quantity: i.quantity,
                    cost_price: i.cost_price
                })) : []
            });
        } else {
            setPurchaseOrderForm({ supplier_id: '', expected_date: '', notes: '', items: [] });
        }
    } else if (activeTab === 'promotions') {
        setPromotionForm(item ? {
            ...item,
            applicable_products: item.applicable_products || []
        } : {
            name: '',
            discount_type: 'percentage',
            discount_value: 0,
            start_time: '00:00',
            end_time: '23:59',
            days_of_week: [0, 1, 2, 3, 4, 5, 6],
            applicable_categories: [],
            applicable_products: [],
            is_active: true
        });
    }
    setIsModalOpen(true);
  };

  const handleOpenBarcodeModal = (product: Product) => {
      setSelectedProductForBarcode(product);
      setBarcodeModalOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          processFile(e.target.files[0]);
      }
  };

  const handleDragEnter = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          processFile(e.dataTransfer.files[0]);
      }
  };

  const processFile = (file: File) => {
      if (!file.type.startsWith('image/')) {
          alert('Por favor, selecciona un archivo de imagen válido.');
          return;
      }
      setImageFile(file);
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
  };

  const handleRemoveImage = () => {
      setImageFile(null);
      setImagePreview(null);
      setProductForm(prev => ({ ...prev, image_url: '' }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (activeTab === 'products') {
        let imageUrl = productForm.image_url;
        if (imageFile) {
            try {
                imageUrl = await InventoryService.uploadProductImage(imageFile);
            } catch (imgError: any) {
                alert("Error subiendo imagen: " + imgError.message);
            }
        }

        const { 
            product_categories, product_subcategories, suppliers, id, created_at, 
            allergens: existingAllergens, product_allergens, product_ingredients, 
            product_variants, selectedAllergens, variants, hasVariants, ingredients, is_compound, modifiers, ...rest 
        } = productForm as any;

        const encodedModifiers = (modifiers || []).map(InventoryService.encodeModifier);
        const combinedAttributes = [...(rest.attributes || []), ...encodedModifiers];

        const productPayload = {
            ...rest,
            attributes: combinedAttributes,
            image_url: imageUrl,
            is_compound: is_compound,
            category_id: (productForm.category_id === '' || productForm.category_id === 'null') ? null : productForm.category_id,
            subcategory_id: (productForm.subcategory_id === '' || productForm.subcategory_id === 'null') ? null : productForm.subcategory_id,
            supplier_id: (productForm.supplier_id === '' || productForm.supplier_id === 'null') ? null : productForm.supplier_id,
            stock_current: is_compound ? 0 : rest.stock_current,
            stock_min: is_compound ? 0 : rest.stock_min,
            updated_at: new Date().toISOString(),
        };

        const allergenIdsArray = Array.from(selectedAllergens) as string[];
        const variantsData = (hasVariants && !is_compound) ? variants : [];
        const ingredientsData = is_compound ? ingredients : [];

        if (editingItem) {
          await InventoryService.updateProduct(editingItem.id, { 
              ...productPayload, allergen_ids: allergenIdsArray, variants: variantsData, ingredients: ingredientsData
          }, user?.id);
        } else {
          await InventoryService.createProduct({ 
              ...productPayload, allergen_ids: allergenIdsArray, variants: variantsData, ingredients: ingredientsData
          });
        }
        queryClient.invalidateQueries({ queryKey: ['products'] });

      } else if (activeTab === 'categories') {
        if (editingItem) {
           const affectedCount = products.filter(p => p.category_id === editingItem.id).length;
           if (affectedCount > 0 && simpleFormName !== editingItem.name) {
               setPendingUpdate({ id: editingItem.id, name: simpleFormName, type: 'categories', affectedCount });
               setConfirmUpdateModalOpen(true);
               setSaving(false);
               return; 
           }
           await InventoryService.updateCategory(editingItem.id, simpleFormName, simpleFormKdsStation as any);
        } else {
           await InventoryService.createCategory(simpleFormName, simpleFormKdsStation as any);
        }
        queryClient.invalidateQueries({ queryKey: ['categories'] });

      } else if (activeTab === 'subcategories') {
         if (editingItem) {
            const affectedCount = products.filter(p => p.subcategory_id === editingItem.id).length;
            if (affectedCount > 0 && simpleFormName !== editingItem.name) {
                setPendingUpdate({ id: editingItem.id, name: simpleFormName, categoryId: simpleFormParentId, type: 'subcategories', affectedCount });
                setConfirmUpdateModalOpen(true);
                setSaving(false);
                return;
            }
            await InventoryService.updateSubcategory(editingItem.id, simpleFormName, simpleFormParentId);
         } else {
            await InventoryService.createSubcategory(simpleFormName, simpleFormParentId);
         }
         queryClient.invalidateQueries({ queryKey: ['subcategories'] });

      } else if (activeTab === 'suppliers') {
        const { id, created_at, ...supplierPayload } = supplierForm as any;
        if (editingItem) {
            await InventoryService.updateSupplier(editingItem.id, supplierPayload);
        } else {
            await InventoryService.createSupplier(supplierPayload);
        }
        queryClient.invalidateQueries({ queryKey: ['suppliers'] });

      } else if (activeTab === 'allergens') {
          if (editingItem) {
              await InventoryService.updateAllergen(editingItem.id, simpleFormName);
          } else {
              await InventoryService.createAllergen(simpleFormName);
          }
          queryClient.invalidateQueries({ queryKey: ['allergens'] });

      } else if (activeTab === 'units') {
          if (editingItem) {
              await InventoryService.updateUnit(editingItem.id, unitForm);
          } else {
              await InventoryService.createUnit(unitForm.name, unitForm.abbreviation);
          }
          queryClient.invalidateQueries({ queryKey: ['units'] });
      } else if (activeTab === 'waste_reasons') {
          if (editingItem) {
              await InventoryService.updateWasteReason(editingItem.id, simpleFormName);
          } else {
              await InventoryService.createWasteReason(simpleFormName);
          }
          queryClient.invalidateQueries({ queryKey: ['wasteReasons'] });
      } else if (activeTab === 'courses') {
          if (editingItem) {
              await InventoryService.updateCourse(editingItem.id, courseForm.name, courseForm.order_index);
          } else {
              await InventoryService.createCourse(courseForm.name, courseForm.order_index);
          }
          queryClient.invalidateQueries({ queryKey: ['courses'] });
      } else if (activeTab === 'purchase_orders') {
          if (!purchaseOrderForm.supplier_id) {
              alert('Debes seleccionar un proveedor.');
              setSaving(false);
              return;
          }
          if (purchaseOrderForm.items.length === 0) {
              alert('Debes añadir al menos un producto al pedido.');
              setSaving(false);
              return;
          }
          
          const total = purchaseOrderForm.items.reduce((acc, item) => acc + (item.quantity * item.cost_price), 0);
          
          if (editingItem) {
              const { error: orderError } = await supabase
                  .from('purchase_orders')
                  .update({ 
                      supplier_id: purchaseOrderForm.supplier_id, 
                      expected_date: purchaseOrderForm.expected_date || null,
                      notes: purchaseOrderForm.notes,
                      total: total
                  })
                  .eq('id', editingItem.id);
                  
              if (orderError) throw orderError;
              
              // Delete existing items
              const { error: deleteError } = await supabase
                  .from('purchase_order_items')
                  .delete()
                  .eq('purchase_order_id', editingItem.id);
                  
              if (deleteError) throw deleteError;
              
              // Insert new items
              const itemsToInsert = purchaseOrderForm.items.map(item => ({
                  purchase_order_id: editingItem.id,
                  product_id: item.product_id,
                  quantity: item.quantity,
                  cost_price: item.cost_price
              }));
              
              const { error: itemsError } = await supabase
                  .from('purchase_order_items')
                  .insert(itemsToInsert);
                  
              if (itemsError) throw itemsError;
              
          } else {
              const { data: order, error: orderError } = await supabase
                  .from('purchase_orders')
                  .insert([{ 
                      supplier_id: purchaseOrderForm.supplier_id, 
                      expected_date: purchaseOrderForm.expected_date || null,
                      notes: purchaseOrderForm.notes,
                      total: total,
                      status: 'pending'
                  }])
                  .select()
                  .single();
                  
              if (orderError) throw orderError;
              
              const itemsToInsert = purchaseOrderForm.items.map(item => ({
                  purchase_order_id: order.id,
                  product_id: item.product_id,
                  quantity: item.quantity,
                  cost_price: item.cost_price
              }));
              
              const { error: itemsError } = await supabase
                  .from('purchase_order_items')
                  .insert(itemsToInsert);
                  
              if (itemsError) throw itemsError;
          }
          
          refetchPurchaseOrders();
      } else if (activeTab === 'promotions') {
          await InventoryService.savePromotion({
              ...promotionForm,
              id: editingItem?.id
          } as Promotion);
          queryClient.invalidateQueries({ queryKey: ['promotions'] });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert(`Error al guardar: ${err.message || JSON.stringify(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const proceedWithPendingUpdate = async () => {
      if (!pendingUpdate) return;
      setSaving(true);
      try {
          if (pendingUpdate.type === 'categories') {
              await InventoryService.updateCategory(pendingUpdate.id, pendingUpdate.name, simpleFormKdsStation as any);
              queryClient.invalidateQueries({ queryKey: ['categories'] });
          } else if (pendingUpdate.type === 'subcategories') {
              const catId = pendingUpdate.categoryId || simpleFormParentId;
              await InventoryService.updateSubcategory(pendingUpdate.id, pendingUpdate.name, catId);
              queryClient.invalidateQueries({ queryKey: ['subcategories'] });
          }
          setConfirmUpdateModalOpen(false);
          setPendingUpdate(null);
          setIsModalOpen(false); 
          queryClient.invalidateQueries({ queryKey: ['products'] });
      } catch (err: any) {
          alert("Error actualizando: " + err.message);
      } finally {
          setSaving(false);
      }
  };

  const onRequestDelete = (item: any, type: InventoryTab, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (type === 'categories') {
        const count = products.filter(p => p.category_id === item.id).length;
        if (count > 0) {
            setBlockedDelete({ type: 'Category', name: item.name, count });
            return;
        }
    }
    if (type === 'subcategories') {
        const count = products.filter(p => p.subcategory_id === item.id).length;
        if (count > 0) {
            setBlockedDelete({ type: 'Subcategory', name: item.name, count });
            return;
        }
    }
    if (type === 'allergens') {
        const count = products.filter(p => p.allergens?.some(a => a.id === item.id)).length;
        if (count > 0) {
            setBlockedDelete({ type: 'Allergen', name: item.name, count });
            return;
        }
    }
    if (type === 'units') {
        const count = products.filter(p => p.stock_unit === item.abbreviation).length;
        if (count > 0) {
            setBlockedDelete({ type: 'Unidad', name: item.name, count });
            return;
        }
    }
    setItemToDelete({ id: item.id, type, name: item.name });
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const { id, type, name } = itemToDelete;
    
    setIsDeleting(true);
    try {
      if (type === 'products') await InventoryService.deleteProduct(id);
      if (type === 'categories') await InventoryService.deleteCategory(id);
      if (type === 'subcategories') await InventoryService.deleteSubcategory(id);
      if (type === 'suppliers') await InventoryService.deleteSupplier(id);
      if (type === 'allergens') await InventoryService.deleteAllergen(id);
      if (type === 'units') await InventoryService.deleteUnit(id);
      if (type === 'waste_reasons') await InventoryService.deleteWasteReason(id);
      if (type === 'courses') await InventoryService.deleteCourse(id);
      if (type === 'promotions') await InventoryService.deletePromotion(id);
      if (type === 'purchase_orders') {
          const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
          if (error) throw error;
      }
      
      setDeleteModalOpen(false);
      setItemToDelete(null);
      
      queryClient.invalidateQueries();

    } catch (err: any) {
      console.error("Delete error detected:", err);
      const isFK = String(err.code) === '23503' || 
                   (err.message && err.message.toLowerCase().includes('violates foreign key constraint')) ||
                   (err.details && err.details.includes('Key is still referenced'));

      if (type === 'products' && isFK) {
          const errString = (err.details || err.message || '').toLowerCase();
          let violationType: 'orders' | 'ingredients' | 'other' = 'other';
          
          if (errString.includes('order_items')) {
              violationType = 'orders';
          } else if (errString.includes('product_ingredients')) {
              violationType = 'ingredients';
          }

          setDeleteModalOpen(false);
          setFkViolation({
              show: true,
              productName: name,
              productId: id,
              type: violationType
          });
      } else {
          alert("Error: " + (err.message || "No se pudo eliminar el elemento."));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchiveFromViolation = async () => {
      if (!fkViolation.productId) return;
      setSaving(true);
      try {
          await InventoryService.updateProduct(fkViolation.productId, { active: false });
          setFkViolation({ ...fkViolation, show: false });
          setItemToDelete(null);
          queryClient.invalidateQueries({ queryKey: ['products'] });
          alert("Producto desactivado correctamente. Ya no aparecerá en el TPV.");
      } catch (err: any) {
          alert("Error al desactivar: " + err.message);
      } finally {
          setSaving(false);
      }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (tagInput.trim()) {
              const currentTags = productForm.attributes || [];
              if (!currentTags.includes(tagInput.trim())) {
                  setProductForm({ ...productForm, attributes: [...currentTags, tagInput.trim()] });
              }
              setTagInput('');
          }
      }
  };

  const removeTag = (tag: string) => {
      const currentTags = productForm.attributes || [];
      setProductForm({ ...productForm, attributes: currentTags.filter(t => t !== tag) });
  };

  const handleAddIngredient = () => {
      if (!ingredientForm.productId || !ingredientForm.quantity) return;
      const quantity = parseFloat(ingredientForm.quantity.toString().replace(',', '.'));
      if (isNaN(quantity) || quantity <= 0) {
          alert("Por favor, introduce una cantidad válida.");
          return;
      }
      const yieldPct = parseFloat(ingredientForm.yieldPercentage.toString().replace(',', '.'));
      if (isNaN(yieldPct) || yieldPct <= 0 || yieldPct > 100) {
          alert("Por favor, introduce un rendimiento válido (1-100).");
          return;
      }
      if (productForm.ingredients?.some(i => i.child_product_id === ingredientForm.productId)) {
          alert("Este ingrediente ya está en la receta.");
          return;
      }
      const newItem: ProductIngredient = {
          child_product_id: ingredientForm.productId,
          quantity: quantity,
          yield_percentage: yieldPct
      };
      setProductForm(prev => ({
          ...prev,
          ingredients: [...(prev.ingredients || []), newItem]
      }));
      setIngredientForm({ productId: '', quantity: '', yieldPercentage: '100' });
  };

  const handleRemoveIngredient = (childId: string) => {
      setProductForm(prev => ({
          ...prev,
          ingredients: prev.ingredients?.filter(i => i.child_product_id !== childId) || []
      }));
  };

  const getIngredientName = (id: string) => products.find(p => p.id === id)?.name || 'Desconocido';
  const getIngredientCost = (id: string) => products.find(p => p.id === id)?.cost_price || 0;

  const handleAddVariant = () => {
      if (!newVariant.name || !newVariant.selling_price) {
          alert("Faltan datos de la variante.");
          return;
      }
      const variant: ProductVariant = {
          name: newVariant.name,
          cost_price: Number(newVariant.cost_price) || 0,
          selling_price: Number(newVariant.selling_price) || 0,
          stock_current: Number(newVariant.stock_current) || 0,
          active: true
      };
      setProductForm(prev => ({ ...prev, variants: [...prev.variants, variant] }));
      setNewVariant({ name: '', cost_price: 0, selling_price: 0, stock_current: 0 });
  };

  const handleRemoveVariant = (index: number) => {
      setProductForm(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  };

  const isEditable = (product: Product, field: EditableField): boolean => {
      if (product.is_compound && field === 'cost_price') return false;
      if (product.is_compound && field === 'stock_current') return false;
      if (product.variants && product.variants.length > 0) return false;
      return true;
  };

  const getStockDisplay = (product: Product) => {
      if (product.is_compound) return 'Receta';
      if (product.variants && product.variants.length > 0) {
          const total = product.variants.reduce((acc, v) => acc + (Number(v.stock_current) || 0), 0);
          return `${total} ${product.stock_unit || 'u'}`;
      }
      return `${product.stock_current} ${product.stock_unit || 'u'}`;
  };

  const getPriceDisplay = (product: Product) => {
      if (product.variants && product.variants.length > 0) {
          const prices = product.variants.map(v => Number(v.selling_price));
          if (prices.length === 0) return '0.00€';
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          if (min === max) return `${min.toFixed(2).replace('.', ',')}€`;
          return `${min.toFixed(2).replace('.', ',')} - ${max.toFixed(2).replace('.', ',')}€`;
      }
      return `${Number(product.selling_price).toFixed(2).replace('.', ',')}€`;
  };

  // Virtual List Context Data
  const productListData = useMemo(() => ({
      items: filteredProducts,
      selectedIds: selectedProductIds,
      toggleSelection: toggleProductSelection,
      handleStartEdit,
      handleEditKeyDown,
      handleSaveEdit,
      editingCell,
      editValue,
      setEditValue,
      onRequestDelete,
      handleOpenModal,
      handleOpenWasteModal,
      handleOpenHistory,
      handleOpenBarcodeModal,
      isEditable,
      getStockDisplay,
      getPriceDisplay,
      getCategoryName: (id: string) => categories.find(c => c.id === id)?.name || 'Sin Categoría'
  }), [filteredProducts, selectedProductIds, editingCell, editValue, categories]);

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-brand-accent" /></div>;

  return (
    <div className="flex flex-col h-screen bg-brand-900 w-full overflow-hidden text-white relative">
        
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 border-b border-brand-700 bg-brand-800 shrink-0">
         <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-brand-700 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Package className="text-brand-accent" />
                  Gestión de Inventario y Carta
                </h1>
                <p className="text-xs text-gray-400">Administra tus productos, precios y escandallos</p>
            </div>
         </div>
         
         <div className="flex items-center gap-3">
             <AdminNavigation onNavigate={onNavigate} currentView="inventory" align="responsive-inventory" />
             {activeTab === 'products' && (
                 <div className="flex gap-2">
                     <input type="file" accept=".csv" className="hidden" ref={importFileInputRef} onChange={handleFileChange} />
                     <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-brand-900 border border-brand-700 text-gray-300 rounded-lg hover:text-white hover:bg-brand-800 transition-colors text-sm font-medium" title="Exportar CSV">
                        <Download size={16} /> Exportar
                     </button>
                     <div className="relative group">
                         <button onClick={handleImportClick} disabled={isImporting} className="flex items-center gap-2 px-3 py-2 bg-brand-900 border border-brand-700 text-gray-300 rounded-lg hover:text-white hover:bg-brand-800 transition-colors text-sm font-medium disabled:opacity-50" title="Importar CSV">
                            {isImporting ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16} />} Importar
                         </button>
                         <div className="absolute right-0 top-full mt-2 w-72 bg-brand-900 border border-brand-700 p-3 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs text-gray-300 pointer-events-none">
                             <p className="font-bold text-white mb-1">Formato CSV esperado:</p>
                             <p className="mb-2">Nombre, Categoria, Subcategoria, Proveedor, Coste, PVP, Stock, Minimo, IVA, Unidad, Codigo de Barras, Compuesto (SI/NO), Activo (SI/NO)</p>
                             <p className="text-gray-400 italic">Nota: La primera fila se ignora (cabeceras). También se soporta el formato antiguo de 8 columnas.</p>
                         </div>
                     </div>
                 </div>
             )}
         </div>
      </header>

      <div className="p-3 border-b border-brand-700 shrink-0 bg-brand-800/30 flex items-center gap-4 justify-between">
        <div className="flex items-center gap-4 flex-1 overflow-x-auto no-scrollbar pb-1">
            <div className="flex bg-brand-900 rounded-lg p-1 border border-brand-700 shrink-0">
              <button title="Productos" onClick={() => setActiveTab('products')} className={`p-2 rounded-md transition-all ${activeTab === 'products' ? 'bg-brand-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><Package size={20} /></button>
              <button title="Categorías" onClick={() => setActiveTab('categories')} className={`p-2 rounded-md transition-all ${activeTab === 'categories' ? 'bg-brand-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><Tag size={20} /></button>
              <button title="Subcategorías" onClick={() => setActiveTab('subcategories')} className={`p-2 rounded-md transition-all ${activeTab === 'subcategories' ? 'bg-brand-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><GitFork size={20} /></button>
              <button title="Proveedores" onClick={() => setActiveTab('suppliers')} className={`p-2 rounded-md transition-all ${activeTab === 'suppliers' ? 'bg-brand-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><Truck size={20} /></button>
              <button title="Pedidos de Compra" onClick={() => setActiveTab('purchase_orders')} className={`p-2 rounded-md transition-all ${activeTab === 'purchase_orders' ? 'bg-brand-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><Scroll size={20} /></button>
              <button title="Alérgenos" onClick={() => setActiveTab('allergens')} className={`p-2 rounded-md transition-all ${activeTab === 'allergens' ? 'bg-brand-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><Wheat size={20} /></button>
              <button title="Unidades de Medida" onClick={() => setActiveTab('units')} className={`p-2 rounded-md transition-all ${activeTab === 'units' ? 'bg-brand-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><Scale size={20} /></button>
              <button title="Tipos de Merma" onClick={() => setActiveTab('waste_reasons')} className={`p-2 rounded-md transition-all ${activeTab === 'waste_reasons' ? 'bg-brand-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><Ban size={20} /></button>
              <button title="Promociones" onClick={() => setActiveTab('promotions')} className={`p-2 rounded-md transition-all ${activeTab === 'promotions' ? 'bg-brand-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><Percent size={20} /></button>
            </div>
            {activeTab === 'products' && (
                <div className="flex gap-2 items-center">
                    <div className="relative min-w-[160px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-brand-900 border border-brand-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-brand-accent outline-none" />
                    </div>
                    <button 
                        onClick={() => {
                            setDeliveryNoteItems([{ product_id: '', quantity: '', price: '' }]);
                            setDeliveryNoteNotes('');
                            setIsDeliveryNoteModalOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-md transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                        <FolderInput size={16} /> Recibir Albarán
                    </button>
                </div>
            )}
        </div>
        <button onClick={() => handleOpenModal()} className="bg-brand-accent hover:bg-brand-accentHover text-white p-2.5 rounded-lg shadow-lg shadow-brand-accent/20 transition-all active:scale-95 shrink-0">
            <Plus size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden p-4 pb-20">
        {activeTab === 'products' && (
          <div className="bg-brand-800 rounded-xl border border-brand-700 overflow-hidden shadow-xl flex flex-col h-full">
             
             {/* Virtual List Header */}
             <div className="flex items-center text-left text-sm bg-brand-800 text-gray-400 font-medium uppercase text-xs border-b border-brand-700 shrink-0">
                <div className="w-12 text-center p-4 bg-brand-800"><button onClick={toggleSelectAll} className="text-gray-400 hover:text-white transition-colors">{selectedProductIds.size > 0 && selectedProductIds.size === filteredProducts.length ? <CheckSquare size={18} /> : <Square size={18} />}</button></div>
                <div className="flex-1 p-4 bg-brand-800">Producto</div>
                <div className="w-24 hidden md:block p-4 bg-brand-800">Tipo</div>
                <div className="w-64 hidden lg:block p-4 bg-brand-800">Detalles</div>
                <div className="w-24 text-right p-4 bg-brand-800">Coste</div>
                <div className="w-24 text-right p-4 bg-brand-800">PVP</div>
                <div className="w-20 text-center p-4 bg-brand-800">Stock</div>
                <div className="w-16 text-right p-4 bg-brand-800">Acciones</div>
             </div>

             {/* Virtual List Body */}
             <div className="flex-1 w-full h-full">
                {filteredProducts.length === 0 ? (
                    <div className="flex justify-center items-center h-full text-gray-500">No se encontraron productos.</div>
                ) : (
                    <AutoSizer>
                        {({ height, width }) => (
                            <List
                                height={height}
                                itemCount={filteredProducts.length}
                                itemSize={72} // Fixed Row Height
                                width={width}
                                itemData={productListData}
                            >
                                {ProductRow}
                            </List>
                        )}
                    </AutoSizer>
                )}
             </div>
             
             <div className="border-t border-brand-700 p-3 bg-brand-800 flex items-center justify-between shrink-0">
                <div className="text-xs text-gray-400">
                    Total: {filteredProducts.length} productos
                </div>
             </div>
          </div>
        )}
        
        {activeTab !== 'products' && (
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 overflow-y-auto max-h-full">
              {activeTab === 'categories' && categories.map(cat => (
                  <div key={cat.id} className="bg-brand-800 border border-brand-700 p-4 rounded-xl flex flex-col items-center justify-center gap-3 relative group hover:border-brand-500 transition-colors min-h-[120px]">
                      <div className="absolute top-2 right-2 flex gap-1"><button onClick={() => handleOpenModal(cat)} className="text-blue-400 p-1 hover:bg-blue-500/20 rounded cursor-pointer transition-colors"><Edit2 size={14} /></button><button onClick={(e) => onRequestDelete(cat, 'categories', e)} className="text-red-400 p-1 hover:bg-red-500/20 rounded cursor-pointer transition-colors"><Trash2 size={14} /></button></div>
                     <span className="font-bold text-center">{cat.name}</span>
                  </div>
              ))}
              {activeTab === 'subcategories' && subcategories.map(sub => (<div key={sub.id} className="bg-brand-800 border border-brand-700 p-4 rounded-xl flex flex-col items-center justify-center gap-3 relative group hover:border-brand-500 transition-colors min-h-[120px]"><div className="absolute top-2 right-2 flex gap-1"><button onClick={() => handleOpenModal(sub)} className="text-blue-400 p-1 hover:bg-blue-500/20 rounded cursor-pointer transition-colors"><Edit2 size={14} /></button><button onClick={(e) => onRequestDelete(sub, 'subcategories', e)} className="text-red-400 p-1 hover:bg-red-500/20 rounded cursor-pointer transition-colors"><Trash2 size={14} /></button></div><div className="text-center"><span className="font-bold block">{sub.name}</span><span className="text-xs text-gray-400 flex items-center justify-center gap-1 mt-1"><GitFork size={10} />{categories.find(c => c.id === sub.category_id)?.name || 'Sin Padre'}</span></div></div>))}
              {activeTab === 'suppliers' && suppliers.map(sup => (<div key={sup.id} className="bg-brand-800 border border-brand-700 p-4 rounded-xl flex flex-col items-center justify-center gap-3 relative group hover:border-brand-500 transition-colors min-h-[120px]"><div className="absolute top-2 right-2 flex gap-1"><button onClick={() => handleOpenModal(sup)} className="text-blue-400 p-1 hover:bg-blue-500/20 rounded cursor-pointer transition-colors"><Edit2 size={14} /></button><button onClick={(e) => onRequestDelete(sup, 'suppliers', e)} className="text-red-400 p-1 hover:bg-red-500/20 rounded cursor-pointer transition-colors"><Trash2 size={14} /></button></div><div className="text-center w-full"><div className="flex justify-center mb-2 text-gray-500"><Truck size={24} /></div><span className="font-bold block truncate">{sup.name}</span></div></div>))}
              {activeTab === 'allergens' && allergens.map(all => (<div key={all.id} className="bg-brand-800 border border-brand-700 p-4 rounded-xl flex flex-col items-center justify-center gap-3 relative group hover:border-brand-500 transition-colors min-h-[120px]"><div className="absolute top-2 right-2 flex gap-1"><button onClick={() => handleOpenModal(all)} className="text-blue-400 p-1 hover:bg-blue-500/20 rounded cursor-pointer transition-colors"><Edit2 size={14} /></button><button onClick={(e) => onRequestDelete(all, 'allergens', e)} className="text-red-400 p-1 hover:bg-red-500/20 rounded cursor-pointer transition-colors"><Trash2 size={14} /></button></div><div className="flex justify-center mb-1 text-orange-400"><Wheat size={20} /></div><span className="font-bold text-center">{all.name}</span></div>))}
              {activeTab === 'units' && units.map(unit => (<div key={unit.id} className="bg-brand-800 border border-brand-700 p-4 rounded-xl flex flex-col items-center justify-center gap-3 relative group hover:border-brand-500 transition-colors min-h-[120px]"><div className="absolute top-2 right-2 flex gap-1"><button onClick={() => handleOpenModal(unit)} className="text-blue-400 p-1 hover:bg-blue-500/20 rounded cursor-pointer transition-colors"><Edit2 size={14} /></button><button onClick={(e) => onRequestDelete(unit, 'units', e)} className="text-red-400 p-1 hover:bg-red-500/20 rounded cursor-pointer transition-colors"><Trash2 size={14} /></button></div><div className="text-center"><span className="font-bold block">{unit.name}</span><span className="text-xs text-brand-accent font-mono bg-brand-900 px-2 py-0.5 rounded mt-1 inline-block">{unit.abbreviation}</span></div></div>))}
              {activeTab === 'waste_reasons' && wasteReasons.map(reason => (<div key={reason.id} className="bg-brand-800 border border-brand-700 p-4 rounded-xl flex flex-col items-center justify-center gap-3 relative group hover:border-brand-500 transition-colors min-h-[120px]"><div className="absolute top-2 right-2 flex gap-1"><button onClick={() => handleOpenModal(reason)} className="text-blue-400 p-1 hover:bg-blue-500/20 rounded cursor-pointer transition-colors"><Edit2 size={14} /></button><button onClick={(e) => onRequestDelete(reason, 'waste_reasons', e)} className="text-red-400 p-1 hover:bg-red-500/20 rounded cursor-pointer transition-colors"><Trash2 size={14} /></button></div><div className="p-3 bg-red-500/10 rounded-full mb-1"><TrendingDown size={24} className="text-red-400" /></div><span className="font-bold text-center text-red-200">{reason.name}</span></div>))}
              {activeTab === 'courses' && courses.map(course => (<div key={course.id} className="bg-brand-800 border border-brand-700 p-4 rounded-xl flex flex-col items-center justify-center gap-3 relative group hover:border-brand-500 transition-colors min-h-[120px]"><div className="absolute top-2 right-2 flex gap-1"><button onClick={() => handleOpenModal(course)} className="text-blue-400 p-1 hover:bg-blue-500/20 rounded cursor-pointer transition-colors"><Edit2 size={14} /></button><button onClick={(e) => onRequestDelete(course, 'courses', e)} className="text-red-400 p-1 hover:bg-red-500/20 rounded cursor-pointer transition-colors"><Trash2 size={14} /></button></div><div className="p-3 bg-orange-500/10 rounded-full mb-1"><Clock size={24} className="text-orange-400" /></div><span className="font-bold text-center text-orange-200">{course.name}</span><span className="text-xs text-gray-400">Orden: {course.order_index}</span></div>))}
              
              {activeTab === 'promotions' && promotions.map(promo => (
                  <div key={promo.id} className="bg-brand-800 border border-brand-700 p-4 rounded-xl flex flex-col gap-3 relative group hover:border-brand-500 transition-colors min-h-[120px] col-span-2 md:col-span-3 lg:col-span-4">
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenModal(promo)} className="text-blue-400 p-1 hover:bg-blue-500/20 rounded cursor-pointer transition-colors"><Edit2 size={14} /></button>
                          <button onClick={(e) => onRequestDelete(promo, 'promotions', e)} className="text-red-400 p-1 hover:bg-red-500/20 rounded cursor-pointer transition-colors"><Trash2 size={14} /></button>
                      </div>
                      
                      <div className="flex justify-between items-start">
                          <div>
                              <span className="font-bold block text-lg">{promo.name}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${promo.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {promo.is_active ? 'Activa' : 'Inactiva'}
                              </span>
                          </div>
                          <div className="text-right mt-6">
                              <span className="text-2xl font-black text-brand-accent">
                                  {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `${promo.discount_value.toFixed(2).replace('.', ',')}€`}
                              </span>
                          </div>
                      </div>
                      
                      <div className="bg-brand-900/50 p-2 rounded-lg border border-brand-700/50 flex flex-col gap-1">
                          <div className="flex justify-between text-xs text-gray-400">
                              <span>Horario:</span>
                              <span className="text-white">{promo.start_time} - {promo.end_time}</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-400">
                              <span>Días:</span>
                              <span className="text-white">
                                  {promo.days_of_week?.map(d => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d]).join(', ')}
                              </span>
                          </div>
                          {promo.applicable_categories && promo.applicable_categories.length > 0 && (
                              <div className="flex justify-between text-xs text-gray-400 mt-1 pt-1 border-t border-brand-700/50">
                                  <span>Categorías:</span>
                                  <span className="text-white text-right max-w-[60%] truncate" title={promo.applicable_categories.map(cid => categories.find(c => c.id === cid)?.name).join(', ')}>
                                      {promo.applicable_categories.map(cid => categories.find(c => c.id === cid)?.name).filter(Boolean).join(', ')}
                                  </span>
                              </div>
                          )}
                          {promo.applicable_products && promo.applicable_products.length > 0 && (
                              <div className="flex justify-between text-xs text-gray-400 mt-1 pt-1 border-t border-brand-700/50">
                                  <span>Productos:</span>
                                  <span className="text-white text-right max-w-[60%] truncate" title={promo.applicable_products.map(pid => products.find(p => p.id === pid)?.name).join(', ')}>
                                      {promo.applicable_products.map(pid => products.find(p => p.id === pid)?.name).filter(Boolean).join(', ')}
                                  </span>
                              </div>
                          )}
                      </div>
                  </div>
              ))}

              {activeTab === 'purchase_orders' && purchaseOrders.map((order: any) => (
                  <div key={order.id} className="bg-brand-800 border border-brand-700 p-4 rounded-xl flex flex-col gap-3 relative group hover:border-brand-500 transition-colors min-h-[120px] col-span-2 md:col-span-3 lg:col-span-4">
                      {order.status === 'pending' && (
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(order)} className="text-blue-400 p-1 hover:bg-blue-500/20 rounded cursor-pointer transition-colors"><Edit2 size={14} /></button>
                              <button onClick={(e) => onRequestDelete(order, 'purchase_orders', e)} className="text-red-400 p-1 hover:bg-red-500/20 rounded cursor-pointer transition-colors"><Trash2 size={14} /></button>
                          </div>
                      )}
                      
                      <div className="flex justify-center mb-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : order.status === 'received' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                              {order.status === 'pending' ? 'Pendiente' : order.status === 'received' ? 'Recibido' : order.status}
                          </span>
                      </div>

                      <div className="flex justify-between items-start">
                          <div>
                              <span className="font-bold block text-lg">{order.suppliers?.name || 'Proveedor Desconocido'}</span>
                              <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString()}</span>
                          </div>
                      </div>
                      
                      {order.notes && (
                          <div className="bg-brand-900/50 p-2 rounded-lg border border-brand-700/50">
                              <p className="text-xs text-gray-300 italic">"{order.notes}"</p>
                          </div>
                      )}

                      <div className="flex-1">
                          <p className="text-sm text-gray-300 mb-2 font-bold">Artículos:</p>
                          <ul className="text-xs text-gray-400 space-y-1">
                              {order.purchase_order_items?.map((item: any) => (
                                  <li key={item.id} className="flex justify-between">
                                      <span>{item.quantity}x {item.products?.name || 'Producto'}</span>
                                      <span>{(item.quantity * item.cost_price).toFixed(2).replace('.', ',')}€</span>
                                  </li>
                              ))}
                          </ul>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-brand-700">
                          <span className="font-bold text-brand-accent">Total: {order.purchase_order_items?.reduce((acc: number, item: any) => acc + (item.quantity * item.cost_price), 0).toFixed(2).replace('.', ',')}€</span>
                          {order.status === 'pending' && (
                              <button 
                                  onClick={async () => {
                                      if(confirm('¿Marcar como recibido y actualizar stock?')) {
                                          try {
                                              await supabase.from('purchase_orders').update({ status: 'received' }).eq('id', order.id);
                                              // Actualizar stock
                                              for(const item of order.purchase_order_items) {
                                                  const product = await db.products.get(item.product_id);
                                                  if(product) {
                                                      const newStock = product.stock_current + item.quantity;
                                                      await InventoryService.updateProduct(item.product_id, { stock_current: newStock }, user?.id);
                                                  }
                                              }
                                              refetchPurchaseOrders();
                                              alert('Pedido recibido y stock actualizado.');
                                          } catch (e) {
                                              console.error(e);
                                              alert('Error al recibir el pedido.');
                                          }
                                      }
                                  }}
                                  className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                              >
                                  Recibir Pedido
                              </button>
                          )}
                      </div>
                  </div>
              ))}

              <button onClick={() => handleOpenModal()} className="border-2 border-dashed border-brand-700 p-4 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-white hover:border-brand-500 hover:bg-brand-800/50 transition-all min-h-[120px]">
                  <Plus size={24} /> <span className="text-xs uppercase font-bold">Nueva</span>
              </button>
           </div>
        )}
      </div>
      
      {/* WASTE REGISTRATION MODAL */}
      {wasteModalOpen && selectedProductForWaste && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-brand-800 border border-red-500/50 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95">
                  <div className="p-6 text-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                            <TrendingDown className="text-red-500 w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">Registrar Merma</h3>
                        <p className="text-gray-400 text-sm mb-6">
                            Estás retirando stock de <span className="text-white font-bold">{selectedProductForWaste.name}</span>
                        </p>

                        <form onSubmit={handleRegisterWaste} className="space-y-4 text-left">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Motivo</label>
                                <select 
                                    className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white outline-none"
                                    value={wasteForm.reasonId}
                                    onChange={(e) => setWasteForm({...wasteForm, reasonId: e.target.value})}
                                    required
                                >
                                    <option value="">Selecciona un motivo...</option>
                                    {wasteReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Cantidad a retirar ({selectedProductForWaste.stock_unit})</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white outline-none font-mono text-lg"
                                    value={wasteForm.quantity}
                                    onChange={(e) => setWasteForm({...wasteForm, quantity: e.target.value})}
                                    placeholder="0"
                                    required
                                    min="0.01"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setWasteModalOpen(false)} className="flex-1 py-3 rounded-xl bg-brand-900 text-gray-300 hover:bg-brand-700 font-medium">Cancelar</button>
                                <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold flex items-center justify-center gap-2">
                                    {saving ? <Loader2 className="animate-spin" size={18} /> : <TrendingDown size={18} />} Registrar
                                </button>
                            </div>
                        </form>
                  </div>
              </div>
          </div>
      )}

      {/* HISTORY MODAL - VIRTUALIZED */}
      {historyModalOpen && selectedProductForHistory && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col h-[80vh]">
                  <div className="p-6 border-b border-brand-700 flex justify-between items-center bg-brand-900/50 shrink-0">
                      <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2"><HistoryIcon className="text-brand-accent" /> Historial de Movimientos</h3>
                        <p className="text-sm text-gray-400">{selectedProductForHistory.name}</p>
                      </div>
                      <button onClick={() => setHistoryModalOpen(false)}><X className="text-gray-400 hover:text-white" /></button>
                  </div>
                  
                  <div className="flex items-center bg-brand-900/50 text-gray-400 uppercase text-xs border-b border-brand-700 shrink-0">
                      <div className="w-1/4 p-4">Fecha</div>
                      <div className="w-1/4 p-4">Usuario</div>
                      <div className="w-1/4 p-4">Motivo</div>
                      <div className="w-1/8 p-4 text-right">Cambio</div>
                      <div className="w-1/8 p-4 text-center flex-1">Stock Final</div>
                  </div>

                  <div className="flex-1 w-full overflow-hidden">
                      {loadingHistory ? (
                          <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand-accent" /></div>
                      ) : historyLogs.length === 0 ? (
                          <div className="p-8 text-center text-gray-500">No hay movimientos registrados.</div>
                      ) : (
                          <AutoSizer>
                            {({ height, width }) => (
                                <List
                                    height={height}
                                    itemCount={historyLogs.length}
                                    itemSize={48}
                                    width={width}
                                    itemData={historyLogs}
                                >
                                    {HistoryRow}
                                </List>
                            )}
                          </AutoSizer>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* BARCODE MODAL */}
      {barcodeModalOpen && selectedProductForBarcode && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Barcode className="text-brand-accent" /> Etiqueta</h3>
                      <button onClick={() => setBarcodeModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                  </div>
                  
                  <div className="p-8 flex flex-col items-center justify-center bg-white" id="barcode-print-area">
                      <h4 className="text-xl font-bold text-black mb-4 text-center">{selectedProductForBarcode.name}</h4>
                      {selectedProductForBarcode.barcode ? (
                          <BarcodeLib value={selectedProductForBarcode.barcode} width={2} height={80} displayValue={true} background="#ffffff" lineColor="#000000" />
                      ) : (
                          <div className="text-center text-gray-500 py-8">
                              <p className="mb-2">Este producto no tiene código de barras.</p>
                              <p className="text-sm">Edita el producto para generarle uno.</p>
                          </div>
                      )}
                      <p className="mt-4 text-2xl font-bold text-black">{selectedProductForBarcode.selling_price.toFixed(2).replace('.', ',')}€</p>
                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                      <button onClick={() => setBarcodeModalOpen(false)} className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium">Cerrar</button>
                      <button 
                          disabled={!selectedProductForBarcode.barcode}
                          onClick={() => {
                              const printContent = document.getElementById('barcode-print-area');
                              const windowPrint = window.open('', '', 'width=600,height=600');
                              if (windowPrint && printContent) {
                                  windowPrint.document.write(`
                                      <html>
                                          <head>
                                              <title>Imprimir Etiqueta</title>
                                              <style>
                                                  body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                                                  h4 { font-size: 24px; margin-bottom: 10px; }
                                                  p { font-size: 32px; font-weight: bold; margin-top: 10px; }
                                              </style>
                                          </head>
                                          <body>
                                              ${printContent.innerHTML}
                                          </body>
                                      </html>
                                  `);
                                  windowPrint.document.close();
                                  windowPrint.focus();
                                  setTimeout(() => {
                                      windowPrint.print();
                                      windowPrint.close();
                                  }, 250);
                              }
                          }} 
                          className="flex-1 py-2 rounded-lg bg-brand-accent hover:bg-brand-accentHover text-white font-bold disabled:opacity-50"
                      >
                          Imprimir
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-brand-700 flex justify-between items-center bg-brand-900/50">
                 <h3 className="text-xl font-bold text-white">
                   {editingItem ? 'Editar' : 'Crear'} {activeTab === 'products' ? 'Producto' : (activeTab === 'units' ? 'Unidad' : (activeTab === 'waste_reasons' ? 'Motivo Merma' : (activeTab === 'courses' ? 'Turno' : (activeTab === 'categories' ? 'Categoría' : (activeTab === 'subcategories' ? 'Subcategoría' : (activeTab === 'suppliers' ? 'Proveedor' : (activeTab === 'purchase_orders' ? 'Pedido de Compra' : (activeTab === 'promotions' ? 'Promoción' : 'Elemento'))))))))}
                 </h3>
                 <button onClick={() => setIsModalOpen(false)}><X className="text-gray-400 hover:text-white" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                 <form id="inventory-form" onSubmit={handleSave} className="space-y-6">
                    {activeTab === 'products' && (
                      <>
                        <div className="flex flex-col sm:flex-row gap-4">
                           <div className={`w-full sm:w-32 h-32 rounded-xl border-2 border-dashed flex items-center justify-center relative overflow-hidden transition-all group shrink-0 ${isDragging ? 'border-brand-accent bg-brand-accent/10' : 'border-brand-600 bg-brand-900 hover:border-gray-500'}`} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
                                {imagePreview ? (
                                    <>
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-white hover:text-brand-accent"><Edit2 size={16} /></button>
                                            <button type="button" onClick={handleRemoveImage} className="text-white hover:text-red-400"><Trash2 size={16} /></button>
                                        </div>
                                    </>
                                ) : (
                                    <div onClick={() => fileInputRef.current?.click()} className="text-center p-2 cursor-pointer flex flex-col items-center justify-center h-full w-full">
                                        <Upload size={20} className="text-gray-500 mb-1" />
                                        <span className="text-[10px] text-gray-500 font-medium leading-tight">Click o arrastra imagen</span>
                                    </div>
                                )}
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                           </div>

                           <div className="flex-1 space-y-4">
                               <div className="flex gap-4">
                                   <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre</label>
                                        <input required type="text" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white focus:ring-1 focus:ring-brand-accent outline-none" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} placeholder="Ej. Hamburguesa Angus" />
                                   </div>
                                   <div className="w-1/3 min-w-[140px]">
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tipo</label>
                                        <div className="flex bg-brand-900 p-1 rounded-lg border border-brand-600">
                                            <button type="button" onClick={() => setProductForm({...productForm, is_compound: false})} className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-1 transition-all ${!productForm.is_compound ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}><Package size={12} /> Simple</button>
                                            <button type="button" onClick={() => setProductForm({...productForm, is_compound: true, hasVariants: false})} className={`flex-1 py-2 text-xs font-bold rounded flex items-center justify-center gap-1 transition-all ${productForm.is_compound ? 'bg-brand-accent text-white shadow' : 'text-gray-400 hover:text-white'}`}><Scroll size={12} /> Receta</button>
                                        </div>
                                   </div>
                               </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Categoría</label>
                                        <select className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white outline-none" value={productForm.category_id || ''} onChange={e => setProductForm({...productForm, category_id: e.target.value})}><option value="">Seleccionar...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Proveedor</label>
                                        <select className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white outline-none" value={productForm.supplier_id || ''} onChange={e => setProductForm({...productForm, supplier_id: e.target.value})}><option value="">Ninguno</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Código de Barras / QR</label>
                                    <div className="flex gap-2">
                                        <input type="text" className="flex-1 bg-brand-900 border border-brand-600 rounded-lg p-3 text-white focus:ring-1 focus:ring-brand-accent outline-none" value={productForm.barcode || ''} onChange={e => setProductForm({...productForm, barcode: e.target.value})} placeholder="Escanear o introducir código..." />
                                        <button type="button" onClick={() => setProductForm({...productForm, barcode: Math.random().toString().slice(2, 14)})} className="bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-colors whitespace-nowrap">
                                            Generar
                                        </button>
                                    </div>
                                </div>
                           </div>
                        </div>

                        <div className="bg-brand-900/30 p-4 rounded-xl border border-brand-700">
                             <div className="flex gap-4">
                                <div className="w-1/3">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Unidad Medida</label>
                                    <div className="relative">
                                        <select className="w-full bg-brand-900 border border-brand-600 rounded-lg p-2.5 text-white outline-none appearance-none" value={productForm.stock_unit} onChange={(e) => setProductForm({...productForm, stock_unit: e.target.value as StockUnit})}>{units.map(u => (<option key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</option>))}</select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"><Scale size={14}/></div>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Atributos / Etiquetas</label>
                                    <div className="flex items-center gap-2 bg-brand-900 border border-brand-600 rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-brand-accent transition-all">
                                        <Tag size={16} className="text-gray-500 ml-1" />
                                        <input type="text" placeholder="Escribe y pulsa Enter" className="bg-transparent outline-none text-sm w-full text-white placeholder:text-gray-600" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleAddTag} />
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {productForm.attributes?.map((tag, idx) => (
                                            <span key={idx} className="bg-brand-700 text-gray-200 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">{tag}<button type="button" onClick={() => removeTag(tag)} className="hover:text-red-400"><X size={10} /></button></span>
                                        ))}
                                    </div>
                                </div>
                             </div>
                        </div>

                        {productForm.is_compound ? (
                            <div className="bg-brand-900/40 border border-brand-accent/30 rounded-xl p-5 space-y-4">
                                <div className="flex items-center gap-2 text-brand-accent mb-2"><Utensils size={20} /><h4 className="font-bold uppercase">Escandallo / Receta</h4></div>
                                <p className="text-xs text-gray-400 mb-4">Añade las materias primas necesarias para 1 unidad de venta. El coste se calcula automáticamente.</p>
                                <div className="grid grid-cols-12 gap-2 items-end bg-brand-800 p-3 rounded-lg border border-brand-700">
                                    <div className="col-span-5">
                                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1">Materia Prima</label>
                                        <select className="w-full bg-brand-900 border border-brand-600 rounded p-2 text-sm text-white outline-none" value={ingredientForm.productId} onChange={(e) => setIngredientForm({...ingredientForm, productId: e.target.value})}><option value="">Buscar ingrediente...</option>{products.filter(p => !p.is_compound).map(p => (<option key={p.id} value={p.id}>{p.name} ({p.cost_price.toFixed(2).replace('.', ',')}€ / {p.stock_unit})</option>))}</select>
                                    </div>
                                    <div className="col-span-3">
                                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1">Cantidad</label>
                                        <input type="number" step="0.001" placeholder="1" className="w-full bg-brand-900 border border-brand-600 rounded p-2 text-sm text-white text-center" value={ingredientForm.quantity || ''} onChange={(e) => setIngredientForm({...ingredientForm, quantity: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1">Rend. (%)</label>
                                        <input type="number" step="1" min="1" max="100" placeholder="100" className="w-full bg-brand-900 border border-brand-600 rounded p-2 text-sm text-white text-center" value={ingredientForm.yieldPercentage || ''} onChange={(e) => setIngredientForm({...ingredientForm, yieldPercentage: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <button type="button" onClick={handleAddIngredient} disabled={!ingredientForm.productId || !ingredientForm.quantity || parseFloat(ingredientForm.quantity) <= 0} className="w-full bg-brand-accent hover:bg-brand-accentHover disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded font-bold flex items-center justify-center transition-colors"><Plus size={18} /></button>
                                    </div>
                                </div>
                                <div className="overflow-hidden rounded-lg border border-brand-700">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-brand-800 text-xs uppercase text-gray-500"><tr><th className="p-3">Ingrediente</th><th className="p-3 text-right">Coste U.</th><th className="p-3 text-center">Cant.</th><th className="p-3 text-center">Rend.</th><th className="p-3 text-right">Total</th><th className="p-3 w-10"></th></tr></thead>
                                        <tbody className="divide-y divide-brand-700">
                                            {productForm.ingredients?.map((ing, idx) => {
                                                const cost = getIngredientCost(ing.child_product_id);
                                                const yieldPct = ing.yield_percentage || 100;
                                                const total = (cost * ing.quantity) / (yieldPct / 100);
                                                return (<tr key={ing.child_product_id + idx} className="bg-brand-900/50"><td className="p-3 font-medium">{getIngredientName(ing.child_product_id)}</td><td className="p-3 text-right text-gray-400">{cost.toFixed(3).replace('.', ',')}€</td><td className="p-3 text-center"><input type="number" step="any" className="w-20 bg-brand-800 border border-brand-600 rounded p-1 text-center text-white outline-none focus:border-brand-accent" value={ing.quantity || ''} onChange={(e) => { const newQty = parseFloat(e.target.value); const newIngredients = [...(productForm.ingredients || [])]; newIngredients[idx].quantity = isNaN(newQty) ? 0 : newQty; setProductForm({ ...productForm, ingredients: newIngredients }); }} /></td><td className="p-3 text-center text-gray-400">{yieldPct}%</td><td className="p-3 text-right font-mono text-white">{total.toFixed(3).replace('.', ',')}€</td><td className="p-3 text-center"><button type="button" onClick={() => handleRemoveIngredient(ing.child_product_id)} className="text-red-400 hover:text-white"><X size={14} /></button></td></tr>);
                                            })}
                                        </tbody>
                                        <tfoot className="bg-brand-800 border-t border-brand-700"><tr><td colSpan={4} className="p-3 text-right font-bold text-gray-300">Coste Total Receta:</td><td className="p-3 text-right font-bold text-brand-accent text-lg">{(productForm.ingredients?.reduce((acc, i) => acc + ((getIngredientCost(i.child_product_id) * i.quantity) / ((i.yield_percentage || 100) / 100)), 0) || 0).toFixed(3).replace('.', ',')}€</td><td></td></tr></tfoot>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 bg-brand-900/30 p-4 rounded-xl border border-brand-700">
                                <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Stock Actual ({productForm.stock_unit?.toUpperCase()})</label><input type="number" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-2 text-white" value={productForm.stock_current} onChange={e => setProductForm({...productForm, stock_current: parseInt(e.target.value) || 0})} /></div>
                                <div><label className="block text-xs font-bold text-red-400 uppercase mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Alerta Mínimo</label><input type="number" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-2 text-white" value={productForm.stock_min} onChange={e => setProductForm({...productForm, stock_min: parseInt(e.target.value) || 0})} /></div>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-4 border-t border-brand-700 pt-4">
                            <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Coste ({productForm.is_compound ? 'Calc.' : 'Manual'})</label><input type="number" step="0.01" className={`w-full bg-brand-900 border border-brand-600 rounded-lg p-2 text-white text-left ${productForm.is_compound ? 'opacity-50 cursor-not-allowed' : ''}`} value={productForm.cost_price} readOnly={productForm.is_compound} onChange={e => !productForm.is_compound && setProductForm({...productForm, cost_price: parseFloat(e.target.value) || 0})} /></div>
                            <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">IVA (%)</label><input type="number" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-2 text-white text-left" value={productForm.tax_rate} onChange={e => setProductForm({...productForm, tax_rate: parseFloat(e.target.value) || 0})} /></div>
                            <div><label className="block text-xs font-bold text-brand-accent uppercase mb-1">PVP Venta (€)</label><input type="number" step="0.01" className="w-full bg-brand-900 border-brand-accent border rounded-lg p-2 text-white text-left font-bold" value={productForm.selling_price} onChange={e => setProductForm({...productForm, selling_price: parseFloat(e.target.value) || 0})} /></div>
                        </div>

                        {!productForm.is_compound && (
                            <label className="bg-brand-900/50 p-4 rounded-xl border border-brand-700 flex items-center justify-between cursor-pointer hover:bg-brand-800 transition-colors">
                                <div><div className="text-sm font-bold text-white flex items-center gap-2"><Layers size={16} className="text-brand-accent" /> Variantes / Formatos de Venta</div><p className="text-xs text-gray-400">Si vendes este mismo producto en varios tamaños (ej. Caña, Pinta) con precios distintos.</p></div>
                                <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full"><input type="checkbox" className="absolute w-6 h-6 opacity-0 cursor-pointer" checked={productForm.hasVariants} onChange={(e) => setProductForm({...productForm, hasVariants: e.target.checked})} /><div className={`w-11 h-6 rounded-full shadow-inner transition-colors ${productForm.hasVariants ? 'bg-brand-accent' : 'bg-gray-700'}`}></div><div className={`absolute w-4 h-4 bg-white rounded-full shadow inset-y-1 transition-transform ${productForm.hasVariants ? 'translate-x-6' : 'translate-x-1'}`}></div></div>
                            </label>
                        )}
                        
                        {productForm.hasVariants && !productForm.is_compound && (
                             <div className="space-y-4 border-l-2 border-brand-700 pl-4">
                                <div className="grid grid-cols-12 gap-2 items-end bg-brand-900/30 p-3 rounded-lg border border-brand-700">
                                    <div className="col-span-4"><input type="text" placeholder="Nombre (ej. Pinta)" className="w-full bg-brand-800 border border-brand-600 rounded p-1.5 text-xs text-white" value={newVariant.name} onChange={e => setNewVariant({...newVariant, name: e.target.value})} /></div>
                                    <div className="col-span-2"><input type="number" placeholder="Coste" className="w-full bg-brand-800 border border-brand-600 rounded p-1.5 text-xs text-white text-right" value={newVariant.cost_price || ''} onChange={e => setNewVariant({...newVariant, cost_price: parseFloat(e.target.value)})} /></div>
                                    <div className="col-span-2"><input type="number" placeholder="PVP" className="w-full bg-brand-800 border border-brand-accent/50 rounded p-1.5 text-xs text-white text-right font-bold" value={newVariant.selling_price || ''} onChange={e => setNewVariant({...newVariant, selling_price: parseFloat(e.target.value)})} /></div>
                                     <div className="col-span-2"><input type="number" placeholder="Stock" className="w-full bg-brand-800 border border-brand-600 rounded p-1.5 text-xs text-white text-center" value={newVariant.stock_current || ''} onChange={e => setNewVariant({...newVariant, stock_current: parseInt(e.target.value)})} /></div>
                                    <div className="col-span-2"><button type="button" onClick={handleAddVariant} className="w-full bg-brand-accent hover:bg-brand-accentHover text-white p-1.5 rounded text-xs font-bold flex items-center justify-center"><Plus size={16} /></button></div>
                                </div>
                                <div className="space-y-2">{productForm.variants.map((v, idx) => (<div key={idx} className="flex items-center justify-between p-2 bg-brand-800 border border-brand-600 rounded-lg text-xs"><span className="font-bold">{v.name}</span><div className="flex gap-3"><span>Coste: {v.cost_price}</span><span className="text-brand-accent font-bold">PVP: {v.selling_price}</span><span>Stock: {v.stock_current}</span></div><button type="button" onClick={() => handleRemoveVariant(idx)} className="text-red-400"><Trash2 size={14} /></button></div>))}</div>
                             </div>
                        )}

                        {/* Modifiers Section */}
                        <div className="bg-brand-900/50 p-4 rounded-xl border border-brand-700">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <label className="text-sm font-bold text-white flex items-center gap-2"><Layers size={16} className="text-brand-accent" /> Modificadores / Notas</label>
                                    <p className="text-xs text-gray-400">Opciones para el cliente (ej. Punto de la carne, Sin cebolla, Extra queso).</p>
                                </div>
                                <button type="button" onClick={() => {
                                    setProductForm(prev => ({
                                        ...prev,
                                        modifiers: [...(prev.modifiers || []), { name: '', is_required: false, multiple_selection: false, options: [] }]
                                    }));
                                }} className="bg-brand-800 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border border-brand-600">
                                    <Plus size={14} /> Añadir Grupo
                                </button>
                            </div>

                            <div className="space-y-4">
                                {productForm.modifiers?.map((modifier, modIdx) => (
                                    <div key={modIdx} className="bg-brand-800 border border-brand-600 rounded-lg p-3">
                                        <div className="flex gap-3 mb-3 items-start">
                                            <div className="flex-1">
                                                <input type="text" placeholder="Nombre del grupo (ej. Punto de la carne)" className="w-full bg-brand-900 border border-brand-600 rounded p-2 text-sm text-white" value={modifier.name} onChange={(e) => {
                                                    const newMods = [...(productForm.modifiers || [])];
                                                    newMods[modIdx].name = e.target.value;
                                                    setProductForm({ ...productForm, modifiers: newMods });
                                                }} />
                                            </div>
                                            <div className="flex items-center gap-2 bg-brand-900 p-2 rounded border border-brand-600">
                                                <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
                                                    <input type="checkbox" checked={modifier.is_required} onChange={(e) => {
                                                        const newMods = [...(productForm.modifiers || [])];
                                                        newMods[modIdx].is_required = e.target.checked;
                                                        setProductForm({ ...productForm, modifiers: newMods });
                                                    }} className="rounded border-gray-600 text-brand-accent focus:ring-brand-accent bg-brand-800" />
                                                    Obligatorio
                                                </label>
                                                <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer ml-2">
                                                    <input type="checkbox" checked={modifier.multiple_selection} onChange={(e) => {
                                                        const newMods = [...(productForm.modifiers || [])];
                                                        newMods[modIdx].multiple_selection = e.target.checked;
                                                        setProductForm({ ...productForm, modifiers: newMods });
                                                    }} className="rounded border-gray-600 text-brand-accent focus:ring-brand-accent bg-brand-800" />
                                                    Múltiple
                                                </label>
                                            </div>
                                            <button type="button" onClick={() => {
                                                const newMods = [...(productForm.modifiers || [])];
                                                newMods.splice(modIdx, 1);
                                                setProductForm({ ...productForm, modifiers: newMods });
                                            }} className="text-red-400 hover:text-white p-2"><Trash2 size={16} /></button>
                                        </div>

                                        <div className="pl-4 border-l-2 border-brand-700 space-y-2">
                                            {modifier.options.map((opt, optIdx) => (
                                                <div key={optIdx} className="flex gap-2 items-center">
                                                    <input type="text" placeholder="Opción (ej. Poco hecha)" className="flex-1 bg-brand-900 border border-brand-600 rounded p-1.5 text-xs text-white" value={opt.name} onChange={(e) => {
                                                        const newMods = [...(productForm.modifiers || [])];
                                                        newMods[modIdx].options[optIdx].name = e.target.value;
                                                        setProductForm({ ...productForm, modifiers: newMods });
                                                    }} />
                                                    <select 
                                                        className="w-1/3 bg-brand-900 border border-brand-600 rounded p-1.5 text-xs text-white outline-none" 
                                                        value={opt.product_id || ''} 
                                                        onChange={(e) => {
                                                            const newMods = [...(productForm.modifiers || [])];
                                                            newMods[modIdx].options[optIdx].product_id = e.target.value || undefined;
                                                            setProductForm({ ...productForm, modifiers: newMods });
                                                        }}
                                                    >
                                                        <option value="">Sin descuento de stock</option>
                                                        {products.filter(p => !p.is_compound).map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                    <div className="flex items-center gap-1 bg-brand-900 border border-brand-600 rounded px-2">
                                                        <span className="text-gray-400 text-xs">+</span>
                                                        <input type="number" step="0.01" placeholder="0.00" className="w-16 bg-transparent border-none p-1.5 text-xs text-white text-right focus:ring-0" value={opt.price_adjustment || ''} onChange={(e) => {
                                                            const newMods = [...(productForm.modifiers || [])];
                                                            newMods[modIdx].options[optIdx].price_adjustment = parseFloat(e.target.value) || 0;
                                                            setProductForm({ ...productForm, modifiers: newMods });
                                                        }} />
                                                        <span className="text-gray-400 text-xs">€</span>
                                                    </div>
                                                    <button type="button" onClick={() => {
                                                        const newMods = [...(productForm.modifiers || [])];
                                                        newMods[modIdx].options.splice(optIdx, 1);
                                                        setProductForm({ ...productForm, modifiers: newMods });
                                                    }} className="text-red-400 hover:text-white p-1"><X size={14} /></button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => {
                                                const newMods = [...(productForm.modifiers || [])];
                                                newMods[modIdx].options.push({ name: '', price_adjustment: 0 });
                                                setProductForm({ ...productForm, modifiers: newMods });
                                            }} className="text-xs text-brand-accent hover:text-white flex items-center gap-1 mt-2">
                                                <Plus size={12} /> Añadir opción
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {(!productForm.modifiers || productForm.modifiers.length === 0) && (
                                    <div className="text-center py-4 text-gray-500 text-xs border border-dashed border-brand-700 rounded-lg">
                                        No hay modificadores configurados.
                                    </div>
                                )}
                            </div>
                        </div>
                      </>
                    )}

                    {activeTab !== 'products' && activeTab !== 'suppliers' && activeTab !== 'units' && activeTab !== 'courses' && (
                        <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre</label><input required type="text" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white outline-none" value={simpleFormName} onChange={e => setSimpleFormName(e.target.value)} />
                             {activeTab === 'subcategories' && (
                                <div className="mt-4"><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Categoría Padre</label><select className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white outline-none" value={simpleFormParentId} onChange={e => setSimpleFormParentId(e.target.value)}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                             )}
                             {activeTab === 'categories' && (
                                <div className="mt-4">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Estación KDS (Pantalla de Cocina)</label>
                                    <select 
                                        className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white outline-none" 
                                        value={simpleFormKdsStation} 
                                        onChange={e => setSimpleFormKdsStation(e.target.value as any)}
                                    >
                                        <option value="none">Ninguna (No enviar a cocina)</option>
                                        <option value="kitchen">Cocina (Comida)</option>
                                        <option value="bar">Barra (Bebidas)</option>
                                    </select>
                                    <p className="text-[10px] text-gray-500 mt-1">Determina a qué pantalla se enviarán los productos de esta categoría.</p>
                                </div>
                             )}
                        </div>
                    )}
                    {activeTab === 'courses' && (
                         <div className="space-y-4">
                             <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre del Turno</label><input required type="text" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" placeholder="Ej. Primeros, Segundos, Postres" value={courseForm.name} onChange={e => setCourseForm({...courseForm, name: e.target.value})} /></div>
                             <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Orden de Salida</label><input required type="number" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" placeholder="Ej. 1, 2, 3" value={courseForm.order_index} onChange={e => setCourseForm({...courseForm, order_index: parseInt(e.target.value) || 0})} /><p className="text-[10px] text-gray-500 mt-1">Define el orden en el que se muestran y se marchan los platos (menor número sale antes).</p></div>
                         </div>
                    )}
                    {activeTab === 'suppliers' && (
                         <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Empresa</label><input type="text" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Contacto</label><input type="text" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" value={supplierForm.contact_name} onChange={e => setSupplierForm({...supplierForm, contact_name: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Teléfono</label><input type="text" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} /></div>
                         </div>
                    )}
                    {activeTab === 'units' && (
                         <div className="space-y-4">
                             <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre (Singular)</label><input required type="text" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" placeholder="Ej. Kilogramo, Botella, Caja" value={unitForm.name} onChange={e => setUnitForm({...unitForm, name: e.target.value})} /></div>
                             <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Abreviatura (Única)</label><input required type="text" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" placeholder="Ej. kg, u, cj" value={unitForm.abbreviation} onChange={e => setUnitForm({...unitForm, abbreviation: e.target.value})} /><p className="text-[10px] text-gray-500 mt-1">Este código se usará en los cálculos y visualización de stock.</p></div>
                         </div>
                    )}
                    {activeTab === 'purchase_orders' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Proveedor</label>
                                <select required className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" value={purchaseOrderForm.supplier_id} onChange={e => setPurchaseOrderForm({...purchaseOrderForm, supplier_id: e.target.value})}>
                                    <option value="">Seleccionar Proveedor...</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Fecha Esperada (Opcional)</label>
                                <input type="date" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" value={purchaseOrderForm.expected_date} onChange={e => setPurchaseOrderForm({...purchaseOrderForm, expected_date: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Notas (Opcional)</label>
                                <textarea className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" rows={2} value={purchaseOrderForm.notes} onChange={e => setPurchaseOrderForm({...purchaseOrderForm, notes: e.target.value})} />
                            </div>
                            <div className="border-t border-brand-700 pt-4">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Artículos del Pedido</label>
                                {purchaseOrderForm.items.map((item, index) => (
                                    <div key={index} className="flex gap-2 mb-2 items-center">
                                        <select required className="flex-1 bg-brand-900 border border-brand-600 rounded-lg p-2 text-white text-sm" value={item.product_id} onChange={e => {
                                            const newItems = [...purchaseOrderForm.items];
                                            newItems[index].product_id = e.target.value;
                                            const product = products.find(p => p.id === e.target.value);
                                            if (product) newItems[index].cost_price = product.cost_price;
                                            setPurchaseOrderForm({...purchaseOrderForm, items: newItems});
                                        }}>
                                            <option value="">Seleccionar Producto...</option>
                                            {products.filter(p => !p.is_compound && (purchaseOrderForm.supplier_id ? p.supplier_id === purchaseOrderForm.supplier_id : true)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <input required type="number" min="0.01" step="0.01" placeholder="Cant." className="w-20 bg-brand-900 border border-brand-600 rounded-lg p-2 text-white text-sm" value={item.quantity || ''} onChange={e => {
                                            const newItems = [...purchaseOrderForm.items];
                                            newItems[index].quantity = parseFloat(e.target.value);
                                            setPurchaseOrderForm({...purchaseOrderForm, items: newItems});
                                        }} />
                                        <input required type="number" min="0" step="0.01" placeholder="Coste" className="w-24 bg-brand-900 border border-brand-600 rounded-lg p-2 text-white text-sm" value={item.cost_price === 0 ? '' : item.cost_price} onChange={e => {
                                            const newItems = [...purchaseOrderForm.items];
                                            newItems[index].cost_price = parseFloat(e.target.value);
                                            setPurchaseOrderForm({...purchaseOrderForm, items: newItems});
                                        }} />
                                        <button type="button" onClick={() => {
                                            const newItems = [...purchaseOrderForm.items];
                                            newItems.splice(index, 1);
                                            setPurchaseOrderForm({...purchaseOrderForm, items: newItems});
                                        }} className="text-red-400 hover:text-red-300 p-2"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => setPurchaseOrderForm({...purchaseOrderForm, items: [...purchaseOrderForm.items, { product_id: '', quantity: 1, cost_price: 0 }]})} className="text-brand-accent hover:text-brand-accentHover text-sm font-bold flex items-center gap-1 mt-2">
                                    <Plus size={16} /> Añadir Artículo
                                </button>
                            </div>
                        </div>
                    )}
                    {activeTab === 'promotions' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre de la Promoción</label>
                                <input required type="text" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" placeholder="Ej. Happy Hour" value={promotionForm.name} onChange={e => setPromotionForm({...promotionForm, name: e.target.value})} />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tipo de Descuento</label>
                                    <select className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" value={promotionForm.discount_type} onChange={e => setPromotionForm({...promotionForm, discount_type: e.target.value as any})}>
                                        <option value="percentage">Porcentaje (%)</option>
                                        <option value="fixed_amount">Cantidad Fija (€)</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Valor del Descuento</label>
                                    <input required type="number" min="0" step="0.01" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" value={promotionForm.discount_value} onChange={e => setPromotionForm({...promotionForm, discount_value: parseFloat(e.target.value) || 0})} />
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Hora de Inicio</label>
                                    <input required type="time" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" value={promotionForm.start_time} onChange={e => setPromotionForm({...promotionForm, start_time: e.target.value})} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Hora de Fin</label>
                                    <input required type="time" className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white" value={promotionForm.end_time} onChange={e => setPromotionForm({...promotionForm, end_time: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Días de la Semana</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, index) => (
                                        <label key={index} className="flex items-center gap-1 text-sm text-gray-300 cursor-pointer bg-brand-900 p-2 rounded-lg border border-brand-600">
                                            <input type="checkbox" checked={promotionForm.days_of_week?.includes(index)} onChange={e => {
                                                const newDays = e.target.checked 
                                                    ? [...(promotionForm.days_of_week || []), index]
                                                    : (promotionForm.days_of_week || []).filter(d => d !== index);
                                                setPromotionForm({...promotionForm, days_of_week: newDays});
                                            }} className="rounded border-gray-600 text-brand-accent focus:ring-brand-accent bg-brand-800" />
                                            {day}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Categorías Aplicables</label>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-brand-900 p-2 rounded-lg border border-brand-600">
                                    {categories.map(cat => (
                                        <label key={cat.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer p-1 hover:bg-brand-800 rounded">
                                            <input type="checkbox" checked={promotionForm.applicable_categories?.includes(cat.id)} onChange={e => {
                                                const newCats = e.target.checked
                                                    ? [...(promotionForm.applicable_categories || []), cat.id]
                                                    : (promotionForm.applicable_categories || []).filter(c => c !== cat.id);
                                                setPromotionForm({...promotionForm, applicable_categories: newCats});
                                            }} className="rounded border-gray-600 text-brand-accent focus:ring-brand-accent bg-brand-800" />
                                            {cat.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Productos Específicos (Opcional)</label>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-brand-900 p-2 rounded-lg border border-brand-600">
                                    {products.map(prod => (
                                        <label key={prod.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer p-1 hover:bg-brand-800 rounded">
                                            <input type="checkbox" checked={promotionForm.applicable_products?.includes(prod.id)} onChange={e => {
                                                const newProds = e.target.checked
                                                    ? [...(promotionForm.applicable_products || []), prod.id]
                                                    : (promotionForm.applicable_products || []).filter(p => p !== prod.id);
                                                setPromotionForm({...promotionForm, applicable_products: newProds});
                                            }} className="rounded border-gray-600 text-brand-accent focus:ring-brand-accent bg-brand-800" />
                                            {prod.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-sm font-bold text-white cursor-pointer">
                                    <input type="checkbox" checked={promotionForm.is_active} onChange={e => setPromotionForm({...promotionForm, is_active: e.target.checked})} className="rounded border-gray-600 text-brand-accent focus:ring-brand-accent bg-brand-800 w-5 h-5" />
                                    Promoción Activa
                                </label>
                            </div>
                        </div>
                    )}
                 </form>
              </div>

              <div className="p-6 border-t border-brand-700 bg-brand-900/30 flex justify-end gap-3">
                 <button onClick={() => setIsModalOpen(false)} type="button" className="px-6 py-3 rounded-lg text-gray-400 hover:text-white font-medium">Cancelar</button>
                 <button form="inventory-form" disabled={saving} className="bg-brand-accent hover:bg-brand-accentHover text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2">
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Guardar
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-red-500 w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">¿Eliminar elemento?</h3>
                <p className="text-gray-400 mb-6">Se eliminará <span className="text-white font-bold">"{itemToDelete.name}"</span>.</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-brand-900 text-gray-300 hover:bg-brand-700 font-medium">Cancelar</button>
                  <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold flex items-center justify-center gap-2">
                    {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />} Eliminar
                  </button>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* BLOCKED DELETE MODAL */}
      {blockedDelete && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
                <ShieldAlert className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No se puede eliminar</h3>
                <p className="text-gray-400 mb-6">{blockedDelete.type} <strong className="text-white">"{blockedDelete.name}"</strong> está en uso en <strong>{blockedDelete.count}</strong> productos.</p>
                <button onClick={() => setBlockedDelete(null)} className="w-full bg-brand-700 hover:bg-brand-600 text-white py-3 rounded-xl font-medium">Entendido</button>
            </div>
        </div>
      )}

      {/* FOREIGN KEY VIOLATION MODAL */}
      {fkViolation.show && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-md shadow-2xl p-6">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4 border border-orange-500/20">
                        <ShieldAlert className="text-orange-500 w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No se puede eliminar</h3>
                    <p className="text-white font-bold text-lg mb-4">"{fkViolation.productName}"</p>
                    
                    <div className="bg-brand-900/50 p-4 rounded-xl border border-brand-700 text-sm text-left mb-6 w-full">
                        <p className="text-gray-300 mb-2">
                            <span className="text-brand-accent font-bold">Motivo: </span>
                            {fkViolation.type === 'orders' 
                                ? "Este producto forma parte de tickets de venta o comandas existentes."
                                : fkViolation.type === 'ingredients'
                                ? "Este producto es ingrediente en la receta de otro producto."
                                : "Este elemento está siendo usado en otras partes del sistema."}
                        </p>
                        <p className="text-gray-400">
                            <span className="text-white font-bold">Solución: </span>
                            {fkViolation.type === 'orders'
                                ? "Para no romper el historial contable, no se permite el borrado físico. Debes DESACTIVARLO (Archivar)."
                                : "Debes quitarlo de las recetas donde se usa o DESACTIVARLO si ya no lo vendes."}
                        </p>
                    </div>

                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setFkViolation({ ...fkViolation, show: false })}
                            className="flex-1 py-3 rounded-xl bg-brand-900 border border-brand-700 text-gray-300 hover:bg-brand-700 font-medium"
                        >
                            Entendido
                        </button>
                        <button 
                            onClick={handleArchiveFromViolation}
                            className="flex-1 py-3 rounded-xl bg-brand-accent hover:bg-brand-accentHover text-white font-bold flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <div className="flex items-center gap-2"><XCircle size={18} /> Desactivar</div>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* CONFIRM UPDATE CATEGORY MODAL */}
      {confirmUpdateModalOpen && pendingUpdate && (
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
                  <Info className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Confirmar cambio</h3>
                  <p className="text-gray-400 mb-6">
                      Vas a renombrar una {pendingUpdate.type === 'categories' ? 'categoría' : 'subcategoría'} que está siendo usada por <strong>{pendingUpdate.affectedCount}</strong> productos.
                      <br/>¿Deseas continuar?
                  </p>
                  <div className="flex gap-3">
                      <button onClick={() => { setConfirmUpdateModalOpen(false); setPendingUpdate(null); }} className="flex-1 bg-brand-900 text-gray-300 hover:bg-brand-700 py-3 rounded-xl font-medium">Cancelar</button>
                      <button onClick={proceedWithPendingUpdate} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold">Continuar</button>
                  </div>
              </div>
          </div>
      )}

      {/* DELIVERY NOTE MODAL */}
      {isDeliveryNoteModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                  <div className="p-4 border-b border-brand-700 flex justify-between items-center bg-brand-900/50">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                          <FolderInput className="text-blue-400" /> Recepción de Albarán
                      </h2>
                      <button onClick={() => setIsDeliveryNoteModalOpen(false)} className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-brand-700">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <div className="p-4 overflow-y-auto flex-1 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Notas / Referencia Albarán</label>
                          <input 
                              type="text" 
                              value={deliveryNoteNotes} 
                              onChange={e => setDeliveryNoteNotes(e.target.value)} 
                              placeholder="Ej: Albarán Proveedor X - #12345"
                              className="w-full bg-brand-900 border border-brand-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-brand-accent outline-none"
                          />
                      </div>

                      <div className="space-y-2">
                          <div className="flex justify-between items-center">
                              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Líneas del Albarán</h3>
                              <button 
                                  onClick={() => setDeliveryNoteItems([...deliveryNoteItems, { product_id: '', quantity: '', price: '' }])}
                                  className="text-xs bg-brand-700 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
                              >
                                  <Plus size={14} /> Añadir Línea
                              </button>
                          </div>
                          
                          {deliveryNoteItems.map((item, index) => (
                              <div key={index} className="flex items-start gap-2 bg-brand-900/50 p-3 rounded-xl border border-brand-700">
                                  <div className="flex-1">
                                      <label className="block text-xs text-gray-500 mb-1">Producto</label>
                                      <select
                                          value={item.product_id}
                                          onChange={e => {
                                              const newItems = [...deliveryNoteItems];
                                              newItems[index].product_id = e.target.value;
                                              setDeliveryNoteItems(newItems);
                                          }}
                                          className="w-full bg-brand-900 border border-brand-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-accent outline-none"
                                      >
                                          <option value="">Seleccionar producto...</option>
                                          {products.filter(p => p.active).map(p => (
                                              <option key={p.id} value={p.id}>{p.name}</option>
                                          ))}
                                      </select>
                                  </div>
                                  <div className="w-24">
                                      <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                                      <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={item.quantity}
                                          onChange={e => {
                                              const newItems = [...deliveryNoteItems];
                                              newItems[index].quantity = e.target.value;
                                              setDeliveryNoteItems(newItems);
                                          }}
                                          className="w-full bg-brand-900 border border-brand-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-accent outline-none"
                                      />
                                  </div>
                                  <div className="w-28">
                                      <label className="block text-xs text-gray-500 mb-1">Precio Total (€)</label>
                                      <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={item.price}
                                          onChange={e => {
                                              const newItems = [...deliveryNoteItems];
                                              newItems[index].price = e.target.value;
                                              setDeliveryNoteItems(newItems);
                                          }}
                                          className="w-full bg-brand-900 border border-brand-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-accent outline-none"
                                      />
                                  </div>
                                  <div className="pt-5">
                                      <button 
                                          onClick={() => {
                                              const newItems = [...deliveryNoteItems];
                                              newItems.splice(index, 1);
                                              setDeliveryNoteItems(newItems);
                                          }}
                                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                      >
                                          <Trash2 size={18} />
                                      </button>
                                  </div>
                              </div>
                          ))}
                          {deliveryNoteItems.length === 0 && (
                              <div className="text-center p-6 text-gray-500 text-sm bg-brand-900/30 rounded-xl border border-dashed border-brand-700">
                                  No hay líneas en el albarán. Añade productos para recibirlos.
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="p-4 border-t border-brand-700 bg-brand-900/50 flex justify-end gap-3">
                      <button 
                          onClick={() => setIsDeliveryNoteModalOpen(false)}
                          className="px-6 py-3 rounded-xl font-bold text-gray-300 hover:bg-brand-700 transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={async () => {
                              const validItems = deliveryNoteItems.filter(i => i.product_id && Number(i.quantity) > 0 && Number(i.price) >= 0);
                              if (validItems.length === 0) {
                                  alert('Añade al menos un producto con cantidad válida.');
                                  return;
                              }
                              setSaving(true);
                              try {
                                  const purchaseItems = validItems.map(i => ({
                                      product_id: i.product_id,
                                      quantity: Number(i.quantity),
                                      price: Number(i.price) / Number(i.quantity) // Convert total price to unit price
                                  }));
                                  await InventoryService.receivePurchase(purchaseItems, user?.id, deliveryNoteNotes);
                                  queryClient.invalidateQueries({ queryKey: ['products'] });
                                  setIsDeliveryNoteModalOpen(false);
                              } catch (e) {
                                  console.error(e);
                                  alert('Error al procesar el albarán');
                              } finally {
                                  setSaving(false);
                              }
                          }}
                          disabled={saving || deliveryNoteItems.length === 0}
                          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                      >
                          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                          Procesar Albarán
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default InventoryManagement;