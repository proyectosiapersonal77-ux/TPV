import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Grid, ShoppingCart, 
  Trash2, Send, CreditCard, ChevronLeft, Plus, Minus, X,
  Utensils, Loader2, Tag, AlertCircle, Split, Users, Calculator, CheckCircle2, ArrowRight, ArrowRightLeft, Layers, Banknote, Printer, MoreVertical
} from 'lucide-react';
import { Product, Order, Table, ProductVariant, OrderItem, ViewState } from '../../types';
import * as InventoryService from '../../services/inventoryService';
import * as OrderService from '../../services/orderService';
import * as TableService from '../../services/tableService';
import * as ZoneService from '../../services/zoneService';
import { useCartStore } from '../../stores/useCartStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AdminNavigation from '../AdminNavigation';
import { bluetoothPrinter } from '../../services/BluetoothPrinterService';
import { redsysService } from '../../services/RedsysService';

interface POSScreenProps {
  table: Table;
  onBack: () => void;
  employeeId: string;
  onNavigate: (view: ViewState) => void;
}

const POSScreen: React.FC<POSScreenProps> = ({ table, onBack, employeeId, onNavigate }) => {
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false); 
  const [error, setError] = useState<string | null>(null);
  
  // Zustand Cart Store
  const { items: cart, addItem, removeItem, updateQuantity, clearCart, total: cartTotal, activeTableId, setActiveTable } = useCartStore();

  // Handle Switching Tables logic
  useEffect(() => {
    if (activeTableId !== table.id) {
        clearCart();
        setActiveTable(table.id);
    }
  }, [table.id]);

  // React Query Fetching
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: InventoryService.getAllCategories });
  const { data: subcategories = [] } = useQuery({ queryKey: ['subcategories'], queryFn: InventoryService.getAllSubcategories });
  const { data: products = [], isLoading: loadingProducts } = useQuery({ queryKey: ['products'], queryFn: InventoryService.getAllProducts });
  const { data: tables = [] } = useQuery({ queryKey: ['tables'], queryFn: TableService.getAllTables });
  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: ZoneService.getAllZones });
  const { data: courses = [] } = useQuery({ queryKey: ['courses'], queryFn: InventoryService.getAllCourses });
  const { data: currentOrder, refetch: refetchOrder } = useQuery({ 
      queryKey: ['activeOrder', table.id], 
      queryFn: () => OrderService.getActiveOrderForTable(table.id),
      refetchInterval: 5000 // Poll every 5s for updates from other waiters
  });

  const activeProducts = useMemo(() => products.filter(p => p.active), [products]);

  // UI State
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeSubcategory, setActiveSubcategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [moveOrderModalOpen, setMoveOrderModalOpen] = useState(false);
  
  // Payment Logic State
  const [paymentMode, setPaymentMode] = useState<'full' | 'items' | 'diners' | 'manual'>('full');
  
  // Selections
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null);
  const [currentCourse, setCurrentCourse] = useState<string>('otros');

  // Set default category
  useEffect(() => {
    if (categories.length > 0 && activeCategory === 'all' && !activeCategory) setActiveCategory(categories[0].id);
  }, [categories]);

  // Set default course
  useEffect(() => {
    if (courses.length > 0 && currentCourse === 'otros') {
        setCurrentCourse(courses[0].name);
    }
  }, [courses]);

  // --- CART LOGIC ---
  const handleProductClick = (product: Product) => {
      const modifiers = InventoryService.getProductModifiers(product);
      const hasRequiredModifiers = modifiers.some(m => m.is_required);
      if ((product.variants && product.variants.length > 0) || hasRequiredModifiers) {
          setSelectedProductForVariant(product);
          setVariantModalOpen(true);
          return;
      }
      addItem(product, undefined, 1, '', 0, currentCourse);
  };

  // --- BARCODE SCANNER LOGIC ---
  const barcodeBuffer = useRef<string>('');
  const lastKeyTime = useRef<number>(Date.now());

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Ignore if typing in an input field
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
              return;
          }

          const currentTime = Date.now();
          // If more than 50ms passed since last key, reset buffer (human typing)
          if (currentTime - lastKeyTime.current > 50) {
              barcodeBuffer.current = '';
          }
          lastKeyTime.current = currentTime;

          if (e.key === 'Enter') {
              if (barcodeBuffer.current.length > 0) {
                  const scannedBarcode = barcodeBuffer.current;
                  const product = activeProducts.find(p => p.barcode === scannedBarcode);
                  if (product) {
                      handleProductClick(product);
                  } else {
                      // alert(`Producto no encontrado para el código: ${scannedBarcode}`);
                  }
                  barcodeBuffer.current = '';
              }
          } else if (e.key.length === 1) {
              barcodeBuffer.current += e.key;
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProducts, currentCourse]); // Added currentCourse to dependency array

  // --- FILTERING ---
  const filteredSubcategories = useMemo(() => {
      if (activeCategory === 'all') return [];
      return subcategories.filter(sub => sub.category_id === activeCategory);
  }, [activeCategory, subcategories]);

  const filteredProducts = useMemo(() => {
      return activeProducts.filter(p => {
          const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesCategory = activeCategory === 'all' || p.category_id === activeCategory;
          const matchesSubcategory = activeSubcategory === 'all' || p.subcategory_id === activeSubcategory;
          return matchesSearch && matchesCategory && matchesSubcategory;
      });
  }, [activeProducts, searchTerm, activeCategory, activeSubcategory]);

  const calculateTotal = () => {
      const dbTotal = currentOrder?.items?.reduce((acc: number, item: any) => acc + (Number(item.price) * item.quantity), 0) || 0;
      return cartTotal() + dbTotal;
  };

  // --- API ACTIONS ---

  const handleSendOrder = async () => {
      if (cart.length === 0) return;
      setProcessing(true);
      setError(null);
      try {
          let orderId = currentOrder?.id;

          if (!orderId) {
              const newOrder = await OrderService.createOrder(table.id, employeeId);
              orderId = newOrder.id;
          }

          const itemsToSend = cart.map(item => ({
              product_id: item.product.id,
              product_name: item.product.name,
              quantity: item.quantity,
              price: item.price,
              variant_name: item.variant?.name,
              notes: item.notes,
              course: item.course
          }));

          await OrderService.addItemsToOrder(orderId, itemsToSend, employeeId);
          
          clearCart();
          refetchOrder();
          setShowMobileCart(false);

      } catch (err: any) {
          console.error("Error sending order", err);
          setError("Error al enviar a cocina: " + err.message);
      } finally {
          setProcessing(false);
      }
  };

  const requestPayment = () => {
      const total = calculateTotal();
      if (total <= 0) {
          setError("No hay importe para cobrar.");
          return;
      }
      if (cart.length > 0) {
          setError("Envía los productos a cocina antes de cobrar.");
          return;
      }
      
      setPaymentMode('full'); // Reset mode
      setPaymentModalOpen(true);
  };

  const processFullPayment = async (method: 'cash' | 'card' = 'cash') => {
      if (!currentOrder) return;
      setProcessing(true);
      try {
          if (method === 'card' && redsysService.getConfig().enabled) {
              const total = calculateTotal();
              const result = await redsysService.sendPayment(total, currentOrder.id);
              if (!result.success) {
                  throw new Error(result.message);
              }
          }

          if (bluetoothPrinter.isConnected()) {
              try {
                  await handlePrintTicket();
              } catch (printErr) {
                  console.error("Error printing ticket during payment:", printErr);
                  // Don't block payment if printing fails
              }
          }
          await OrderService.closeOrder(currentOrder.id, method);
          queryClient.invalidateQueries({ queryKey: ['activeOrder'] });
          setPaymentModalOpen(false);
          onBack(); 
      } catch (err: any) {
          setError("Error: " + err.message);
      } finally {
          setProcessing(false);
      }
  };

  const handlePrintTicket = async () => {
      if (!currentOrder) return;
      
      try {
          if (!bluetoothPrinter.isConnected()) {
              setError("La impresora Bluetooth no está conectada. Configúrala en Ajustes > Impresoras.");
              return;
          }

          let ticketContent = `Mesa: ${table.name}\n`;
          ticketContent += `Fecha: ${new Date().toLocaleString()}\n`;
          ticketContent += `--------------------------------\n`;
          
          currentOrder.items?.forEach(item => {
              const name = item.product_name.substring(0, 20).padEnd(20);
              const qty = item.quantity.toString().padStart(2);
              const price = (item.price * item.quantity).toFixed(2).padStart(7);
              ticketContent += `${qty}x ${name} ${price}E\n`;
          });
          
          ticketContent += `--------------------------------\n`;
          ticketContent += `TOTAL:          ${calculateTotal().toFixed(2).padStart(10)}E\n`;
          
          await bluetoothPrinter.printReceipt(ticketContent);
      } catch (err: any) {
          setError("Error al imprimir: " + err.message);
      }
  };

  const getStatusColor = (status: string) => {
      switch(status) {
          case 'held': return 'text-orange-600';
          case 'pending': return 'text-orange-400';
          case 'cooking': return 'text-blue-400';
          case 'ready': return 'text-green-400';
          case 'served': return 'text-gray-500 line-through opacity-50';
          default: return 'text-gray-400';
      }
  };

  // --- PAYMENT MODAL SUB-COMPONENTS ---
  
  const handleMoveOrder = async (targetTableId: string) => {
      if (!currentOrder) return;
      setProcessing(true);
      try {
          await OrderService.moveOrderToTable(currentOrder.id, targetTableId, table.name);
          setMoveOrderModalOpen(false);
          onBack(); // Go back to table plan
      } catch (e: any) {
          setError("Error al mover mesa: " + e.message);
      } finally {
          setProcessing(false);
      }
  };

  const MoveOrderModal = ({ onClose }: { onClose: () => void }) => {
      const [selectedZone, setSelectedZone] = useState<string>(zones.length > 0 ? zones[0].name : '');
      const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

      const filteredTables = useMemo(() => 
          tables.filter(t => t.zone === selectedZone && t.id !== table.id && !t.parent_id), 
      [selectedZone, tables]);

      return (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-brand-700 flex justify-between items-center bg-brand-900/50">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <ArrowRightLeft className="text-brand-accent" />
                          Mover Mesa {table.name} a...
                      </h3>
                      <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24}/></button>
                  </div>

                  {/* Zone Tabs */}
                  <div className="flex bg-brand-900/30 border-b border-brand-700 overflow-x-auto shrink-0">
                      {zones.map(zone => (
                          <button
                              key={zone.id}
                              onClick={() => { setSelectedZone(zone.name); setSelectedTarget(null); }}
                              className={`px-6 py-4 font-bold text-sm uppercase whitespace-nowrap border-b-2 transition-colors ${
                                  selectedZone === zone.name 
                                  ? 'border-brand-accent text-brand-accent bg-brand-accent/5' 
                                  : 'border-transparent text-gray-400 hover:text-white hover:bg-brand-800'
                              }`}
                          >
                              {zone.name}
                          </button>
                      ))}
                  </div>

                  {/* Tables Grid */}
                  <div className="p-6 flex-1 overflow-y-auto bg-brand-900/20">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {filteredTables.map(t => (
                              <button
                                  key={t.id}
                                  onClick={() => setSelectedTarget(t.id)}
                                  className={`
                                      relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all p-2
                                      ${selectedTarget === t.id 
                                          ? 'border-brand-accent bg-brand-accent/20 shadow-[0_0_15px_rgba(217,119,6,0.3)] scale-95' 
                                          : 'border-brand-700 bg-brand-800 hover:border-gray-500 hover:bg-brand-700'
                                      }
                                  `}
                              >
                                  <span className="font-bold text-lg text-white">{t.name}</span>
                                  {/* We could show if it's occupied here if we had that data easily available, 
                                      but for now we just show the name. If occupied, backend handles merge. */}
                              </button>
                          ))}
                          {filteredTables.length === 0 && (
                              <div className="col-span-full text-center text-gray-500 py-10">
                                  No hay otras mesas disponibles en esta zona.
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-brand-700 bg-brand-900/50 flex justify-end gap-3">
                      <button 
                          onClick={onClose}
                          className="px-6 py-3 rounded-xl bg-brand-900 border border-brand-700 text-gray-300 hover:bg-brand-800 font-bold transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={() => selectedTarget && handleMoveOrder(selectedTarget)}
                          disabled={!selectedTarget || processing}
                          className="px-8 py-3 rounded-xl bg-brand-accent hover:bg-brand-accentHover disabled:opacity-50 disabled:bg-brand-800 text-white font-bold flex items-center gap-2 shadow-lg transition-all"
                      >
                          {processing ? <Loader2 className="animate-spin" /> : <ArrowRightLeft size={20} />}
                          Mover Comanda
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  const SplitByItems = ({ order, onClose }: { order: Order, onClose: () => void }) => {
      const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
      const [submitting, setSubmitting] = useState(false);

      const items = order.items || [];
      const selectedTotal = items
        .filter(i => selectedItems.has(i.id))
        .reduce((acc, i) => acc + (i.price * i.quantity), 0);

      const toggleItem = (id: string) => {
          const newSet = new Set(selectedItems);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          setSelectedItems(newSet);
      };

      const handleSplitAndPay = async (method: 'cash' | 'card' = 'cash') => {
          if (selectedItems.size === 0) return;
          setSubmitting(true);
          try {
              if (method === 'card' && redsysService.getConfig().enabled) {
                  const result = await redsysService.sendPayment(selectedTotal, order.id);
                  if (!result.success) {
                      throw new Error(result.message);
                  }
              }

              const itemsToMove = items.filter(i => selectedItems.has(i.id));
              // 1. Move items to new order
              const newOrderId = await OrderService.splitOrder(order, itemsToMove, employeeId);
              // 2. Pay that new order
              await OrderService.closeOrder(newOrderId, method);
              
              queryClient.invalidateQueries();
              
              if (selectedItems.size === items.length) {
                  // If we paid everything, close main modal
                  onClose(); 
                  onBack();
              } else {
                 // Refresh to show remaining
                 setSelectedItems(new Set());
                 refetchOrder();
              }
          } catch (e: any) {
              alert("Error: " + e.message);
          } finally {
              setSubmitting(false);
          }
      };

      return (
          <div className="flex flex-col h-full animate-in fade-in">
              <div className="flex-1 overflow-y-auto space-y-2 mb-4 bg-brand-900/50 p-2 rounded-xl border border-brand-700">
                  {items.length === 0 && <p className="text-gray-500 text-center p-4">No hay artículos.</p>}
                  {items.map(item => {
                      const isSel = selectedItems.has(item.id);
                      return (
                          <div 
                            key={item.id} 
                            onClick={() => toggleItem(item.id)}
                            className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all ${isSel ? 'bg-brand-accent/20 border-brand-accent text-white' : 'bg-brand-800 border-brand-700 text-gray-400 hover:border-gray-500'}`}
                          >
                             <div className="flex items-center gap-3">
                                 <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSel ? 'bg-brand-accent border-brand-accent' : 'border-gray-600'}`}>
                                     {isSel && <CheckCircle2 size={14} className="text-white"/>}
                                 </div>
                                 <div className="flex flex-col">
                                     <span className={isSel ? "font-bold" : ""}>{item.quantity}x {item.product_name}</span>
                                     <span className="text-xs opacity-70">{(item.price * item.quantity).toFixed(2)}€</span>
                                 </div>
                             </div>
                             <span className="font-mono font-bold">{(item.price * item.quantity).toFixed(2)}€</span>
                          </div>
                      );
                  })}
              </div>
              <div className="flex justify-between items-center bg-brand-900 p-4 rounded-xl border border-brand-700">
                  <span className="text-gray-400 text-sm">Total Seleccionado</span>
                  <span className="text-2xl font-bold text-brand-accent">{selectedTotal.toFixed(2)}€</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                  <button 
                    onClick={() => handleSplitAndPay('cash')}
                    disabled={selectedItems.size === 0 || submitting}
                    className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:bg-brand-800 text-white py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 shadow-lg"
                  >
                      {submitting ? <Loader2 className="animate-spin" /> : <Banknote size={24} />}
                      EFECTIVO ({selectedTotal.toFixed(2)}€)
                  </button>
                  <button 
                    onClick={() => handleSplitAndPay('card')}
                    disabled={selectedItems.size === 0 || submitting}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-brand-800 text-white py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 shadow-lg"
                  >
                      {submitting ? <Loader2 className="animate-spin" /> : <CreditCard size={24} />}
                      TARJETA ({selectedTotal.toFixed(2)}€)
                  </button>
              </div>
          </div>
      );
  };

  const SplitByCalculator = ({ total, onClose, mode }: { total: number, onClose: () => void, mode: 'diners' | 'manual' }) => {
      const [diners, setDiners] = useState(2);
      const [amountToPay, setAmountToPay] = useState<string>('');
      const [paidSoFar, setPaidSoFar] = useState(0);
      const [processing, setProcessing] = useState(false);

      const remaining = Math.max(0, total - paidSoFar);
      
      useEffect(() => {
          if (mode === 'diners') {
              setAmountToPay((remaining / diners).toFixed(2));
          } else {
              setAmountToPay('');
          }
      }, [diners, remaining, mode]);

      const handlePartialPay = async (method: 'cash' | 'card' = 'cash') => {
          const val = parseFloat(amountToPay);
          if (isNaN(val) || val <= 0 || val > remaining + 0.01) { // tolerance
              alert("Importe inválido");
              return;
          }

          setProcessing(true);
          
          try {
              if (method === 'card' && redsysService.getConfig().enabled) {
                  const result = await redsysService.sendPayment(val, currentOrder?.id || 'unknown');
                  if (!result.success) {
                      throw new Error(result.message);
                  }
              } else {
                  await new Promise(r => setTimeout(r, 600));
              }
              
              const newPaid = paidSoFar + val;
              setPaidSoFar(newPaid);
              
              if (Math.abs(total - newPaid) < 0.1) {
                  // We bypass the Redsys check in processFullPayment since we already paid here
                  // But processFullPayment will trigger Redsys again if we pass 'card'.
                  // Let's pass 'cash' to processFullPayment to avoid double charge, 
                  // or we can modify processFullPayment to accept a flag.
                  // Actually, if we just call processFullPayment('cash') it will close the order.
                  // But the payment method recorded will be cash.
                  // Let's just call OrderService.closeOrder directly here to be accurate.
                  if (bluetoothPrinter.isConnected()) {
                      try {
                          await handlePrintTicket();
                      } catch (printErr) {
                          console.error(printErr);
                      }
                  }
                  await OrderService.closeOrder(currentOrder!.id, method);
                  queryClient.invalidateQueries({ queryKey: ['activeOrder'] });
                  setPaymentModalOpen(false);
                  onBack();
              } else {
                  if (mode === 'manual') setAmountToPay('');
              }
          } catch (err: any) {
              alert("Error: " + err.message);
          } finally {
              setProcessing(false);
          }
      };

      return (
          <div className="flex flex-col h-full animate-in fade-in">
              <div className="bg-brand-900 p-4 rounded-xl border border-brand-700 mb-4 flex justify-between items-center">
                   <div>
                       <p className="text-xs text-gray-400 uppercase">Total Cuenta</p>
                       <p className="text-xl font-bold text-white">{total.toFixed(2)}€</p>
                   </div>
                   <div className="text-right">
                       <p className="text-xs text-brand-accent uppercase font-bold">Restante</p>
                       <p className="text-2xl font-bold text-brand-accent">{remaining.toFixed(2)}€</p>
                   </div>
              </div>

              {mode === 'diners' && (
                  <div className="mb-6">
                      <label className="block text-sm text-gray-400 mb-2">Número de personas</label>
                      <div className="flex gap-4 items-center bg-brand-800 p-2 rounded-xl border border-brand-700 justify-center">
                          <button onClick={() => setDiners(Math.max(1, diners - 1))} className="w-12 h-12 bg-brand-700 rounded-lg flex items-center justify-center text-xl font-bold hover:bg-brand-600"><Minus size={20}/></button>
                          <span className="text-2xl font-bold w-12 text-center">{diners}</span>
                          <button onClick={() => setDiners(diners + 1)} className="w-12 h-12 bg-brand-700 rounded-lg flex items-center justify-center text-xl font-bold hover:bg-brand-600"><Plus size={20}/></button>
                      </div>
                  </div>
              )}

              <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-2">Importe a Cobrar Ahora</label>
                  <div className="relative">
                      <input 
                        type="number" 
                        step="0.01"
                        value={amountToPay}
                        onChange={(e) => setAmountToPay(e.target.value)}
                        className="w-full bg-brand-900 border border-brand-600 rounded-xl p-4 text-3xl font-bold text-center text-white focus:border-brand-accent outline-none font-mono"
                        placeholder="0.00"
                        autoFocus
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">€</span>
                  </div>
                  {mode === 'diners' && (
                      <p className="text-center text-xs text-gray-500 mt-2">División sugerida: {(remaining / diners).toFixed(2)}€ / pers</p>
                  )}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                  <button 
                    onClick={() => handlePartialPay('cash')}
                    disabled={!amountToPay || parseFloat(amountToPay) <= 0 || processing}
                    className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:bg-brand-800 text-white py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 shadow-lg"
                  >
                      {processing ? <Loader2 className="animate-spin" /> : <Banknote size={24} />}
                      EFECTIVO {amountToPay ? parseFloat(amountToPay).toFixed(2) : '0.00'}€
                      {Math.abs(remaining - (parseFloat(amountToPay) || 0)) < 0.1 && <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded">(FINALIZAR)</span>}
                  </button>
                  <button 
                    onClick={() => handlePartialPay('card')}
                    disabled={!amountToPay || parseFloat(amountToPay) <= 0 || processing}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-brand-800 text-white py-4 rounded-xl font-bold flex flex-col items-center justify-center gap-2 shadow-lg"
                  >
                      {processing ? <Loader2 className="animate-spin" /> : <CreditCard size={24} />}
                      TARJETA {amountToPay ? parseFloat(amountToPay).toFixed(2) : '0.00'}€
                      {Math.abs(remaining - (parseFloat(amountToPay) || 0)) < 0.1 && <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded">(FINALIZAR)</span>}
                  </button>
              </div>
          </div>
      );
  };

  const VariantModifierModal = ({ product, modifiers, hasVariants, onClose, onAdd }: any) => {
      const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
      const [selectedModifiers, setSelectedModifiers] = useState<Record<string, Set<string>>>({});
      const [customNotes, setCustomNotes] = useState('');

      // Initialize modifier state
      useEffect(() => {
          const initialMods: Record<string, Set<string>> = {};
          modifiers.forEach((mod: any) => {
              initialMods[mod.name] = new Set();
          });
          setSelectedModifiers(initialMods);
      }, [modifiers]);

      const handleModifierToggle = (modName: string, optName: string, isMultiple: boolean) => {
          setSelectedModifiers(prev => {
              const newSet = new Set(prev[modName]);
              if (newSet.has(optName)) {
                  newSet.delete(optName);
              } else {
                  if (!isMultiple) newSet.clear();
                  newSet.add(optName);
              }
              return { ...prev, [modName]: newSet };
          });
      };

      const calculateExtraPrice = () => {
          let extra = 0;
          modifiers.forEach((mod: any) => {
              const selected = selectedModifiers[mod.name];
              if (selected) {
                  mod.options.forEach((opt: any) => {
                      if (selected.has(opt.name)) {
                          extra += (opt.price_adjustment || 0);
                      }
                  });
              }
          });
          return extra;
      };

      const generateNotes = () => {
          const parts: string[] = [];
          modifiers.forEach((mod: any) => {
              const selected = selectedModifiers[mod.name];
              if (selected && selected.size > 0) {
                  parts.push(`${mod.name}: ${Array.from(selected).join(', ')}`);
              }
          });
          if (customNotes) parts.push(`Notas: ${customNotes}`);
          return parts.join(' | ');
      };

      const isReady = () => {
          // The user requested that the "Añadir al Ticket" button is always active
          // without the obligation to choose any option.
          return true;
      };

      const basePrice = selectedVariant ? Number(selectedVariant.selling_price) : Number(product.selling_price);
      const extraPrice = calculateExtraPrice();
      const totalPrice = basePrice + extraPrice;

      return (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-brand-700 flex justify-between items-center bg-brand-900/50 shrink-0">
                      <h3 className="font-bold text-white text-lg">{product.name}</h3>
                      <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24}/></button>
                  </div>
                  
                  <div className="p-4 overflow-y-auto space-y-6 flex-1">
                      {hasVariants && (
                          <div>
                              <p className="text-xs text-gray-400 uppercase font-bold mb-3 flex items-center gap-2">
                                  <Layers size={14} className="text-brand-accent"/> Formato <span className="text-red-400 text-[10px]">*Obligatorio</span>
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                  {product.variants?.map((variant: any) => (
                                      <button
                                          key={variant.id}
                                          onClick={() => setSelectedVariant(variant)}
                                          className={`p-3 rounded-xl border text-left transition-all ${
                                              selectedVariant?.id === variant.id 
                                              ? 'bg-brand-accent/20 border-brand-accent text-white' 
                                              : 'bg-brand-900 border-brand-700 text-gray-300 hover:border-gray-500'
                                          }`}
                                      >
                                          <div className="font-bold">{variant.name}</div>
                                          <div className="font-mono text-sm mt-1">{variant.selling_price.toFixed(2)}€</div>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}

                      {modifiers.map((mod: any, idx: number) => (
                          <div key={idx}>
                              <p className="text-xs text-gray-400 uppercase font-bold mb-3 flex items-center gap-2">
                                  <Tag size={14} className="text-brand-accent"/> {mod.name} 
                                  {mod.is_required && <span className="text-red-400 text-[10px]">*Obligatorio</span>}
                                  {!mod.is_required && <span className="text-gray-500 text-[10px]">(Opcional)</span>}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                  {mod.options.map((opt: any, optIdx: number) => {
                                      const isSelected = selectedModifiers[mod.name]?.has(opt.name);
                                      return (
                                          <button
                                              key={optIdx}
                                              onClick={() => handleModifierToggle(mod.name, opt.name, mod.multiple_selection)}
                                              className={`px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                                                  isSelected 
                                                  ? 'bg-brand-accent/20 border-brand-accent text-white' 
                                                  : 'bg-brand-900 border-brand-700 text-gray-300 hover:border-gray-500'
                                              }`}
                                          >
                                              {opt.name}
                                              {opt.price_adjustment > 0 && (
                                                  <span className="text-[10px] font-mono opacity-70">+{opt.price_adjustment.toFixed(2)}€</span>
                                              )}
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>
                      ))}

                      <div>
                          <p className="text-xs text-gray-400 uppercase font-bold mb-2">Notas adicionales</p>
                          <textarea 
                              className="w-full bg-brand-900 border border-brand-700 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-brand-accent outline-none resize-none"
                              rows={2}
                              placeholder="Ej. Muy hecho, sin sal..."
                              value={customNotes}
                              onChange={(e) => setCustomNotes(e.target.value)}
                          ></textarea>
                      </div>
                  </div>

                  <div className="p-4 border-t border-brand-700 bg-brand-900/50 shrink-0">
                      <div className="flex justify-between items-center mb-4">
                          <span className="text-gray-400 text-sm">Total</span>
                          <span className="text-2xl font-bold text-white font-mono">{totalPrice.toFixed(2)}€</span>
                      </div>
                      <button 
                          onClick={() => onAdd(product, selectedVariant, generateNotes(), extraPrice)}
                          disabled={!isReady()}
                          className="w-full py-4 rounded-xl bg-brand-accent hover:bg-brand-accentHover disabled:opacity-50 disabled:bg-brand-800 text-white font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
                      >
                          <Plus size={20} /> Añadir al Ticket
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  const TicketContent = () => (
    <div className="flex flex-col h-full bg-brand-800 relative">
        <div className="p-4 bg-brand-900 border-b border-brand-700 shrink-0 flex justify-between items-center">
            {/* Make table number clickable to go back */}
            <div 
                onClick={() => showMobileCart ? setShowMobileCart(false) : onBack()} 
                className="cursor-pointer group select-none hover:opacity-80 transition-opacity"
            >
                <div className="flex justify-between items-center mb-1">
                    <h2 className="font-bold text-lg flex items-center gap-2 text-white">
                        <span className="bg-brand-accent text-white w-8 h-8 rounded-full flex items-center justify-center text-sm group-hover:scale-110 transition-transform">{table.name.replace(/\D/g, '') || '#'}</span>
                        {table.name}
                    </h2>
                </div>
                <div className="flex text-xs text-gray-500 gap-2">
                    <span>#{currentOrder?.id ? currentOrder.id.slice(0,8) : 'NUEVO'}</span>
                </div>
            </div>
            
            <div className="flex items-center gap-1">
                {currentOrder && (
                    <>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handlePrintTicket(); }}
                            className="p-2 text-gray-400 hover:text-brand-accent hover:bg-brand-800 rounded-full transition-colors"
                            title="Imprimir Ticket"
                        >
                            <Printer size={20} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setMoveOrderModalOpen(true); }}
                            className="p-2 text-gray-400 hover:text-brand-accent hover:bg-brand-800 rounded-full transition-colors"
                            title="Mover Mesa"
                        >
                            <ArrowRightLeft size={20} />
                        </button>
                    </>
                )}
                <button onClick={() => setShowMobileCart(false)} className="md:hidden p-2 text-gray-400 hover:text-white bg-brand-800 rounded-full">
                    <X size={24}/>
                </button>
            </div>
        </div>

        {error && (
            <div className="p-3 bg-red-500/20 border-b border-red-500/30 flex items-start gap-2 text-red-200 text-sm">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-brand-800">
            {currentOrder?.items && currentOrder.items.some((i: any) => i.status === 'held') && (
                <div className="mb-4 bg-brand-900/50 p-3 rounded-xl border border-orange-500/30">
                    <div className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <AlertCircle size={14} /> Platos Retenidos
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {courses.map(c => c.name).map(course => {
                            const hasHeld = currentOrder.items?.some((i: any) => i.course === course && i.status === 'held');
                            if (!hasHeld) return null;
                            return (
                                <button
                                    key={course}
                                    onClick={async () => {
                                        setProcessing(true);
                                        try {
                                            await OrderService.fireCourse(currentOrder.id, course);
                                            refetchOrder();
                                        } catch (e) {
                                            console.error(e);
                                        } finally {
                                            setProcessing(false);
                                        }
                                    }}
                                    className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-md transition-colors flex items-center gap-1"
                                >
                                    <Send size={12} /> Marchar {course}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {currentOrder?.items && currentOrder.items.length > 0 && (
                <div className="mb-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider px-2 py-1 mb-1 flex items-center gap-2">
                            <Send size={12} /> Enviado a Cocina
                    </div>
                    {currentOrder.items.map((item: any) => (
                        <div key={item.id} className={`flex justify-between items-start p-3 rounded-lg bg-brand-900/50 border border-brand-700/50 text-sm ${item.status === 'served' ? 'opacity-50' : ''} ${item.status === 'held' ? 'opacity-60 border-orange-500/30' : ''}`}>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold ${item.quantity > 1 ? 'text-brand-accent' : 'text-gray-300'}`}>{item.quantity}x</span>
                                    <span className={item.status === 'served' ? 'line-through text-gray-500' : 'text-gray-200'}>
                                        {item.product_name} 
                                        {item.variant_name && <span className="text-gray-400 font-normal ml-1">({item.variant_name})</span>}
                                    </span>
                                </div>
                                {item.notes && (
                                    <div className="text-[10px] text-gray-400 mt-0.5 italic">
                                        {item.notes}
                                    </div>
                                )}
                                {item.course && item.course !== 'otros' && (
                                    <div className="text-[10px] text-orange-400 uppercase font-bold mt-1">
                                        {item.course}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] uppercase font-bold ${getStatusColor(item.status)}`}>
                                        {item.status === 'held' ? 'Retenido' : item.status === 'pending' ? 'Pendiente' : item.status === 'cooking' ? 'Cocinando' : item.status === 'ready' ? 'Listo' : 'Servido'}
                                    </span>
                                </div>
                            </div>
                            <span className="font-mono text-gray-400">{(item.price * item.quantity).toFixed(2)}€</span>
                        </div>
                    ))}
                </div>
            )}

            {cart.length > 0 && (
                <div>
                    <div className="text-xs font-bold text-brand-accent uppercase tracking-wider px-2 py-1 mb-1 flex items-center gap-2 animate-pulse">
                        <ShoppingCart size={12} /> Nuevo Pedido
                    </div>
                    {cart.map((item, idx) => (
                        <div key={item.tempId} className="flex flex-col p-3 rounded-lg bg-brand-700 border border-brand-600 mb-2 animate-in slide-in-from-right-2 duration-300">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                    <span className="font-bold text-white text-base block leading-tight">
                                        {item.product.name} 
                                        {item.variant && <span className="text-brand-accent font-normal ml-1">({item.variant.name})</span>}
                                    </span>
                                    {item.notes && (
                                        <span className="text-xs text-brand-accent block mt-0.5 italic">
                                            {item.notes}
                                        </span>
                                    )}
                                    {item.course && item.course !== 'otros' && (
                                        <span className="text-[10px] text-orange-400 uppercase font-bold block mt-1">
                                            {item.course}
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-400">{item.price.toFixed(2)}€ / ud</span>
                                </div>
                                <span className="font-mono font-bold text-white text-lg ml-2">{(item.price * item.quantity).toFixed(2)}€</span>
                            </div>
                            
                            <div className="flex items-center justify-between bg-brand-800/60 rounded-lg p-1.5 border border-brand-700/50">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => updateQuantity(idx, -1)} className="w-10 h-10 flex items-center justify-center bg-brand-600 hover:bg-brand-500 border border-brand-500 text-white rounded-lg transition-colors active:scale-95 shadow-sm"><Minus size={18}/></button>
                                    <span className="font-bold text-xl w-8 text-center text-white">{item.quantity}</span>
                                    <button onClick={() => updateQuantity(idx, 1)} className="w-10 h-10 flex items-center justify-center bg-brand-600 hover:bg-brand-500 border border-brand-500 text-white rounded-lg transition-colors active:scale-95 shadow-sm"><Plus size={18}/></button>
                                </div>
                                <button onClick={() => removeItem(idx)} className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 hover:border-red-500 rounded-lg transition-all active:scale-95"><Trash2 size={18}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!currentOrder?.items?.length && cart.length === 0 && (
                <div className="h-40 flex flex-col items-center justify-center text-gray-500">
                    <ShoppingCart size={32} className="mb-2 opacity-20" />
                    <p className="text-sm">Ticket vacío</p>
                </div>
            )}
        </div>

        <div className="p-4 bg-brand-900 border-t border-brand-700 shrink-0 pb-safe">
            <div className="flex justify-between items-end mb-4">
                <span className="text-gray-400 text-sm font-medium">Total</span>
                <span className="text-3xl font-bold text-white">{calculateTotal().toFixed(2)}€</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <button onClick={handleSendOrder} disabled={cart.length === 0 || processing} className="bg-brand-accent hover:bg-brand-accentHover disabled:opacity-50 disabled:bg-brand-800 disabled:text-gray-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
                    {processing && cart.length > 0 ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                    <span className="hidden sm:inline">ENVIAR</span>
                    <span className="sm:hidden">PEDIR</span>
                </button>
                <button onClick={requestPayment} disabled={calculateTotal() <= 0 || processing} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:bg-brand-800 disabled:text-gray-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95">
                    <CreditCard size={20} />
                    COBRAR
                </button>
            </div>
        </div>
    </div>
  );

  if (loadingProducts) return <div className="flex items-center justify-center h-screen bg-brand-900 text-white"><Loader2 className="animate-spin mr-2"/> Cargando TPV...</div>;

  return (
    <div className="flex h-screen bg-brand-900 text-white overflow-hidden font-sans">
        
        {/* === LEFT SIDEBAR (Desktop Only) === */}
        <div className="hidden md:flex w-24 md:w-32 bg-brand-800 border-r border-brand-700 flex-col shrink-0 overflow-y-auto no-scrollbar z-10">
            <button onClick={onBack} className="p-4 bg-brand-900 border-b border-brand-700 hover:bg-brand-700 transition-colors flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-white sticky top-0 z-10">
                <ChevronLeft size={24} />
                <span className="text-[10px] uppercase font-bold">Salir</span>
            </button>
            <button 
                onClick={() => { setActiveCategory('all'); setActiveSubcategory('all'); }}
                className={`p-4 border-b border-brand-700 flex flex-col items-center justify-center gap-2 transition-all ${activeCategory === 'all' ? 'bg-brand-accent text-white' : 'text-gray-400 hover:bg-brand-700/50 hover:text-white'}`}
            >
                <Grid size={24} />
                <span className="text-[10px] uppercase font-bold text-center">Todo</span>
            </button>
            {categories.map(cat => (
                <button 
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); setActiveSubcategory('all'); }}
                    className={`p-4 border-b border-brand-700 flex flex-col items-center justify-center gap-2 transition-all h-24 ${activeCategory === cat.id ? 'bg-brand-accent text-white' : 'text-gray-400 hover:bg-brand-700/50 hover:text-white'}`}
                >
                    <Utensils size={24} />
                    <span className="text-[10px] uppercase font-bold text-center leading-tight">{cat.name}</span>
                </button>
            ))}
        </div>

        {/* === CENTER CONTENT (Products) === */}
        <div className="flex-1 flex flex-col min-w-0 bg-brand-900 relative h-full">
             
             {/* Header Mobile: Exit + Search */}
             <div className="md:hidden flex items-center p-2 gap-2 bg-brand-800 border-b border-brand-700 shrink-0">
                 <button onClick={onBack} className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-brand-700 text-gray-400 hover:text-white transition-colors">
                    <ChevronLeft size={24}/>
                    <span className="bg-brand-accent text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                        {table.name.replace(/\D/g, '') || '#'}
                    </span>
                 </button>
                 <div className="flex-1 relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                     <input 
                        type="text" 
                        placeholder="Buscar..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-brand-900 border border-brand-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:ring-1 focus:ring-brand-accent outline-none"
                     />
                 </div>
                 <AdminNavigation onNavigate={onNavigate} currentView="pos" />
             </div>

             {/* Mobile Category Scroll */}
             <div className="md:hidden flex overflow-x-auto border-b border-brand-700 bg-brand-800/80 p-2 gap-2 shrink-0">
                <button onClick={() => { setActiveCategory('all'); setActiveSubcategory('all'); }} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${activeCategory === 'all' ? 'bg-brand-accent text-white' : 'bg-brand-900 text-gray-400'}`}>
                    TODO
                </button>
                {categories.map(cat => (
                    <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setActiveSubcategory('all'); }} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${activeCategory === cat.id ? 'bg-brand-accent text-white' : 'bg-brand-900 text-gray-400'}`}>
                        {cat.name.toUpperCase()}
                    </button>
                ))}
             </div>

             {/* Subcategories Bar (Desktop & Mobile) */}
             {filteredSubcategories.length > 0 && (
                 <div className="flex overflow-x-auto border-b border-brand-700 bg-brand-800/50 p-2 gap-2 shrink-0">
                     <button 
                        onClick={() => setActiveSubcategory('all')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${activeSubcategory === 'all' ? 'bg-brand-700 text-white' : 'bg-brand-900 text-gray-400 hover:bg-brand-800'}`}
                     >
                         TODOS
                     </button>
                     {filteredSubcategories.map(sub => (
                         <button 
                            key={sub.id}
                            onClick={() => setActiveSubcategory(sub.id)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${activeSubcategory === sub.id ? 'bg-brand-700 text-white' : 'bg-brand-900 text-gray-400 hover:bg-brand-800'}`}
                         >
                             {sub.name.toUpperCase()}
                         </button>
                     ))}
                 </div>
             )}

             {/* Search Bar (Desktop Only) */}
             <div className="hidden md:flex p-3 border-b border-brand-700 bg-brand-800/30 gap-2 shrink-0 items-center justify-between">
                 <div className="relative w-64">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                     <input 
                        type="text" 
                        placeholder="Buscar producto..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-brand-900 border border-brand-600 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-brand-accent outline-none"
                     />
                 </div>
                 <AdminNavigation onNavigate={onNavigate} currentView="pos" />
             </div>

             {/* Course Selector (Marchar Platos) */}
             <div className="flex overflow-x-auto border-b border-brand-700 bg-brand-900 p-2 gap-2 shrink-0 items-center">
                 <span className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-2 mr-1">Turno:</span>
                 {courses.map(course => (
                     <button
                         key={course.id}
                         onClick={() => setCurrentCourse(course.name)}
                         className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${
                             currentCourse === course.name 
                             ? 'bg-orange-600/20 border-orange-500 text-orange-400' 
                             : 'bg-brand-800 border-brand-700 text-gray-400 hover:bg-brand-700'
                         }`}
                     >
                         {course.name}
                     </button>
                 ))}
             </div>

             {/* Products Grid */}
             <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-28 md:pb-4">
                 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                     {filteredProducts.map(product => (
                         <button 
                            key={product.id}
                            onClick={() => handleProductClick(product)}
                            className={`
                                border-2 border-brand-700 hover:border-brand-accent active:bg-brand-700
                                rounded-xl p-3 md:p-4 flex flex-col items-start justify-between
                                gap-2 md:gap-3 transition-all active:scale-95 h-28 md:h-32
                                relative overflow-hidden group shadow-sm
                                ${product.image_url ? 'bg-brand-900' : 'bg-brand-800'}
                            `}
                         >
                            {product.image_url && (
                                 <>
                                    <img 
                                        src={product.image_url} 
                                        alt={product.name} 
                                        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/40"></div>
                                 </>
                             )}

                            {(product.variants && product.variants.length > 0) || (InventoryService.getProductModifiers(product).length > 0) ? (
                                <div className="absolute top-2 right-2 z-20 p-1.5 bg-brand-900/80 rounded-full text-white backdrop-blur-sm shadow-sm">
                                    <MoreVertical size={16} />
                                </div>
                            ) : null}

                            <div className="w-full relative z-10">
                                <h3 className="font-bold text-left text-sm md:text-base leading-tight line-clamp-2 text-white drop-shadow-sm">{product.name}</h3>
                                {InventoryService.getRegularAttributes(product).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {InventoryService.getRegularAttributes(product).slice(0, 2).map((attr, i) => (
                                            <span key={i} className="text-[8px] md:text-[9px] bg-brand-900/80 px-1.5 rounded text-gray-400 backdrop-blur-sm">{attr}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="w-full flex justify-between items-end relative z-10">
                                <span className="font-bold text-brand-accent text-base md:text-lg drop-shadow-sm">{product.selling_price.toFixed(2)}€</span>
                            </div>
                         </button>
                     ))}
                 </div>
             </div>
        </div>

        {/* === RIGHT SIDEBAR (Desktop Only) === */}
        <div className="hidden md:flex w-80 md:w-96 bg-brand-800 border-l border-brand-700 flex-col shrink-0 shadow-2xl z-20 h-full">
            <TicketContent />
        </div>

        {/* === MOBILE BOTTOM BAR === */}
        <div className="md:hidden fixed bottom-0 left-0 w-full bg-brand-900 border-t border-brand-700 p-4 z-30 safe-bottom">
            <button 
                onClick={() => setShowMobileCart(true)}
                className="w-full bg-brand-accent hover:bg-brand-accentHover text-white rounded-xl py-4 px-6 flex justify-between items-center shadow-lg active:scale-95 transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold min-w-[2.5rem] text-center">
                        {(currentOrder?.items?.length || 0) + cart.reduce((acc, i) => acc + i.quantity, 0)}
                    </div>
                    <span className="font-bold">Ver Pedido / Cobrar</span>
                </div>
                <span className="font-mono text-xl font-bold">{calculateTotal().toFixed(2)}€</span>
            </button>
        </div>

        {/* === MOBILE FULL SCREEN CART MODAL === */}
        {showMobileCart && (
            <div className="md:hidden fixed inset-0 z-40 bg-brand-800 flex flex-col animate-in slide-in-from-bottom-full duration-200">
                <TicketContent />
            </div>
        )}

        {/* === ADVANCED PAYMENT MODAL === */}
        {paymentModalOpen && currentOrder && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="p-4 border-b border-brand-700 flex justify-between items-center bg-brand-900/50 shrink-0">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <CreditCard className="text-brand-accent" />
                            Cobrar Mesa {table.name}
                        </h3>
                        <button onClick={() => setPaymentModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24}/></button>
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex border-b border-brand-700 bg-brand-900/30 shrink-0">
                        <button 
                            onClick={() => setPaymentMode('full')} 
                            className={`flex-1 py-4 font-bold text-sm uppercase flex items-center justify-center gap-2 border-b-2 ${paymentMode === 'full' ? 'border-brand-accent text-brand-accent bg-brand-accent/5' : 'border-transparent text-gray-400 hover:text-white hover:bg-brand-800'}`}
                        >
                            <ArrowRight size={18} /> Completo
                        </button>
                        <button 
                            onClick={() => setPaymentMode('items')} 
                            className={`flex-1 py-4 font-bold text-sm uppercase flex items-center justify-center gap-2 border-b-2 ${paymentMode === 'items' ? 'border-brand-accent text-brand-accent bg-brand-accent/5' : 'border-transparent text-gray-400 hover:text-white hover:bg-brand-800'}`}
                        >
                            <Split size={18} /> Artículos
                        </button>
                        <button 
                            onClick={() => setPaymentMode('diners')} 
                            className={`flex-1 py-4 font-bold text-sm uppercase flex items-center justify-center gap-2 border-b-2 ${paymentMode === 'diners' ? 'border-brand-accent text-brand-accent bg-brand-accent/5' : 'border-transparent text-gray-400 hover:text-white hover:bg-brand-800'}`}
                        >
                            <Users size={18} /> Comensales
                        </button>
                        <button 
                            onClick={() => setPaymentMode('manual')} 
                            className={`flex-1 py-4 font-bold text-sm uppercase flex items-center justify-center gap-2 border-b-2 ${paymentMode === 'manual' ? 'border-brand-accent text-brand-accent bg-brand-accent/5' : 'border-transparent text-gray-400 hover:text-white hover:bg-brand-800'}`}
                        >
                            <Calculator size={18} /> Manual
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex-1 overflow-hidden">
                        {paymentMode === 'full' && (
                            <div className="text-center flex flex-col h-full justify-center">
                                <div className="mb-8">
                                    <p className="text-gray-400 mb-2 uppercase tracking-widest text-sm font-bold">Total a Pagar</p>
                                    <div className="text-5xl font-bold text-white font-mono">{calculateTotal().toFixed(2)}€</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => processFullPayment('cash')} 
                                        disabled={processing} 
                                        className="w-full py-5 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-bold flex flex-col items-center justify-center gap-2 text-xl shadow-lg shadow-green-900/20 active:scale-95 transition-all"
                                    >
                                        {processing ? <Loader2 className="animate-spin" /> : <Banknote size={32} />}
                                        EFECTIVO
                                    </button>
                                    <button 
                                        onClick={() => processFullPayment('card')} 
                                        disabled={processing} 
                                        className="w-full py-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex flex-col items-center justify-center gap-2 text-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                                    >
                                        {processing ? <Loader2 className="animate-spin" /> : <CreditCard size={32} />}
                                        TARJETA
                                    </button>
                                </div>
                            </div>
                        )}

                        {paymentMode === 'items' && (
                            <SplitByItems order={currentOrder} onClose={() => setPaymentModalOpen(false)} />
                        )}

                        {(paymentMode === 'diners' || paymentMode === 'manual') && (
                            <SplitByCalculator 
                                total={calculateTotal()} 
                                onClose={() => setPaymentModalOpen(false)} 
                                mode={paymentMode} 
                            />
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* === VARIANT & MODIFIER MODAL === */}
        {variantModalOpen && selectedProductForVariant && (() => {
            const modifiers = InventoryService.getProductModifiers(selectedProductForVariant);
            const hasVariants = selectedProductForVariant.variants && selectedProductForVariant.variants.length > 0;
            
            // We need local state for this modal if it has modifiers
            // Since we can't easily add hooks inside the render, we'll create a sub-component
            return <VariantModifierModal 
                product={selectedProductForVariant} 
                modifiers={modifiers}
                hasVariants={hasVariants}
                onClose={() => setVariantModalOpen(false)} 
                onAdd={(product, variant, notes, extraPrice) => {
                    // We need to pass notes and extraPrice to addItem
                    // We'll update useCartStore to handle this
                    addItem(product, variant, 1, notes, extraPrice);
                    setVariantModalOpen(false);
                }} 
            />;
        })()}

        {/* === MOVE ORDER MODAL === */}
        {moveOrderModalOpen && <MoveOrderModal onClose={() => setMoveOrderModalOpen(false)} />}
    </div>
  );
};

export default POSScreen;