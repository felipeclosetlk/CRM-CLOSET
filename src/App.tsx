import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup,
  signOut, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  User,
  getDocs
} from './firebase';
import { Cliente, OperationType, FirestoreErrorInfo } from './types';
import { 
  PlusCircle, 
  Search, 
  Trash2, 
  Download, 
  Phone, 
  Heart, 
  ShoppingBag, 
  MapPin, 
  Ruler, 
  Calendar, 
  MessageCircle, 
  ToggleLeft, 
  ToggleRight, 
  Sparkles, 
  Users, 
  LogOut, 
  LogIn,
  Loader2,
  AlertTriangle,
  BarChart3,
  Edit2,
  X,
  Clipboard,
  LayoutDashboard,
  List,
  ExternalLink
} from 'lucide-react';
import { 
  DndContext, 
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Error handler
const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// Helper to get or create a local guest ID
const getGuestId = () => {
  let id = localStorage.getItem('crm_guest_id');
  if (!id) {
    id = 'guest_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('crm_guest_id', id);
  }
  return id;
};

const SECTORES_CRM = ['LEAD FRIO', 'LEAD MORNO', 'LEAD QUENTE', 'EM ATENDIMENTO', 'FINALIZADO'] as const;

function PurchasesModal({ client, onClose }: { client: Cliente, onClose: () => void }) {
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSaving, setIsSaving] = useState(false);

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client.id || !valor) return;

    setIsSaving(true);
    try {
      const numValor = parseFloat(valor.replace(',', '.'));
      const newCompra = {
        id: Math.random().toString(36).substring(2, 11),
        data: Timestamp.fromDate(new Date(data + 'T12:00:00')),
        valor: numValor,
        descricao
      };

      const compras = client.compras ? [...client.compras, newCompra] : [newCompra];
      
      // Calculate total
      const total_gasto = compras.reduce((acc, curr) => acc + curr.valor, 0);
      
      // Find latest date
      const ultima_compra = compras.reduce((latest, curr) => {
        return curr.data.toMillis() > latest.toMillis() ? curr.data : latest;
      }, compras[0].data);

      await updateDoc(doc(db, 'clientes', client.id), {
        compras,
        total_gasto,
        ultima_compra
      });

      setValor('');
      setDescricao('');
      setData(format(new Date(), 'yyyy-MM-dd'));
    } catch (error) {
      console.error('Erro ao adicionar compra:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePurchase = async (compraId: string) => {
    if (!client.id || !client.compras) return;
    if (!window.confirm('Excluir esta compra?')) return;

    try {
      const compras = client.compras.filter(c => c.id !== compraId);
      const total_gasto = compras.reduce((acc, curr) => acc + curr.valor, 0);
      const ultima_compra = compras.length > 0 
        ? compras.reduce((latest, curr) => curr.data.toMillis() > latest.toMillis() ? curr.data : latest, compras[0].data)
        : null;

      await updateDoc(doc(db, 'clientes', client.id), {
        compras,
        total_gasto,
        ultima_compra
      });
    } catch (error) {
      console.error('Erro ao excluir compra:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-brand-rose/10 flex items-center justify-between bg-brand-blush/30">
          <div>
            <h2 className="text-2xl font-display font-bold text-brand-rose">Compras - {client.nome}</h2>
            <p className="text-sm text-brand-rose/60">
              Total Gasto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.total_gasto || 0)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-brand-rose/40 hover:text-brand-rose">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8">
          {/* Form */}
          <div className="flex-1">
            <h3 className="font-bold text-brand-rose mb-4 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-brand-gold" /> Nova Compra
            </h3>
            <form onSubmit={handleAddPurchase} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-brand-rose/60 uppercase tracking-wider mb-1">Data</label>
                <input
                  type="date"
                  required
                  value={data}
                  onChange={e => setData(e.target.value)}
                  className="w-full bg-brand-rose/5 border border-brand-rose/10 rounded-xl px-4 py-3 text-brand-rose focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-rose/60 uppercase tracking-wider mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-brand-rose/5 border border-brand-rose/10 rounded-xl px-4 py-3 text-brand-rose focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-rose/60 uppercase tracking-wider mb-1">Descrição / Itens</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Ex: 2 Vestidos M"
                  className="w-full bg-brand-rose/5 border border-brand-rose/10 rounded-xl px-4 py-3 text-brand-rose focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full gold-button font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Adicionar Compra'}
              </button>
            </form>
          </div>

          {/* List */}
          <div className="flex-1 border-t md:border-t-0 md:border-l border-brand-rose/10 pt-6 md:pt-0 md:pl-6">
            <h3 className="font-bold text-brand-rose mb-4 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-brand-gold" /> Histórico
            </h3>
            <div className="space-y-3">
              {client.compras && client.compras.length > 0 ? (
                [...client.compras].sort((a, b) => b.data.toMillis() - a.data.toMillis()).map(compra => (
                  <div key={compra.id} className="bg-white border border-brand-rose/10 p-3 rounded-xl flex items-center justify-between group hover:border-brand-gold/50 transition-colors">
                    <div>
                      <p className="font-bold text-brand-rose text-sm">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(compra.valor)}
                      </p>
                      <p className="text-xs text-brand-rose/60">
                        {format(compra.data.toDate(), 'dd/MM/yyyy')} {compra.descricao && `- ${compra.descricao}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeletePurchase(compra.id)}
                      className="text-brand-rose/20 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-brand-rose/40 text-center py-8">Nenhuma compra registrada.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ client, onOpenPurchases }: { client: Cliente, onOpenPurchases: (client: Cliente) => void, key?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: client.id! });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-xl shadow-sm border border-brand-rose/5 mb-3 cursor-grab active:cursor-grabbing hover:border-brand-gold transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-brand-rose text-sm leading-tight">{client.nome}</h4>
        <span className="text-[10px] bg-brand-gold/10 text-brand-gold px-2 py-0.5 rounded-full font-bold">
          {client.tamanho}
        </span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-brand-rose/60 text-[10px]">
          <Phone className="w-3 h-3" />
          {client.telefone}
        </div>
        <div className="flex items-center gap-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onOpenPurchases(client);
            }}
            className="p-1.5 bg-brand-gold text-white rounded-full hover:bg-brand-gold-light transition-colors shadow-sm"
            title="Gerenciar Compras"
          >
            <ShoppingBag className="w-3 h-3" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const cleaned = client.telefone.replace(/\D/g, '');
              const waNumber = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
              window.open(`https://wa.me/${waNumber}`, '_blank');
            }}
            className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors shadow-sm"
            title="Chamar no WhatsApp"
          >
            <MessageCircle className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      {(client.total_gasto !== undefined && client.total_gasto > 0) && (
        <div className="mb-2 text-[10px] font-bold text-brand-rose/80 bg-brand-rose/5 p-1.5 rounded-lg flex justify-between items-center">
          <span>Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.total_gasto)}</span>
          {client.ultima_compra && (
            <span className="text-brand-rose/50">{format(client.ultima_compra.toDate(), 'dd/MM/yy')}</span>
          )}
        </div>
      )}
      {client.comprou && (
        <div className="flex flex-wrap gap-1">
          {client.comprou.split(', ').slice(0, 2).map((p, i) => (
            <span key={i} className="text-[9px] bg-brand-rose/5 text-brand-rose/70 px-1.5 py-0.5 rounded-md">
              {p}
            </span>
          ))}
          {client.comprou.split(', ').length > 2 && (
            <span className="text-[9px] text-brand-rose/40">+{client.comprou.split(', ').length - 2}</span>
          )}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ status, clients, onOpenPurchases }: { status: string, clients: Cliente[], onOpenPurchases: (client: Cliente) => void, key?: string }) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div className="flex-1 min-w-[280px] bg-brand-rose/5 rounded-2xl p-4 flex flex-col h-full max-h-[70vh]">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="font-display font-bold text-brand-rose text-sm tracking-wider uppercase">
          {status}
        </h3>
        <span className="bg-brand-rose/10 text-brand-rose text-[10px] px-2 py-0.5 rounded-full font-bold">
          {clients.length}
        </span>
      </div>
      <div ref={setNodeRef} className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-[200px]">
        <SortableContext items={clients.map(c => c.id!)} strategy={verticalListSortingStrategy}>
          {clients.map(client => (
            <KanbanCard key={client.id} client={client} onOpenPurchases={onOpenPurchases} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSize, setSearchSize] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [loginBlocked, setLoginBlocked] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [purchasesModalClient, setPurchasesModalClient] = useState<Cliente | null>(null);

  // Helper function to extract info from text
  const extractInfoFromText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let foundName = '';
    let foundPhone = '';
    let foundSize = '';
    let foundCity = '';
    let foundProducts: string[] = [];
    let foundChannel = '';
    let foundObs = '';

    // Phone Regex - improved to catch more variations
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/g;
    const phones = text.match(phoneRegex);
    if (phones && phones.length > 0) foundPhone = phones[0];

    // Track which lines were "consumed" by specific field detection
    const consumedLines = new Set<number>();

    // 1. First pass: Explicit labels and specific patterns (Phone, Size, Channel)
    lines.forEach((line, index) => {
      const lowerLine = line.toLowerCase();
      
      // Explicit Labels
      if (lowerLine.startsWith('nome:') || lowerLine.startsWith('cliente:')) {
        foundName = line.split(/nome:|cliente:/i).pop()?.trim() || '';
        consumedLines.add(index);
      } 
      else if (lowerLine.match(/tel:|fone:|whatsapp:|cel:|contato:/i)) {
        const p = line.match(phoneRegex);
        if (p) foundPhone = p[0];
        else {
          const afterLabel = line.split(/tel:|fone:|whatsapp:|cel:|contato:/i).pop()?.trim();
          if (afterLabel && afterLabel.length > 7) foundPhone = afterLabel;
        }
        consumedLines.add(index);
      }
      else if (lowerLine.includes('cidade:') || lowerLine.includes('moro em') || lowerLine.includes('local:') || lowerLine.includes('endereço:') || lowerLine.includes('uf:') || lowerLine.includes('reside em')) {
        foundCity = line.split(/cidade:|moro em|local:|endereço:|uf:|reside em/i).pop()?.trim() || '';
        consumedLines.add(index);
      }
      else if (lowerLine.includes('canal:') || lowerLine.includes('veio pelo') || lowerLine.includes('origem:') || lowerLine.includes('veio do') || lowerLine.includes('conheceu por')) {
        const channelVal = line.split(/canal:|veio pelo|origem:|veio do|conheceu por/i).pop()?.trim();
        const match = ['Loja Física', 'WhatsApp', 'Instagram', 'Facebook', 'Site', 'Indicação'].find(c => 
          channelVal?.toLowerCase().includes(c.toLowerCase())
        );
        if (match) foundChannel = match;
        consumedLines.add(index);
      }
      else if (lowerLine.includes('obs:') || lowerLine.includes('observação:') || lowerLine.includes('nota:') || lowerLine.includes('detalhes:') || lowerLine.includes('comentário:')) {
        foundObs = line.split(/obs:|observação:|nota:|detalhes:|comentário:/i).pop()?.trim() || '';
        consumedLines.add(index);
      }

      // Size detection (even without label)
      TAMANHOS.forEach(t => {
        const tLower = t.toLowerCase();
        // Match exact size or size with common prefixes
        if (lowerLine === tLower || 
            lowerLine === `tamanho ${tLower}` || 
            lowerLine === `tam ${tLower}` ||
            lowerLine === `tam: ${tLower}` ||
            lowerLine === `veste ${tLower}` ||
            lowerLine === `tamanho: ${tLower}`) {
          foundSize = t;
          consumedLines.add(index);
        }
      });
    });

    // 2. Second pass: Keywords (Products) and Cities with UF pattern
    lines.forEach((line, index) => {
      if (consumedLines.has(index)) return;
      const lowerLine = line.toLowerCase();

      // Products - improved matching (singular/plural and partial)
      let foundProductInLine = false;
      INTERESSES.forEach(p => {
        const pLower = p.toLowerCase();
        const pSingular = pLower.endsWith('s') ? pLower.slice(0, -1) : pLower;
        
        if (lowerLine.includes(pLower) || (pSingular.length > 3 && lowerLine.includes(pSingular))) {
          if (!foundProducts.includes(p)) foundProducts.push(p);
          foundProductInLine = true;
        }
      });
      if (foundProductInLine) consumedLines.add(index);

      // City with UF pattern (e.g. "São Paulo - SP" or "Rio / RJ")
      if (!foundCity && lowerLine.match(/[-/]\s*[a-z]{2}$/i)) {
        foundCity = line;
        consumedLines.add(index);
      }

      // Size if not found yet
      if (!foundSize) {
        TAMANHOS.forEach(t => {
          const tLower = t.toLowerCase();
          if (lowerLine.includes(`tamanho ${tLower}`) || 
              lowerLine.includes(`tam ${tLower}`) ||
              lowerLine.includes(`veste ${tLower}`)) {
            foundSize = t;
            consumedLines.add(index);
          }
        });
      }
    });

    // 3. Third pass: Name and City detection (the remaining unidentified lines)
    const remainingLines = lines.map((l, i) => ({ text: l, index: i })).filter(item => !consumedLines.has(item.index));
    
    if (remainingLines.length > 0) {
      // If we don't have a name yet, take the first remaining line as name
      if (!foundName) {
        const nameCandidate = remainingLines[0];
        if (nameCandidate.text.length > 2 && nameCandidate.text.length < 50 && !nameCandidate.text.match(phoneRegex)) {
          foundName = nameCandidate.text;
          consumedLines.add(nameCandidate.index);
          remainingLines.shift(); // Remove it from remaining
        }
      }
      
      // If we don't have a city yet, and there's another line, it might be the city
      if (!foundCity && remainingLines.length > 0) {
        const cityCandidate = remainingLines[0];
        // If it's not too long and doesn't look like a sentence
        if (cityCandidate.text.length < 40 && !cityCandidate.text.includes('.')) {
          foundCity = cityCandidate.text;
          consumedLines.add(cityCandidate.index);
        }
      }
    }

    return { foundName, foundPhone, foundSize, foundCity, foundProducts, foundChannel, foundObs };
  };

  // Live extraction effect
  useEffect(() => {
    if (!isImporting || !importText.trim()) return;

    const timeoutId = setTimeout(() => {
      const { foundName, foundPhone, foundSize, foundCity, foundProducts, foundChannel, foundObs } = extractInfoFromText(importText);

      if (foundName || foundPhone || foundSize || foundCity || foundProducts.length > 0 || foundChannel || foundObs) {
        setFormData(prev => ({
          ...prev,
          nome: foundName || prev.nome,
          telefone: foundPhone || prev.telefone,
          tamanho: foundSize || prev.tamanho,
          cidade: foundCity || prev.cidade,
          comprou: foundProducts.length > 0 ? foundProducts.join(', ') : prev.comprou,
          queria_comprar: foundObs || prev.queria_comprar,
          canal: foundChannel || prev.canal
        }));
      }
    }, 400); // Debounce 400ms

    return () => clearTimeout(timeoutId);
  }, [importText, isImporting]);

  const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG'];
  const INTERESSES = ['Regatas', 'Blusas', 'Camisa', 'Vestidos', 'Macaquinhos', 'Conjuntos', 'Saias', 'Calça Formal', 'Calça Jeans'];

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    tamanho: '',
    cidade: '',
    comprou: '',
    queria_comprar: '',
    canal: ''
  });

  useEffect(() => {
    // Safety timeout: if auth hasn't resolved in 6 seconds, stop loading
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 6000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? `User ${user.uid} (${user.isAnonymous ? 'Anonymous' : 'Google'})` : 'No user');
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
      clearTimeout(timeoutId);
    });
    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const effectiveUid = user?.uid || getGuestId();
    
    const q = query(
      collection(db, 'clientes'),
      where('uid', '==', effectiveUid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Cliente[];
      
      // Sort client-side by posicao (if exists) and then created_at desc
      const sortedClients = clientsData.sort((a, b) => {
        if (a.posicao !== undefined && b.posicao !== undefined) {
          return a.posicao - b.posicao;
        }
        if (a.posicao !== undefined) return -1;
        if (b.posicao !== undefined) return 1;
        return b.created_at.toMillis() - a.created_at.toMillis();
      });
      
      setClients(sortedClients);
    }, (error: any) => {
      console.error('Erro ao carregar lista:', error);
      if (error.message?.includes('index')) {
        setFeedback({ type: 'error', message: 'Erro de configuração: O banco de dados precisa de um índice. Tente novamente em alguns minutos.' });
      } else {
        setFeedback({ type: 'error', message: 'Erro ao carregar a lista de clientes.' });
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    const isIframe = window !== window.top;
    
    if (isIframe) {
      setLoginBlocked(true);
      return;
    }

    try {
      const guestId = localStorage.getItem('crm_guest_id');
      
      const result = await signInWithPopup(auth, googleProvider);
      const finalUser = result.user;

      // Migrate any guestId data
      if (finalUser && guestId && finalUser.uid !== guestId) {
        try {
          const q = query(collection(db, 'clientes'), where('uid', '==', guestId));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const updates = snapshot.docs.map(docSnapshot => 
              updateDoc(doc(db, 'clientes', docSnapshot.id), { uid: finalUser.uid })
            );
            await Promise.all(updates);
          }
        } catch (migrationError) {
          console.error('Error migrating guest data:', migrationError);
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.code === 'auth/popup-blocked') {
        setLoginBlocked(true);
      } else {
        setFeedback({ type: 'error', message: 'Erro ao fazer login. Tente novamente.' });
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const effectiveUid = user?.uid || getGuestId();
      
      if (editingClient?.id) {
        // Update existing client
        const updatedClient = {
          ...formData,
          uid: effectiveUid
        };
        await updateDoc(doc(db, 'clientes', editingClient.id), updatedClient);
        setFeedback({ type: 'success', message: 'Cadastro atualizado com sucesso!' });
      } else {
        // Create new client
        const newClient: Omit<Cliente, 'id'> = {
          ...formData,
          comprou_status: 'nao',
          status_crm: 'LEAD FRIO',
          created_at: Timestamp.now(),
          uid: effectiveUid
        };
        await addDoc(collection(db, 'clientes'), newClient);
        setFeedback({ type: 'success', message: 'Cadastro realizado com sucesso!' });
      }
      
      setFormData({
        nome: '',
        telefone: '',
        tamanho: '',
        cidade: '',
        comprou: '',
        queria_comprar: '',
        canal: ''
      });
      setEditingClient(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => setFeedback(null), 3000);
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      let message = 'Erro ao salvar o cadastro. Verifique sua conexão.';
      
      if (error.message?.includes('permission-denied')) {
        message = 'Erro de permissão. Tente entrar novamente.';
      } else if (error.message?.includes('quota-exceeded')) {
        message = 'Limite de uso do banco de dados atingido.';
      }
      
      setFeedback({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (client: Cliente) => {
    setEditingClient(client);
    setFormData({
      nome: client.nome,
      telefone: client.telefone,
      tamanho: client.tamanho || '',
      cidade: client.cidade || '',
      comprou: client.comprou || '',
      queria_comprar: client.queria_comprar || '',
      canal: client.canal || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingClient(null);
    setFormData({
      nome: '',
      telefone: '',
      tamanho: '',
      cidade: '',
      comprou: '',
      queria_comprar: '',
      canal: ''
    });
  };

  const handleSmartImport = () => {
    if (!importText.trim()) return;

    const { foundName, foundPhone, foundSize, foundCity, foundProducts, foundChannel, foundObs } = extractInfoFromText(importText);

    setFormData(prev => ({
      ...prev,
      nome: foundName || prev.nome,
      telefone: foundPhone || prev.telefone,
      tamanho: foundSize || prev.tamanho,
      cidade: foundCity || prev.cidade,
      comprou: foundProducts.length > 0 ? foundProducts.join(', ') : prev.comprou,
      queria_comprar: foundObs || prev.queria_comprar,
      canal: foundChannel || prev.canal
    }));

    setImportText('');
    setIsImporting(false);
    setFeedback({ type: 'success', message: 'Importação finalizada com sucesso!' });
    setTimeout(() => setFeedback(null), 2000);
  };

  const handlePasteAndExtract = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setImportText(text);
        const { foundName, foundPhone, foundSize, foundCity, foundProducts, foundChannel, foundObs } = extractInfoFromText(text);
        
        setFormData(prev => ({ 
          ...prev, 
          nome: foundName || prev.nome, 
          telefone: foundPhone || prev.telefone, 
          tamanho: foundSize || prev.tamanho, 
          cidade: foundCity || prev.cidade, 
          comprou: foundProducts.length > 0 ? foundProducts.join(', ') : prev.comprou, 
          queria_comprar: foundObs || prev.queria_comprar, 
          canal: foundChannel || prev.canal 
        }));
        
        setFeedback({ type: 'success', message: 'Dados colados e identificados!' });
        setTimeout(() => setFeedback(null), 2000);
      }
    } catch (err) {
      console.error('Falha ao ler área de transferência:', err);
      setFeedback({ type: 'error', message: 'Permita o acesso à área de transferência para colar automaticamente.' });
    }
  };

  const toggleStatus = async (client: Cliente) => {
    if (!client.id) return;
    try {
      const newStatus = client.comprou_status === 'sim' ? 'nao' : 'sim';
      await updateDoc(doc(db, 'clientes', client.id), {
        comprou_status: newStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clientes/${client.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta cliente?')) return;
    try {
      await deleteDoc(doc(db, 'clientes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `clientes/${id}`);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const clientId = active.id as string;
    const overId = over.id as string;

    // Resolve new status
    let newStatus: Cliente['status_crm'];
    
    // Check if dropped over a column (status)
    const isStatus = SECTORES_CRM.includes(overId as any);
    
    if (isStatus) {
      newStatus = overId as Cliente['status_crm'];
    } else {
      // Dropped over a card, find that card's status
      const overClient = clients.find(c => c.id === overId);
      if (overClient) {
        newStatus = overClient.status_crm || 'LEAD FRIO';
      } else {
        return;
      }
    }

    const activeClient = clients.find(c => c.id === clientId);
    if (!activeClient) return;

    const oldStatus = activeClient.status_crm || 'LEAD FRIO';

    if (oldStatus !== newStatus) {
      // Move to another column
      try {
        await updateDoc(doc(db, 'clientes', clientId), {
          status_crm: newStatus
        });
      } catch (error) {
        console.error('Erro ao atualizar status CRM:', error);
      }
    } else if (active.id !== over.id) {
      // Reorder within the same column
      const columnClients = clients.filter(c => (c.status_crm || 'LEAD FRIO') === newStatus);
      const oldIndex = columnClients.findIndex(c => c.id === active.id);
      const newIndex = columnClients.findIndex(c => c.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newColumnClients = arrayMove(columnClients, oldIndex, newIndex) as Cliente[];
        
        // Update all positions in this column locally first for immediate feedback
        setClients((prev: Cliente[]) => {
          const otherClients = prev.filter(c => (c.status_crm || 'LEAD FRIO') !== newStatus);
          const updatedColumnClients = newColumnClients.map((c: Cliente, i: number) => ({ ...c, posicao: i }));
          return [...otherClients, ...updatedColumnClients].sort((a, b) => {
            if (a.posicao !== undefined && b.posicao !== undefined) return a.posicao - b.posicao;
            if (a.posicao !== undefined) return -1;
            if (b.posicao !== undefined) return 1;
            return b.created_at.toMillis() - a.created_at.toMillis();
          });
        });

        // Update in Firebase
        try {
          const updates = newColumnClients.map((c: Cliente, index: number) => {
            if (c.id) {
              return updateDoc(doc(db, 'clientes', c.id), { posicao: index });
            }
            return Promise.resolve();
          });
          await Promise.all(updates);
        } catch (error) {
          console.error('Erro ao reordenar clientes:', error);
        }
      }
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchText = c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        c.telefone.includes(searchTerm) ||
                        (c.comprou && c.comprou.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        (c.queria_comprar && c.queria_comprar.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchSize = !searchSize || (c.tamanho && c.tamanho.toLowerCase().includes(searchSize.toLowerCase()));
      const matchCity = !searchCity || (c.cidade && c.cidade.toLowerCase().includes(searchCity.toLowerCase()));
      return matchText && matchSize && matchCity;
    });
  }, [clients, searchTerm, searchSize, searchCity]);

  const exportPDF = async () => {
    const doc = new jsPDF();
    const today = format(new Date(), 'dd/MM/yyyy');
    
    doc.setFontSize(20);
    doc.setTextColor(142, 93, 90); // #8E5D5A (Brand Rose)
    doc.text('CRM - GESTÃO DE CLIENTES', 35, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(197, 160, 89); // #C5A059 (Brand Gold)
    doc.text(`Relatório gerado em: ${today}`, 35, 27);

    const tableData = filteredClients.map(c => [
      c.nome,
      c.telefone,
      c.tamanho || '-',
      c.cidade || '-',
      c.comprou || '-',
      c.canal,
      c.comprou_status === 'sim' ? 'Sim' : 'Não',
      format(c.created_at.toDate(), 'dd/MM/yyyy')
    ]);

    autoTable(doc, {
      head: [['Nome', 'Telefone', 'Tam', 'Cidade', 'Interesse', 'Canal', 'Status', 'Data']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [142, 93, 90] }, // #8E5D5A (Brand Rose)
    });

    doc.save(`crm_clientes_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const generateReportPDF = async () => {
    const doc = new jsPDF();
    const today = format(new Date(), 'dd/MM/yyyy');
    
    doc.setFontSize(20);
    doc.setTextColor(142, 93, 90);
    doc.text('RELATÓRIO ANALÍTICO - CRM', 35, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(197, 160, 89);
    doc.text(`Análise de Performance gerada em: ${today}`, 35, 27);

    // Data processing
    const cityCounts: Record<string, number> = {};
    const channelCounts: Record<string, number> = {};
    
    clients.forEach(c => {
      const city = c.cidade || 'Não Informada';
      cityCounts[city] = (cityCounts[city] || 0) + 1;
      
      const channel = c.canal || 'Não Informado';
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    });

    // Draw City Chart
    doc.setFontSize(16);
    doc.setTextColor(142, 93, 90);
    doc.text('Distribuição por Cidade', 15, 45);
    
    let y = 55;
    const maxBarWidth = 100;
    const cityEntries = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const maxCityCount = Math.max(...cityEntries.map(e => e[1]), 1);
    
    cityEntries.forEach(([city, count]) => {
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`${city.substring(0, 20)}: ${count}`, 15, y + 5);
      
      const barWidth = (count / maxCityCount) * maxBarWidth;
      doc.setFillColor(197, 160, 89); // Gold
      doc.rect(60, y, barWidth, 6, 'F');
      y += 10;
    });

    // Draw Channel Chart
    y += 15;
    if (y > 250) { doc.addPage(); y = 20; }
    
    doc.setFontSize(16);
    doc.setTextColor(142, 93, 90);
    doc.text('Canais de Aquisição', 15, y);
    y += 10;
    
    const channelEntries = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]);
    const maxChannelCount = Math.max(...channelEntries.map(e => e[1]), 1);
    
    channelEntries.forEach(([channel, count]) => {
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`${channel}: ${count}`, 15, y + 5);
      
      const barWidth = (count / maxChannelCount) * maxBarWidth;
      doc.setFillColor(142, 93, 90); // Rose
      doc.rect(60, y, barWidth, 6, 'F');
      y += 10;
    });

    // Summary Table
    y += 15;
    if (y > 220) { doc.addPage(); y = 20; }
    
    doc.setFontSize(14);
    doc.setTextColor(142, 93, 90);
    doc.text('Resumo Geral', 15, y);
    
    const totalClients = clients.length;
    const completedSales = clients.filter(c => c.comprou_status === 'sim').length;
    const conversionRate = totalClients > 0 ? ((completedSales / totalClients) * 100).toFixed(1) : '0';

    autoTable(doc, {
      head: [['Métrica', 'Valor']],
      body: [
        ['Total de Clientes', totalClients.toString()],
        ['Vendas Finalizadas', completedSales.toString()],
        ['Taxa de Conversão', `${conversionRate}%`],
      ],
      startY: y + 5,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [197, 160, 89] },
    });

    doc.save(`relatorio_crm_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-blush">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-brand-gold animate-spin mx-auto mb-4" />
          <p className="text-brand-rose font-display text-3xl font-bold tracking-widest uppercase mb-2">CRM</p>
          <p className="text-brand-rose/60 text-sm mt-2">Carregando sua boutique...</p>
        </div>
      </div>
    );
  }

  // Removed the login gate as requested by user.
  // The app now auto-logs in anonymously if no user is present.

  return (
    <div className="min-h-screen gradient-boutique pb-20 font-body">
      <header className="glass-effect sticky top-0 z-50 px-6 py-4 border-b border-white/30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <h1 className="font-display text-2xl font-extrabold text-brand-rose tracking-[0.2em] uppercase leading-none">CRM</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-white/50 rounded-full border border-white/30">
              <div className={`w-2 h-2 rounded-full ${user ? (user.isAnonymous ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-brand-rose/20'}`}></div>
              <span className="text-[10px] font-bold text-brand-rose uppercase tracking-wider">
                {user ? (user.isAnonymous ? 'Modo Visitante' : 'Sincronizado') : 'Modo Local'}
              </span>
            </div>
            {user && !user.isAnonymous && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-brand-rose">{user.displayName}</span>
                <span className="text-xs text-brand-rose/40">{user.email}</span>
              </div>
            )}
            {user && !user.isAnonymous ? (
              <button 
                onClick={handleLogout}
                className="p-2 text-brand-rose/40 hover:text-red-600 transition-colors"
                title="Sair"
              >
                <LogOut className="w-6 h-6" />
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 text-sm font-semibold text-brand-gold hover:text-brand-gold-light transition-colors"
              >
                <LogIn className="w-5 h-5" />
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Auth Block Warning */}
        {loginBlocked && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-red-50 rounded-2xl border border-red-200 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
            <div className="flex items-start gap-4">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-red-800 text-lg mb-1">Ação Necessária para Login</h3>
                <p className="text-red-700 text-sm mb-4">
                  O navegador bloqueou a janela de login porque o aplicativo está sendo visualizado dentro de outra plataforma. 
                  Para fazer login com segurança, você precisa abrir o aplicativo em uma nova aba.
                </p>
                <a 
                  href={window.location.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl shadow-sm transition-colors inline-flex items-center gap-2 mt-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir no Navegador Agora
                </a>
              </div>
              <button 
                onClick={() => setLoginBlocked(false)}
                className="text-red-400 hover:text-red-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Title Section */}
        <div className="text-center mb-10">
          <motion.h2 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="font-display text-4xl font-extrabold text-brand-rose mb-2 tracking-tight"
          >
            GESTÃO DE CLIENTES
          </motion.h2>
          <p className="text-brand-rose/60 text-lg italic font-display">Acompanhamento & CRM</p>
          <div className="w-20 h-1 bg-brand-gold mx-auto mt-4 rounded-full"></div>
        </div>

        {/* Form Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-3xl shadow-xl p-8 mb-12 border border-white/50"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-display text-3xl font-bold text-brand-rose flex items-center gap-3 tracking-tight">
              {editingClient ? <Edit2 className="w-7 h-7 text-brand-gold" /> : <PlusCircle className="w-7 h-7 text-brand-gold" />}
              {editingClient ? 'Editar Cadastro' : 'Novo Cadastro'}
            </h3>
            <div className="flex items-center gap-2">
              {!editingClient && (
                <button 
                  onClick={() => setIsImporting(!isImporting)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all border border-emerald-100"
                >
                  <Clipboard className="w-4 h-4" /> 
                  {isImporting ? 'Cancelar' : 'Importar do WhatsApp'}
                </button>
              )}
              {editingClient && (
                <button 
                  onClick={cancelEdit}
                  className="p-2 text-brand-rose/40 hover:text-brand-rose transition-colors"
                  title="Cancelar Edição"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>

          {isImporting && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-8 p-6 bg-emerald-50/50 rounded-2xl border-2 border-dashed border-emerald-200"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Cole ou escreva as informações do cliente:
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setImportText('')}
                    className="flex items-center gap-1 text-[10px] font-bold bg-white text-emerald-600 px-3 py-1 rounded-lg hover:bg-emerald-50 transition-all border border-emerald-200"
                  >
                    Limpar
                  </button>
                  <button 
                    onClick={handlePasteAndExtract}
                    className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500 text-white px-3 py-1 rounded-lg hover:bg-emerald-600 transition-all shadow-sm"
                  >
                    <Download className="w-3 h-3" /> Colar e Extrair
                  </button>
                </div>
              </div>
              <textarea 
                value={importText}
                onChange={e => setImportText(e.target.value)}
                className="w-full h-32 p-4 rounded-xl border border-emerald-200 focus:border-emerald-500 outline-none bg-white text-sm mb-4"
                placeholder="Ex: Maria Silva&#10;Tel: 11 99999-9999&#10;Cidade: São Paulo&#10;Tamanho: M&#10;Interesse: Vestidos, Saias"
              />
              <button 
                onClick={() => {
                  handleSmartImport();
                  setFeedback({ type: 'success', message: 'Importação finalizada!' });
                }}
                className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Finalizar e Fechar Importador
              </button>
              <p className="text-[10px] text-emerald-600/60 mt-2 text-center">
                O sistema identifica automaticamente: Nome, Telefone, Cidade, Tamanho, Produtos e Observações.
              </p>
            </motion.div>
          )}

          {feedback && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
              }`}
            >
              {feedback.type === 'success' ? <Sparkles className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              <p className="text-sm font-bold">{feedback.message}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-rose flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-gold" /> Nome Completo
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.nome}
                  onChange={e => setFormData({...formData, nome: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-rose/10 focus:border-brand-gold outline-none transition-all bg-white/50"
                  placeholder="Ex: Maria Silva"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-rose flex items-center gap-2">
                  <Phone className="w-4 h-4 text-brand-gold" /> Telefone / WhatsApp
                </label>
                <input 
                  type="tel" 
                  required
                  value={formData.telefone}
                  onChange={e => setFormData({...formData, telefone: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-rose/10 focus:border-brand-gold outline-none transition-all bg-white/50"
                  placeholder="Ex: (11) 99999-9999"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-rose flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-brand-gold" /> Tamanho / Referência
                </label>
                <div className="flex flex-wrap gap-2">
                  {TAMANHOS.map(tam => (
                    <button
                      key={tam}
                      type="button"
                      onClick={() => setFormData({...formData, tamanho: tam})}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                        formData.tamanho === tam 
                          ? 'gold-button border-transparent' 
                          : 'bg-white/50 border-brand-rose/10 text-brand-rose/60 hover:border-brand-gold'
                      }`}
                    >
                      {tam}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-rose flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-gold" /> Cidade / UF
                </label>
                <input 
                  type="text" 
                  value={formData.cidade}
                  onChange={e => setFormData({...formData, cidade: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-rose/10 focus:border-brand-gold outline-none transition-all bg-white/50"
                  placeholder="Ex: São Paulo - SP"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-rose flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-brand-gold" /> Produtos de Interesse (Selecione vários)
                </label>
                <div className="flex flex-wrap gap-2">
                  {INTERESSES.map(int => {
                    const isSelected = formData.comprou.split(', ').includes(int);
                    return (
                      <button
                        key={int}
                        type="button"
                        onClick={() => {
                          let current = formData.comprou ? formData.comprou.split(', ') : [];
                          if (isSelected) {
                            current = current.filter(item => item !== int);
                          } else {
                            current.push(int);
                          }
                          setFormData({...formData, comprou: current.join(', ')});
                        }}
                        className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border uppercase tracking-wider ${
                          isSelected 
                            ? 'gold-button border-transparent' 
                            : 'bg-white/50 border-brand-rose/10 text-brand-rose/60 hover:border-brand-gold'
                        }`}
                      >
                        {int}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-rose flex items-center gap-2">
                  <Heart className="w-4 h-4 text-brand-gold" /> Observações
                </label>
                <input 
                  type="text" 
                  value={formData.queria_comprar}
                  onChange={e => setFormData({...formData, queria_comprar: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-brand-rose/10 focus:border-brand-gold outline-none transition-all bg-white/50"
                  placeholder="Detalhes adicionais"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-brand-rose flex items-center gap-2">
                📢 Canal de Aquisição
              </label>
              <select 
                required
                value={formData.canal}
                onChange={e => setFormData({...formData, canal: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-brand-rose/10 focus:border-brand-gold outline-none transition-all bg-white/50"
              >
                <option value="">Selecione o canal</option>
                <option value="Loja Física">🏪 Loja Física</option>
                <option value="WhatsApp">📱 WhatsApp</option>
                <option value="Instagram">📸 Instagram</option>
                <option value="Facebook">👤 Facebook</option>
                <option value="Site">💻 Site</option>
                <option value="Indicação">👥 Indicação</option>
                <option value="Outro">📌 Outro</option>
              </select>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full gold-button font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingClient ? <Edit2 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />)}
              {editingClient ? 'Atualizar Cadastro' : 'Salvar Cadastro'}
            </button>
          </form>
        </motion.div>

        {/* Filters & Actions */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-display font-bold text-brand-rose flex items-center gap-2">
              {viewMode === 'list' ? <Users className="w-6 h-6 text-brand-gold" /> : <LayoutDashboard className="w-6 h-6 text-brand-gold" />}
              {viewMode === 'list' ? 'Lista de Clientes' : 'Quadro Kanban CRM'}
            </h3>
            <div className="flex bg-white/50 p-1 rounded-xl border border-brand-rose/10 shadow-sm">
              <button 
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  viewMode === 'list' 
                    ? 'gold-button shadow-md' 
                    : 'text-brand-rose/40 hover:text-brand-rose'
                }`}
              >
                <List className="w-4 h-4" /> Lista
              </button>
              <button 
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  viewMode === 'kanban' 
                    ? 'gold-button shadow-md' 
                    : 'text-brand-rose/40 hover:text-brand-rose'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" /> Kanban
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gold" />
              <input 
                type="text" 
                placeholder="Buscar por nome, telefone, interesse ou obs..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-brand-rose/10 focus:border-brand-gold outline-none transition-all bg-white/50"
              />
            </div>
            <div className="w-full sm:w-48 relative">
              <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gold" />
              <input 
                type="text" 
                placeholder="Tamanho..."
                value={searchSize}
                onChange={e => setSearchSize(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-brand-rose/10 focus:border-brand-gold outline-none transition-all bg-white/50"
              />
            </div>
            <div className="w-full sm:w-48 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gold" />
              <input 
                type="text" 
                placeholder="Cidade..."
                value={searchCity}
                onChange={e => setSearchCity(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-brand-rose/10 focus:border-brand-gold outline-none transition-all bg-white/50"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="bg-white/50 rounded-xl px-4 py-2 shadow-sm border border-brand-rose/10">
              <span className="text-brand-rose/60 font-medium">Total: </span>
              <span className="text-brand-rose font-bold">{filteredClients.length}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={generateReportPDF}
                className="bg-white text-brand-rose border border-brand-gold/30 font-bold py-2 px-6 rounded-xl transition-all flex items-center gap-2 hover:bg-brand-blush"
              >
                <BarChart3 className="w-5 h-5 text-brand-gold" /> Relatório
              </button>
              <button 
                onClick={exportPDF}
                className="gold-button font-bold py-2 px-6 rounded-xl transition-all flex items-center gap-2"
              >
                <Download className="w-5 h-5" /> Exportar PDF
              </button>
            </div>
          </div>
        </div>

        {/* List Section */}
        <div className="space-y-4">
          {viewMode === 'kanban' ? (
            <div className="overflow-x-auto pb-6 -mx-4 px-4">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex gap-6 min-w-max">
                  {SECTORES_CRM.map((sector) => (
                    <KanbanColumn 
                      key={sector} 
                      status={sector}
                      clients={filteredClients.filter(c => (!c.status_crm && sector === 'LEAD FRIO') || c.status_crm === sector)}
                      onOpenPurchases={setPurchasesModalClient}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {activeId ? (
                    <div className="w-72 bg-white rounded-2xl shadow-2xl p-4 border-2 border-brand-gold opacity-90 scale-105">
                      <p className="font-bold text-brand-rose">{clients.find(c => c.id === activeId)?.nome}</p>
                      <p className="text-xs text-brand-rose/60">{clients.find(c => c.id === activeId)?.telefone}</p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                <motion.div 
                  key={client.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-sm p-6 border border-brand-gold/10 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-brand-blush rounded-full flex items-center justify-center text-brand-rose font-bold text-xl border border-brand-gold/20">
                          {client.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-display text-xl font-bold text-brand-rose">{client.nome}</h4>
                          <p className="text-brand-rose/60 flex items-center gap-1">
                            <Phone className="w-4 h-4 text-brand-gold" /> {client.telefone}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white/50 rounded-lg p-3 border border-brand-gold/10">
                          <p className="text-[10px] uppercase tracking-wider text-brand-rose/40 font-bold mb-1 flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3 text-brand-gold" /> Interesse
                          </p>
                          <p className="text-brand-rose text-sm font-medium">{client.comprou || '—'}</p>
                        </div>
                        <div className="bg-white/50 rounded-lg p-3 border border-brand-gold/10">
                          <p className="text-[10px] uppercase tracking-wider text-brand-rose/40 font-bold mb-1 flex items-center gap-1">
                            <Heart className="w-3 h-3 text-brand-gold" /> Obs
                          </p>
                          <p className="text-brand-rose text-sm font-medium">{client.queria_comprar || '—'}</p>
                        </div>
                        <div className="bg-white/50 rounded-lg p-3 border border-brand-gold/10">
                          <p className="text-[10px] uppercase tracking-wider text-brand-rose/40 font-bold mb-1">
                            📢 Canal
                          </p>
                          <p className="text-brand-rose text-sm font-medium">{client.canal}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-brand-rose/40 font-medium">
                        <span className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded-full border border-brand-gold/10">
                          <Ruler className="w-3 h-3 text-brand-gold" /> {client.tamanho || 'Tam: —'}
                        </span>
                        <span className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded-full border border-brand-gold/10">
                          <MapPin className="w-3 h-3 text-brand-gold" /> {client.cidade || 'Cidade: —'}
                        </span>
                        <span className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded-full border border-brand-gold/10">
                          <Calendar className="w-3 h-3 text-brand-gold" /> {format(client.created_at.toDate(), 'dd/MM/yyyy')}
                        </span>
                        {(client.total_gasto !== undefined && client.total_gasto > 0) && (
                          <span className="flex items-center gap-1 bg-brand-gold/10 text-brand-gold px-2 py-1 rounded-full border border-brand-gold/20 font-bold">
                            <ShoppingBag className="w-3 h-3" /> 
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.total_gasto)}
                            {client.ultima_compra && ` (Última: ${format(client.ultima_compra.toDate(), 'dd/MM/yy')})`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:w-40">
                      <button 
                        onClick={() => toggleStatus(client)}
                        className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${
                          client.comprou_status === 'sim' 
                            ? 'gold-button' 
                            : 'bg-white text-brand-rose/40 hover:bg-brand-blush'
                        }`}
                      >
                        {client.comprou_status === 'sim' ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        {client.comprou_status === 'sim' ? 'FINALIZADO' : 'EM ABERTO'}
                      </button>
                      
                      <button 
                        onClick={() => setPurchasesModalClient(client)}
                        className="w-full py-2 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border border-brand-gold/20"
                      >
                        <ShoppingBag className="w-4 h-4" /> Compras
                      </button>

                      <button 
                        onClick={() => handleEdit(client)}
                        className="w-full py-2 bg-white text-brand-rose/60 hover:text-brand-rose hover:bg-brand-blush rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border border-brand-rose/10"
                      >
                        <Edit2 className="w-4 h-4" /> Editar
                      </button>

                      <a 
                        href={`https://wa.me/${client.telefone.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border border-emerald-100"
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </a>

                      <button 
                        onClick={() => client.id && handleDelete(client.id)}
                        className="w-full py-2 text-brand-rose/20 hover:text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                      >
                        <Trash2 className="w-4 h-4" /> Excluir
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 bg-white/30 rounded-3xl border-2 border-dashed border-brand-gold/20"
              >
                <Users className="w-16 h-16 text-brand-gold/20 mx-auto mb-4" />
                <h3 className="font-display text-2xl font-bold text-brand-rose mb-2">Nenhum registro encontrado</h3>
                <p className="text-brand-rose/40">Comece cadastrando seu primeiro cliente acima.</p>
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </div>
      </main>

      {/* Purchases Modal */}
      {purchasesModalClient && (
        <PurchasesModal 
          client={purchasesModalClient} 
          onClose={() => setPurchasesModalClient(null)} 
        />
      )}

      {/* Limit Warning */}
      {clients.length >= 999 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-50">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 shadow-xl flex items-center gap-4">
            <AlertTriangle className="w-8 h-8 text-amber-500 flex-shrink-0" />
            <p className="text-amber-800 text-sm font-medium">
              Limite de 999 clientes atingido. Remova registros antigos para continuar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
