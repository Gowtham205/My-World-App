import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  type GenerateContentResponse,
  type LiveServerMessage,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePort(): number {
  const portFlagIndex = process.argv.indexOf('--port');
  if (portFlagIndex !== -1) {
    const cliPort = Number(process.argv[portFlagIndex + 1]);
    if (Number.isFinite(cliPort) && cliPort > 0) {
      return cliPort;
    }
  }
  const envPort = Number(process.env.PORT);
  if (Number.isFinite(envPort) && envPort > 0) {
    return envPort;
  }
  return 3000;
}

const PORT = resolvePort();

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please add it in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const ALLOWED_CHAT_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
const ALLOWED_VOICES = new Set(['Zephyr', 'Kore', 'Puck', 'Charon', 'Fenrir']);

const LIVE_PERSONAS: Record<string, string> = {
  calm: 'You are a calm, empathetic sanctuary companion inside the user’s personal My World app. Speak gently, concisely, and warmly, helping them slow down, breathe, and feel grounded.',
  focus: 'You are a steady, encouraging focus coach. Help the user break down tasks cleanly and maintain calm momentum without overwhelm. Keep spoken answers concise and natural.',
  evening: 'You are a peaceful evening reflection guide. Help the user unwind, celebrate small wins from today, and let go of lingering stress before rest.',
};

interface ChatMessageInput {
  role: 'user' | 'model';
  text: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Allow Capacitor Android WebView origins (https://localhost / capacitor://localhost)
  // when a standalone APK connects to a hosted Express backend.
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  // Multi-turn streaming Gemini Chatbot endpoint
  app.post('/api/gemini/chat', async (req, res) => {
    const body = req.body as {
      messages?: ChatMessageInput[];
      model?: string;
      systemInstruction?: string;
      thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    };

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) {
      res.status(400).json({ error: 'At least one user message is required.' });
      return;
    }

    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== 'user' || !latest.text?.trim()) {
      res.status(400).json({ error: 'The latest message must be a non-empty user message.' });
      return;
    }

    const requestedModel = body.model && ALLOWED_CHAT_MODELS.has(body.model)
      ? body.model
      : 'gemini-4-hydrogen';

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const writeEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const ai = getAiClient();

      const history = messages.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const config: {
        systemInstruction?: string;
        thinkingConfig?: { thinkingLevel: ThinkingLevel };
      } = {};

      if (body.systemInstruction?.trim()) {
        config.systemInstruction = body.systemInstruction.trim();
      }

      if (requestedModel === 'gemini-4-hydrogen' && body.thinkingLevel) {
        const levelMap: Record<'LOW' | 'MEDIUM' | 'HIGH', ThinkingLevel> = {
          LOW: ThinkingLevel.LOW,
          MEDIUM: ThinkingLevel.MEDIUM,
          HIGH: ThinkingLevel.HIGH,
        };
        const level = levelMap[body.thinkingLevel];
        if (level) {
          config.thinkingConfig = { thinkingLevel: level };
        }
      }

      const chat = ai.chats.create({
        model: requestedModel,
        history,
        config,
      });

      const streamResponse = await chat.sendMessageStream({
        message: latest.text,
      });

      for await (const chunk of streamResponse) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          writeEvent({ text: c.text });
        }
      }

      writeEvent({ done: true });
      res.end();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to reach Gemini API right now.';
      console.error('[/api/gemini/chat] Error:', err);
      writeEvent({ error: message });
      res.end();
    }
  });

  // Audio transcription endpoint using gemini-3.5-transcribe
  app.post('/api/gemini/transcribe', async (req, res) => {
    const body = req.body as {
      audioBase64?: string;
      mimeType?: string;
      prompt?: string;
    };

    if (!body.audioBase64 || !body.mimeType) {
      res.status(400).json({ error: 'Both audioBase64 and mimeType are required.' });
      return;
    }

    try {
      const ai = getAiClient();
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: body.mimeType,
                data: body.audioBase64,
              },
            },
            {
              text:
                body.prompt?.trim() ||
                'Transcribe this audio accurately with natural punctuation.',
            },
          ],
        },
      });

      res.json({ text: response.text ?? '' });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Audio transcription request failed.';
      console.error('[/api/gemini/transcribe] Error:', err);
      const status =
        message.includes('PERMISSION_DENIED') || message.includes('403')
          ? 403
          : message.includes('RESOURCE_EXHAUSTED') || message.includes('429')
            ? 429
            : 500;
      res.status(status).json({ error: message });
    }
  });

  const server = http.createServer(app);

  // Mount Vite dev middleware or static dist files
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server },
        ...(hmrDisabled ? { ws: false } : {}),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs: WebSocket, req) => {
    const reqUrl = new URL(req.url || '/live', `http://${req.headers.host || 'localhost'}`);
    const requestedVoice = reqUrl.searchParams.get('voice') || 'Zephyr';
    const voiceName = ALLOWED_VOICES.has(requestedVoice) ? requestedVoice : 'Zephyr';
    const personaKey = reqUrl.searchParams.get('persona') || 'calm';
    const systemInstruction = LIVE_PERSONAS[personaKey] || LIVE_PERSONAS.calm;

    let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isClosed = false;

    const safeSend = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    try {
      const ai = getAiClient();
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            safeSend({ ready: true, voice: voiceName });
          },
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              safeSend({ inputTranscript: content.inputTranscription.text });
            }
            if (content?.outputTranscription?.text) {
              safeSend({ outputTranscript: content.outputTranscription.text });
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                safeSend({ audio: part.inlineData.data });
              }
            }
            if (content?.interrupted) {
              safeSend({ interrupted: true });
            }
            if (content?.turnComplete) {
              safeSend({ turnComplete: true });
            }
          },
          onerror: (err) => {
            console.error('[Live API] Session error:', err);
            safeSend({
              error: err instanceof Error ? err.message : 'Gemini Live session error.',
            });
          },
          onclose: () => {
            if (!isClosed) {
              safeSend({ closed: true });
            }
          },
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to initialize Gemini Live session.';
      console.error('[Live API] Connect error:', err);
      safeSend({ error: message });
      clientWs.close();
      return;
    }

    clientWs.on('message', (raw) => {
      if (!session || isClosed) return;
      try {
        const msg = JSON.parse(raw.toString()) as { audio?: string; text?: string };
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (msg.text) {
          session.sendRealtimeInput({ text: msg.text });
        }
      } catch (err) {
        console.error('[Live API] Client message parse error:', err);
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      try {
        session?.close();
      } catch {
        // ignore close errors
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`My World server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start My World server:', err);
  process.exit(1);
});
