import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signInAnonymously,
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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

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
    let isSigningIn = false;
    
    // Safety timeout: if auth hasn't resolved in 6 seconds, stop loading
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 6000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? `User ${user.uid} (${user.isAnonymous ? 'Anonymous' : 'Google'})` : 'No user');
      if (user) {
        setUser(user);
        setLoading(false);
        clearTimeout(timeoutId);
      } else if (!isSigningIn) {
        isSigningIn = true;
        try {
          console.log('Attempting anonymous sign in...');
          await signInAnonymously(auth);
        } catch (error) {
          console.error('Anonymous login error:', error);
          setLoading(false);
          clearTimeout(timeoutId);
        }
      } else {
        setLoading(false);
        clearTimeout(timeoutId);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setClients([]);
      return;
    }

    const q = query(
      collection(db, 'clientes'),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Cliente[];
      
      // Sort client-side by created_at desc
      const sortedClients = clientsData.sort((a, b) => 
        b.created_at.toMillis() - a.created_at.toMillis()
      );
      
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
    setFeedback(null);

    if (!user) {
      setFeedback({ type: 'error', message: 'Você não está conectado. Tente recarregar a página.' });
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newClient: Omit<Cliente, 'id'> = {
        ...formData,
        comprou_status: 'nao',
        created_at: Timestamp.now(),
        uid: user.uid
      };

      console.log('Salvando cliente:', newClient);
      await addDoc(collection(db, 'clientes'), newClient);
      
      setFeedback({ type: 'success', message: 'Cadastro realizado com sucesso!' });
      setFormData({
        nome: '',
        telefone: '',
        tamanho: '',
        cidade: '',
        comprou: '',
        queria_comprar: '',
        canal: ''
      });
      
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
      // Don't throw here so we can show the UI message
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
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Iniciando CRM Profissional...</p>
        </div>
      </div>
    );
  }

  // Removed the login gate as requested by user.
  // The app now auto-logs in anonymously if no user is present.

  return (
    <div className="min-h-screen gradient-professional pb-20">
      <header className="bg-white sticky top-0 z-50 px-6 py-4 shadow-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-100">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">CRM Profissional</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
              <div className={`w-2 h-2 rounded-full ${user ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {user ? (user.isAnonymous ? 'Modo Visitante' : 'Sincronizado') : 'Desconectado'}
              </span>
            </div>
            {user && !user.isAnonymous && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-900">{user.displayName}</span>
                <span className="text-xs text-slate-400">{user.email}</span>
              </div>
            )}
            {user && !user.isAnonymous ? (
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                title="Sair"
              >
                <LogOut className="w-6 h-6" />
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                <LogIn className="w-5 h-5" />
                Entrar
              </button>
            )}
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
            CRM - GESTÃO DE CLIENTES
          </motion.h2>
          <p className="text-slate-500 text-lg">Cadastro e Acompanhamento Profissional</p>
          <div className="w-20 h-1.5 bg-blue-600 mx-auto mt-4 rounded-full"></div>
        </div>

        {/* Form Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-3xl shadow-xl p-8 mb-12 border border-slate-200"
        >
          <h3 className="font-heading text-2xl font-semibold text-slate-800 mb-6 flex items-center gap-3 justify-center">
            <PlusCircle className="w-6 h-6 text-blue-600" /> Novo Cadastro
          </h3>

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
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Nome Completo
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.nome}
                  onChange={e => setFormData({...formData, nome: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 outline-none transition-all bg-white"
                  placeholder="Ex: Maria Silva"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Telefone / WhatsApp
                </label>
                <input 
                  type="tel" 
                  required
                  value={formData.telefone}
                  onChange={e => setFormData({...formData, telefone: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 outline-none transition-all bg-white"
                  placeholder="Ex: (11) 99999-9999"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Ruler className="w-4 h-4" /> Tamanho / Referência
                </label>
                <input 
                  type="text"
                  value={formData.tamanho}
                  onChange={e => setFormData({...formData, tamanho: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 outline-none transition-all bg-white"
                  placeholder="Ex: M ou 42"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Cidade / UF
                </label>
                <input 
                  type="text" 
                  value={formData.cidade}
                  onChange={e => setFormData({...formData, cidade: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 outline-none transition-all bg-white"
                  placeholder="Ex: São Paulo - SP"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" /> Produto de Interesse
                </label>
                <input 
                  type="text" 
                  value={formData.comprou}
                  onChange={e => setFormData({...formData, comprou: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 outline-none transition-all bg-white"
                  placeholder="O que o cliente comprou ou busca"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Heart className="w-4 h-4" /> Observações
                </label>
                <input 
                  type="text" 
                  value={formData.queria_comprar}
                  onChange={e => setFormData({...formData, queria_comprar: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 outline-none transition-all bg-white"
                  placeholder="Detalhes adicionais"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                📢 Canal de Aquisição
              </label>
              <select 
                required
                value={formData.canal}
                onChange={e => setFormData({...formData, canal: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 outline-none transition-all bg-white"
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
              Salvar Cadastro
            </button>
          </form>
        </motion.div>

        {/* Filters & Actions */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por nome ou telefone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 outline-none transition-all bg-white"
              />
            </div>
            <div className="w-full sm:w-48 relative">
              <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tamanho..."
                value={searchSize}
                onChange={e => setSearchSize(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 outline-none transition-all bg-white"
              />
            </div>
            <div className="w-full sm:w-48 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cidade..."
                value={searchCity}
                onChange={e => setSearchCity(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 outline-none transition-all bg-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="bg-white rounded-xl px-4 py-2 shadow-sm border border-slate-200">
              <span className="text-slate-500 font-medium">Total: </span>
              <span className="text-slate-900 font-bold">{filteredClients.length}</span>
            </div>
            <button 
              onClick={exportPDF}
              className="bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 px-6 rounded-xl transition-all flex items-center gap-2 shadow-md"
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
                  className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xl">
                          {client.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-heading text-xl font-bold text-slate-900">{client.nome}</h4>
                          <p className="text-slate-500 flex items-center gap-1">
                            <Phone className="w-4 h-4" /> {client.telefone}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3" /> Interesse
                          </p>
                          <p className="text-slate-700 text-sm font-medium">{client.comprou || '—'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex items-center gap-1">
                            <Heart className="w-3 h-3" /> Obs
                          </p>
                          <p className="text-slate-700 text-sm font-medium">{client.queria_comprar || '—'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                            📢 Canal
                          </p>
                          <p className="text-slate-700 text-sm font-medium">{client.canal}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                          <Ruler className="w-3 h-3" /> {client.tamanho || 'Tam: —'}
                        </span>
                        <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                          <MapPin className="w-3 h-3" /> {client.cidade || 'Cidade: —'}
                        </span>
                        <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                          <Calendar className="w-3 h-3" /> {format(client.created_at.toDate(), 'dd/MM/yyyy')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:w-40">
                      <button 
                        onClick={() => toggleStatus(client)}
                        className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${
                          client.comprou_status === 'sim' 
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {client.comprou_status === 'sim' ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        {client.comprou_status === 'sim' ? 'FINALIZADO' : 'EM ABERTO'}
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
                        className="w-full py-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
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
                className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200"
              >
                <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <h3 className="font-heading text-xl text-slate-800 mb-2">Nenhum registro encontrado</h3>
                <p className="text-slate-400">Comece cadastrando seu primeiro cliente acima.</p>
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
