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
  User
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
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Cliente[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSize, setSearchSize] = useState('');
  const [searchCity, setSearchCity] = useState('');

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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setClients([]);
      return;
    }

    const q = query(
      collection(db, 'clientes'),
      where('uid', '==', user.uid),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Cliente[];
      setClients(clientsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clientes');
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
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
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newClient: Omit<Cliente, 'id'> = {
        ...formData,
        comprou_status: 'nao',
        created_at: Timestamp.now(),
        uid: user.uid
      };

      await addDoc(collection(db, 'clientes'), newClient);
      setFormData({
        nome: '',
        telefone: '',
        tamanho: '',
        cidade: '',
        comprou: '',
        queria_comprar: '',
        canal: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'clientes');
    } finally {
      setIsSubmitting(false);
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

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchName = c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        c.telefone.includes(searchTerm);
      const matchSize = !searchSize || (c.tamanho && c.tamanho.toLowerCase().includes(searchSize.toLowerCase()));
      const matchCity = !searchCity || (c.cidade && c.cidade.toLowerCase().includes(searchCity.toLowerCase()));
      return matchName && matchSize && matchCity;
    });
  }, [clients, searchTerm, searchSize, searchCity]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const today = format(new Date(), 'dd/MM/yyyy');
    
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138); // #1e3a8a (Blue 900)
    doc.text('CRM - GESTÃO DE CLIENTES', 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Relatório gerado em: ${today}`, 105, 22, { align: 'center' });

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

    (doc as any).autoTable({
      head: [['Nome', 'Telefone', 'Tam', 'Cidade', 'Comprou', 'Canal', 'Status', 'Data']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] }, // #2563eb (Blue 600)
    });

    doc.save(`crm_clientes_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center gradient-rose">
        <Loader2 className="w-12 h-12 text-rose-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50" />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-lg w-full border border-slate-200 relative z-10"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
            <Users className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-4xl font-bold mb-2 text-slate-900 tracking-tight">
            CRM Profissional
          </h1>
          <p className="text-slate-500 mb-8 text-lg">Sistema Inteligente de Gestão de Clientes</p>
          
          <div className="space-y-4 mb-10 text-left">
            <div className="flex items-center gap-3 text-slate-600">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <PlusCircle className="w-4 h-4 text-blue-600" />
              </div>
              <span>Cadastro rápido de leads e clientes</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-300" />
                <Search className="w-4 h-4 text-blue-600" />
              </div>
              <span>Busca avançada e filtros inteligentes</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Download className="w-4 h-4 text-blue-600" />
              </div>
              <span>Exportação de relatórios em PDF</span>
            </div>
          </div>

          <button 
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-100 transform hover:-translate-y-1"
          >
            <LogIn className="w-6 h-6" />
            Acessar Painel CRM
          </button>
          
          <p className="mt-6 text-xs text-slate-400">
            Ao entrar, você concorda com os termos de uso e privacidade.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-rose pb-20">
      <header className="bg-white sticky top-0 z-50 px-6 py-4 shadow-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-100">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">CRM Profissional</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-rose-900">{user.displayName}</span>
              <span className="text-xs text-rose-400">{user.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-rose-400 hover:text-rose-600 transition-colors"
              title="Sair"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Title Section */}
        <div className="text-center mb-10">
          <motion.h2 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-4xl font-bold text-slate-900 mb-2"
          >
            CADASTRO DE CLIENTES CRM
          </motion.h2>
          <p className="text-slate-500 text-lg">Gestão e Acompanhamento de Vendas</p>
          <div className="w-20 h-1.5 bg-blue-600 mx-auto mt-4 rounded-full"></div>
        </div>

        {/* Form Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-3xl shadow-xl p-8 mb-12 border-2 border-rose-100"
        >
          <h3 className="font-heading text-2xl font-semibold text-rose-800 mb-6 flex items-center gap-3 justify-center">
            <Sparkles className="w-6 h-6 text-rose-500" /> Nova Cliente <Sparkles className="w-6 h-6 text-rose-500" />
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-rose-700 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Nome da Cliente
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.nome}
                  onChange={e => setFormData({...formData, nome: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border-2 border-rose-100 focus:border-rose-400 outline-none transition-all bg-white/50"
                  placeholder="Ex: Maria Silva"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-rose-700 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Telefone
                </label>
                <input 
                  type="tel" 
                  required
                  value={formData.telefone}
                  onChange={e => setFormData({...formData, telefone: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border-2 border-rose-100 focus:border-rose-400 outline-none transition-all bg-white/50"
                  placeholder="Ex: (11) 99999-9999"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-rose-700 flex items-center gap-2">
                  <Ruler className="w-4 h-4" /> Tamanho
                </label>
                <select 
                  value={formData.tamanho}
                  onChange={e => setFormData({...formData, tamanho: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border-2 border-rose-100 focus:border-rose-400 outline-none transition-all bg-white/50"
                >
                  <option value="">Selecione o tamanho</option>
                  <option value="P">P - Pequeno</option>
                  <option value="M">M - Médio</option>
                  <option value="G">G - Grande</option>
                  <option value="GG">GG - Extra Grande</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-rose-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Cidade
                </label>
                <input 
                  type="text" 
                  value={formData.cidade}
                  onChange={e => setFormData({...formData, cidade: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border-2 border-rose-100 focus:border-rose-400 outline-none transition-all bg-white/50"
                  placeholder="Ex: São Paulo"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-rose-700 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" /> O que comprou
                </label>
                <input 
                  type="text" 
                  value={formData.comprou}
                  onChange={e => setFormData({...formData, comprou: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border-2 border-rose-100 focus:border-rose-400 outline-none transition-all bg-white/50"
                  placeholder="Ex: Vestido floral"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-rose-700 flex items-center gap-2">
                  <Heart className="w-4 h-4" /> O que queria comprar
                </label>
                <input 
                  type="text" 
                  value={formData.queria_comprar}
                  onChange={e => setFormData({...formData, queria_comprar: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border-2 border-rose-100 focus:border-rose-400 outline-none transition-all bg-white/50"
                  placeholder="Ex: Bolsa de couro"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-rose-700 flex items-center gap-2">
                📢 Por onde comprou
              </label>
              <select 
                required
                value={formData.canal}
                onChange={e => setFormData({...formData, canal: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border-2 border-rose-100 focus:border-rose-400 outline-none transition-all bg-white/50"
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
              className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
              Cadastrar Cliente
            </button>
          </form>
        </motion.div>

        {/* Filters & Actions */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-300" />
              <input 
                type="text" 
                placeholder="Buscar por nome ou telefone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-rose-100 focus:border-rose-400 outline-none transition-all bg-white"
              />
            </div>
            <div className="w-full sm:w-48 relative">
              <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-300" />
              <input 
                type="text" 
                placeholder="Tamanho..."
                value={searchSize}
                onChange={e => setSearchSize(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-rose-100 focus:border-rose-400 outline-none transition-all bg-white"
              />
            </div>
            <div className="w-full sm:w-48 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-300" />
              <input 
                type="text" 
                placeholder="Cidade..."
                value={searchCity}
                onChange={e => setSearchCity(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-rose-100 focus:border-rose-400 outline-none transition-all bg-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="bg-white rounded-xl px-4 py-2 shadow-sm border border-rose-100">
              <span className="text-rose-600 font-medium">Total: </span>
              <span className="text-rose-800 font-bold">{filteredClients.length}</span>
            </div>
            <button 
              onClick={exportPDF}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-6 rounded-xl transition-all flex items-center gap-2 shadow-md"
            >
              <Download className="w-5 h-5" /> Exportar PDF
            </button>
          </div>
        </div>

        {/* List Section */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <motion.div 
                  key={client.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl shadow-md p-6 border border-rose-100 hover:shadow-lg transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-inner">
                          {client.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-heading text-xl font-bold text-rose-800">{client.nome}</h4>
                          <p className="text-rose-500 flex items-center gap-1">
                            <Phone className="w-4 h-4" /> {client.telefone}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-rose-50/50 rounded-lg p-3 border border-rose-100">
                          <p className="text-[10px] uppercase tracking-wider text-rose-400 font-bold mb-1 flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3" /> Comprou
                          </p>
                          <p className="text-rose-800 text-sm font-medium">{client.comprou || '—'}</p>
                        </div>
                        <div className="bg-pink-50/50 rounded-lg p-3 border border-pink-100">
                          <p className="text-[10px] uppercase tracking-wider text-pink-400 font-bold mb-1 flex items-center gap-1">
                            <Heart className="w-3 h-3" /> Queria
                          </p>
                          <p className="text-pink-800 text-sm font-medium">{client.queria_comprar || '—'}</p>
                        </div>
                        <div className="bg-fuchsia-50/50 rounded-lg p-3 border border-fuchsia-100">
                          <p className="text-[10px] uppercase tracking-wider text-fuchsia-400 font-bold mb-1">
                            📢 Canal
                          </p>
                          <p className="text-fuchsia-800 text-sm font-medium">{client.canal}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-rose-400 font-medium">
                        <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-rose-50">
                          <Ruler className="w-3 h-3" /> {client.tamanho || 'Tam: —'}
                        </span>
                        <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-rose-50">
                          <MapPin className="w-3 h-3" /> {client.cidade || 'Cidade: —'}
                        </span>
                        <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-rose-50">
                          <Calendar className="w-3 h-3" /> {format(client.created_at.toDate(), 'dd/MM/yyyy')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:w-40">
                      <button 
                        onClick={() => toggleStatus(client)}
                        className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${
                          client.comprou_status === 'sim' 
                            ? 'bg-green-500 text-white hover:bg-green-600' 
                            : 'bg-rose-100 text-rose-500 hover:bg-rose-200'
                        }`}
                      >
                        {client.comprou_status === 'sim' ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        {client.comprou_status === 'sim' ? 'COMPROU' : 'NÃO COMPROU'}
                      </button>
                      
                      <a 
                        href={`https://wa.me/${client.telefone.replace(/\D/g, '')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border border-green-100"
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </a>

                      <button 
                        onClick={() => client.id && handleDelete(client.id)}
                        className="w-full py-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
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
                className="text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-rose-200"
              >
                <Users className="w-16 h-16 text-rose-200 mx-auto mb-4" />
                <h3 className="font-heading text-xl text-rose-800 mb-2">Nenhuma cliente encontrada</h3>
                <p className="text-rose-400">Tente ajustar seus filtros ou cadastre uma nova cliente.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

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
