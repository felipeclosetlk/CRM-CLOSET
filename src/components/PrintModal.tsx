import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Camera, 
  Upload, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Loader2, 
  Phone, 
  User, 
  Ruler, 
  MapPin, 
  ShoppingBag, 
  Heart, 
  FileImage,
  RefreshCw,
  ClipboardPaste
} from 'lucide-react';
import { Cliente } from '../types';

interface ExtractedPrintData {
  nome: string;
  telefone: string;
  tamanho: string;
  cidade: string;
  comprou: string;
  queria_comprar: string;
  canal: string;
  comprou_status: 'sim' | 'nao';
}

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterDirect: (data: ExtractedPrintData) => Promise<void>;
  onFillForm: (data: ExtractedPrintData) => void;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  onRegisterDirect,
  onFillForm
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/png');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedPrintData | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clear state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setImagePreview(null);
      setExtractedData(null);
      setErrorMessage(null);
      setIsAnalyzing(false);
      setIsSaving(false);
    }
  }, [isOpen]);

  // Listen for Ctrl+V paste events when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  // Helper to compress and downscale high-res screenshots on client-side before sending to server
  const compressAndPrepareImage = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawBase64 = event.target?.result as string;
        if (!rawBase64) {
          resolve({ base64: '', mimeType: 'image/jpeg' });
          return;
        }

        const img = new Image();
        img.onload = () => {
          try {
            const MAX_DIM = 1400; // Optimal resolution for crisp text without exceeding proxy/cloud payload limits
            let { width, height } = img;

            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve({ base64: rawBase64, mimeType: file.type || 'image/jpeg' });
              return;
            }

            // Fill white background in case of transparent PNG screenshots
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            resolve({ base64: compressed, mimeType: 'image/jpeg' });
          } catch {
            resolve({ base64: rawBase64, mimeType: file.type || 'image/jpeg' });
          }
        };
        img.onerror = () => {
          resolve({ base64: rawBase64, mimeType: file.type || 'image/jpeg' });
        };
        img.src = rawBase64;
      };
      reader.onerror = () => {
        resolve({ base64: '', mimeType: 'image/jpeg' });
      };
      reader.readAsDataURL(file);
    });
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/') && !file.name.match(/\.(png|jpe?g|webp|heic|bmp)$/i)) {
      setErrorMessage('Por favor, selecione uma imagem válida (PNG, JPG, WEBP).');
      return;
    }

    setErrorMessage(null);
    setExtractedData(null);
    setIsAnalyzing(true);

    try {
      const { base64, mimeType: optMime } = await compressAndPrepareImage(file);
      if (!base64) {
        throw new Error('Não foi possível ler os dados da imagem selecionada.');
      }
      setImagePreview(base64);
      setMimeType(optMime);
      await analyzeScreenshot(base64, optMime);
    } catch (err: any) {
      console.error('Erro ao processar imagem:', err);
      setErrorMessage(err.message || 'Erro ao processar o arquivo de imagem.');
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePasteClick = async () => {
    try {
      if (!navigator.clipboard?.read) {
        setErrorMessage('Use o atalho do teclado (Ctrl + V) para colar a imagem do print.');
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          try {
            const blob = await item.getType(imageType);
            const file = new File([blob], 'screenshot.png', { type: imageType });
            await processFile(file);
            return;
          } catch (clipErr) {
            console.warn('Erro ao obter blob do clipboard item:', clipErr);
          }
        }
      }
      setErrorMessage('Nenhuma imagem encontrada na área de transferência. Tire o print (PrintScreen ou Win+Shift+S), copie e cole aqui!');
    } catch {
      setErrorMessage('Permissão negada ou não suportada para leitura direta. Pressione Ctrl + V para colar o print.');
    }
  };

  const analyzeScreenshot = async (imgData?: string, mType?: string) => {
    const targetImage = imgData || imagePreview;
    const targetMime = mType || mimeType;

    if (!targetImage) {
      setErrorMessage('Envie uma imagem de print antes de analisar.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/extract-print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: targetImage,
          mimeType: targetMime,
        }),
      });

      // Safely read response as text first to prevent Safari SyntaxError when response is HTML or non-JSON
      const responseText = await response.text();
      let result: any = null;

      try {
        result = JSON.parse(responseText);
      } catch {
        if (response.status === 413) {
          throw new Error('A imagem é muito pesada para envio. A resolução foi ajustada automaticamente, por favor clique em Reanalisar.');
        }
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          throw new Error('O servidor de inteligência artificial está temporariamente ocupado. Por favor, tente novamente em instantes.');
        }
        throw new Error(`Erro na comunicação com o servidor (${response.status}). Por favor, tente novamente.`);
      }

      if (!response.ok || !result || !result.success) {
        let errDesc = result?.error || 'Não foi possível extrair dados do print.';
        if (typeof errDesc === 'string') {
          if (errDesc.includes('"message":')) {
            try {
              const parsed = JSON.parse(errDesc);
              if (parsed?.error?.message) {
                errDesc = parsed.error.message;
              }
            } catch {}
          }
          if (errDesc.includes('high demand') || errDesc.includes('503')) {
            errDesc = 'O modelo de inteligência artificial está com alta demanda momentânea. Clique em "Reanalisar" em alguns instantes.';
          }
        }
        throw new Error(errDesc);
      }

      const data = result.data || {};
      setExtractedData({
        nome: data.nome || '',
        telefone: data.telefone || '',
        tamanho: data.tamanho || '',
        cidade: data.cidade || '',
        comprou: data.comprou || '',
        queria_comprar: data.queria_comprar || '',
        canal: data.canal || 'WhatsApp',
        comprou_status: data.comprou_status === 'sim' ? 'sim' : 'nao',
      });
    } catch (err: any) {
      console.error('Erro na análise:', err);
      let friendlyMessage = err?.message || 'Falha ao analisar a imagem com inteligência artificial.';
      // Clean up WebKit/Safari generic pattern error messages
      if (typeof friendlyMessage === 'string' && friendlyMessage.includes('The string did not match the expected pattern')) {
        friendlyMessage = 'A imagem recebida necessitou de reajuste. Por favor, clique em "Reanalisar" para continuar.';
      }
      setErrorMessage(friendlyMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDirectRegister = async () => {
    if (!extractedData) return;
    if (!extractedData.nome.trim()) {
      setErrorMessage('Por favor, informe ao menos o nome da cliente.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onRegisterDirect(extractedData);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao cadastrar cliente no CRM.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendToForm = () => {
    if (!extractedData) return;
    onFillForm(extractedData);
    onClose();
  };

  const handleResetImage = () => {
    setImagePreview(null);
    setExtractedData(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-brand-rose/10 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-brand-rose/10 flex items-center justify-between bg-gradient-to-r from-brand-blush/40 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-gold to-brand-rose flex items-center justify-center text-white shadow-md">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-display font-bold text-brand-rose flex items-center gap-2">
                Cadastrar via Print do WhatsApp
              </h3>
              <p className="text-xs text-brand-rose/60">
                Envie o print do contato ou conversa para a IA extrair os dados automaticamente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-brand-rose/40 hover:text-brand-rose rounded-xl hover:bg-brand-rose/5 transition-colors"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Error notification */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Atenção</p>
                <p className="text-xs mt-0.5 text-red-600">{errorMessage}</p>
              </div>
              <button 
                onClick={() => setErrorMessage(null)} 
                className="text-red-400 hover:text-red-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Area 1: Upload or Image Preview */}
          {!imagePreview ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${
                isDragging 
                  ? 'border-brand-gold bg-brand-gold/5 scale-[0.99]' 
                  : 'border-brand-rose/20 bg-brand-blush/30 hover:border-brand-gold hover:bg-white'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white shadow-md border border-brand-rose/10 flex items-center justify-center text-brand-gold">
                <FileImage className="w-8 h-8" />
              </div>

              <h4 className="text-base font-bold text-brand-rose mb-1">
                Clique para selecionar o Print ou arraste a imagem aqui
              </h4>
              <p className="text-xs text-brand-rose/60 mb-5 max-w-md mx-auto">
                Suporta prints do perfil de contato, histórico de conversa, pedidos ou comprovantes do WhatsApp.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white border border-brand-rose/15 text-brand-rose text-xs font-bold shadow-sm hover:border-brand-gold flex items-center gap-2 transition-all"
                >
                  <Upload className="w-4 h-4 text-brand-gold" />
                  Escolher Arquivo
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePasteClick();
                  }}
                  className="px-4 py-2.5 rounded-xl gold-button text-xs font-bold flex items-center gap-2 transition-all"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  Colar Print (Ctrl + V)
                </button>
              </div>

              <p className="text-[11px] text-brand-rose/50 mt-4">
                Dica: você também pode apenas apertar <strong>Ctrl + V</strong> em qualquer lugar desta janela para colar o print copiado.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image thumbnail banner */}
              <div className="p-4 rounded-2xl bg-brand-blush/30 border border-brand-rose/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/5 border border-brand-rose/15 shrink-0 flex items-center justify-center">
                    <img 
                      src={imagePreview} 
                      alt="Print do WhatsApp" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-brand-rose truncate">Print do WhatsApp carregado</p>
                    <p className="text-[11px] text-brand-rose/60">
                      {isAnalyzing ? 'Processando imagem com IA...' : extractedData ? 'Dados extraídos com sucesso!' : 'Imagem pronta para análise'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetImage}
                    disabled={isAnalyzing}
                    className="px-3 py-2 text-xs font-bold text-brand-rose/70 hover:text-brand-rose hover:bg-white rounded-xl border border-brand-rose/10 transition-colors"
                  >
                    Trocar Print
                  </button>
                  <button
                    type="button"
                    onClick={() => analyzeScreenshot()}
                    disabled={isAnalyzing}
                    className="px-4 py-2 rounded-xl gold-button text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reanalisar
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {isAnalyzing && (
                <div className="p-8 text-center rounded-3xl bg-brand-blush/40 border border-brand-gold/20 flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center text-brand-gold">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-brand-rose">Lendo print com Inteligência Artificial...</h4>
                    <p className="text-xs text-brand-rose/60 mt-1">
                      Identificando nome, número de telefone, tamanhos, produtos de interesse e detalhes da conversa.
                    </p>
                  </div>
                </div>
              )}

              {/* Extracted Data Card */}
              {extractedData && !isAnalyzing && (
                <div className="p-6 rounded-3xl bg-white border border-brand-gold/30 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-brand-rose/10">
                    <div className="flex items-center gap-2 text-brand-rose font-bold text-sm">
                      <Sparkles className="w-4 h-4 text-brand-gold" />
                      Dados Identificados no Print:
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" /> IA Concluída
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-brand-rose/70 flex items-center gap-1.5">
                        <User className="w-3 h-3 text-brand-gold" /> Nome da Cliente *
                      </label>
                      <input
                        type="text"
                        value={extractedData.nome}
                        onChange={(e) => setExtractedData({ ...extractedData, nome: e.target.value })}
                        placeholder="Nome completo ou primeiro nome"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-brand-rose/15 focus:border-brand-gold outline-none bg-brand-blush/20 text-brand-rose font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-brand-rose/70 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-brand-gold" /> Telefone / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={extractedData.telefone}
                        onChange={(e) => setExtractedData({ ...extractedData, telefone: e.target.value })}
                        placeholder="(DDD) 99999-9999"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-brand-rose/15 focus:border-brand-gold outline-none bg-brand-blush/20 text-brand-rose font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-brand-rose/70 flex items-center gap-1.5">
                        <Ruler className="w-3 h-3 text-brand-gold" /> Tamanho(s)
                      </label>
                      <input
                        type="text"
                        value={extractedData.tamanho}
                        onChange={(e) => setExtractedData({ ...extractedData, tamanho: e.target.value })}
                        placeholder="Ex: M, 38, 40"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-brand-rose/15 focus:border-brand-gold outline-none bg-brand-blush/20 text-brand-rose"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-brand-rose/70 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-brand-gold" /> Cidade / Estado
                      </label>
                      <input
                        type="text"
                        value={extractedData.cidade}
                        onChange={(e) => setExtractedData({ ...extractedData, cidade: e.target.value })}
                        placeholder="Ex: São Paulo - SP"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-brand-rose/15 focus:border-brand-gold outline-none bg-brand-blush/20 text-brand-rose"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-bold text-brand-rose/70 flex items-center gap-1.5">
                        <ShoppingBag className="w-3 h-3 text-brand-gold" /> Produtos de Interesse / Comprados
                      </label>
                      <input
                        type="text"
                        value={extractedData.comprou}
                        onChange={(e) => setExtractedData({ ...extractedData, comprou: e.target.value })}
                        placeholder="Ex: Vestido estampado, Calça pantalona"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-brand-rose/15 focus:border-brand-gold outline-none bg-brand-blush/20 text-brand-rose"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-bold text-brand-rose/70 flex items-center gap-1.5">
                        <Heart className="w-3 h-3 text-brand-gold" /> Observações do Atendimento
                      </label>
                      <textarea
                        value={extractedData.queria_comprar}
                        onChange={(e) => setExtractedData({ ...extractedData, queria_comprar: e.target.value })}
                        placeholder="Anotações da conversa, preferências ou detalhes de envio"
                        rows={2}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-brand-rose/15 focus:border-brand-gold outline-none bg-brand-blush/20 text-brand-rose resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-4 sm:col-span-2 pt-1">
                      <label className="text-xs font-bold text-brand-rose/70">
                        Status da Compra:
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setExtractedData({ ...extractedData, comprou_status: 'sim' })}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            extractedData.comprou_status === 'sim'
                              ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                              : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          Comprou: Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setExtractedData({ ...extractedData, comprou_status: 'nao' })}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            extractedData.comprou_status === 'nao'
                              ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                              : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                          }`}
                        >
                          Comprou: Não (Lead)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-brand-rose/10 bg-brand-blush/20 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-brand-rose/70 hover:text-brand-rose hover:bg-white transition-colors"
          >
            Cancelar
          </button>

          {extractedData && (
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={handleSendToForm}
                className="px-4 py-2.5 rounded-xl bg-white border border-brand-rose/20 text-brand-rose text-xs font-bold hover:border-brand-gold shadow-sm transition-all"
              >
                Revisar no Formulário
              </button>

              <button
                type="button"
                id="btn-cadastrar-print-direto"
                onClick={handleDirectRegister}
                disabled={isSaving || !extractedData.nome.trim()}
                className="px-6 py-2.5 rounded-xl gold-button text-xs font-bold flex items-center gap-2 shadow-md disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Cadastrar no CRM
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
