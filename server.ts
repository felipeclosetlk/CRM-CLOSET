import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for large payload (support base64 images from WhatsApp screenshot prints)
  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ extended: true, limit: '35mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Extract client information from WhatsApp screenshot print
  app.post('/api/extract-print', async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Nenhuma imagem foi recebida.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'A chave GEMINI_API_KEY não foi encontrada nas configurações do ambiente.'
        });
      }

      // Handle data URL scheme if present
      let cleanBase64 = image;
      let detectedMimeType = (mimeType || 'image/jpeg').toLowerCase();
      if (image.includes(';base64,')) {
        const parts = image.split(';base64,');
        detectedMimeType = parts[0].replace('data:', '').trim().toLowerCase() || detectedMimeType;
        cleanBase64 = parts[1].trim();
      }

      // Ensure valid standard MIME type for Gemini API
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(detectedMimeType)) {
        detectedMimeType = 'image/jpeg';
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Você é um assistente especialista em CRM de vestuário e moda para atendimento via WhatsApp.
Analise a imagem enviada, que é um print do WhatsApp (pode ser o perfil de contato da cliente, conversa com mensagens, pedido, dados de envio ou comprovante).

Extraia com a maior precisão possível as informações cadastrais da cliente:
- nome: Nome completo ou primeiro nome da cliente. Se for print de contato ou perfil, use o nome exibido.
- telefone: Número de telefone (WhatsApp) da cliente com DDD (apenas números ou formatado).
- tamanho: Tamanho ou numeração de roupas mencionadas no print (ex: PP, P, M, G, GG, 34, 36, 38, 40, 42, 44 ou combinações separadas por vírgula).
- cidade: Cidade / Estado ou endereço da cliente, se mencionado.
- comprou: Produtos ou peças de interesse ou que foram solicitados/comprados na conversa.
- queria_comprar: Observações adicionais, preferências, detalhes da conversa ou dúvidas.
- canal: "WhatsApp"
- comprou_status: "sim" se no print constar confirmação de pagamento/compra concluída, ou "nao" se ainda for atendimento/interesse/orçamento.

Retorne rigorosamente no schema JSON definido.`;

      // Prioritize high-availability and fast models with graceful backoff
      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
      let response: any = null;
      let lastModelError: any = null;

      for (let i = 0; i < candidateModels.length; i++) {
        const modelName = candidateModels[i];
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: detectedMimeType,
                    data: cleanBase64,
                  }
                },
                {
                  text: prompt
                }
              ]
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  nome: { type: Type.STRING, description: 'Nome da cliente' },
                  telefone: { type: Type.STRING, description: 'Telefone com DDD' },
                  tamanho: { type: Type.STRING, description: 'Tamanho de roupas' },
                  cidade: { type: Type.STRING, description: 'Cidade ou localização' },
                  comprou: { type: Type.STRING, description: 'Produtos de interesse ou comprados' },
                  queria_comprar: { type: Type.STRING, description: 'Observações da conversa' },
                  canal: { type: Type.STRING, description: 'Canal de origem (WhatsApp)' },
                  comprou_status: { type: Type.STRING, description: 'sim ou nao' }
                }
              }
            }
          });

          if (response?.text) {
            break;
          }
        } catch (mErr: any) {
          lastModelError = mErr;
          console.log(`[extract-print] Modelo ${modelName} temporariamente indisponível (${mErr?.status || 503}), tentando próxima alternativa...`);
          // Brief pause before trying next model to avoid rapid-fire contention
          if (i < candidateModels.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 600));
          }
        }
      }

      if (!response?.text) {
        throw lastModelError || new Error('Não foi possível obter resposta do serviço de IA.');
      }

      const responseText = response.text?.trim() || '{}';
      let parsed = {};
      try {
        parsed = JSON.parse(responseText);
      } catch (err) {
        console.error('Falha ao converter resposta do modelo para JSON:', responseText);
        return res.status(500).json({ 
          success: false, 
          error: 'Não foi possível interpretar o resultado da IA.' 
        });
      }

      return res.json({
        success: true,
        data: parsed
      });
    } catch (error: any) {
      console.error('Erro na rota /api/extract-print:', error);
      let errorMsg = error?.message || 'Erro inesperado ao processar print.';
      if (typeof errorMsg === 'string' && (errorMsg.includes('503') || errorMsg.includes('high demand'))) {
        errorMsg = 'O serviço de IA está temporariamente com alta demanda. Por favor, tente novamente em alguns instantes.';
      }
      return res.status(500).json({
        success: false,
        error: errorMsg
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
