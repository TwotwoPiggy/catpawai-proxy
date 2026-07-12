require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Readable } = require('node:stream');
const path = require('path');
const { AppError, openAiError } = require('./errors');
const defaultCatPawAiClient = require('./catpawai-client');
const { DEFAULT_MODEL_ID, MODELS } = require('./models');
const logger = require('./logger');
const { createToolCallInterceptor } = require('./stream-interceptor');
const { importFromCatPawState } = require('../scripts/import-from-catpaw-state');

function validateChatRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError(400, 'invalid_request', 'Request body must be a JSON object.');
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new AppError(400, 'invalid_messages', 'messages must be a non-empty array.');
  }
  for (const message of body.messages) {
    if (!message || typeof message !== 'object') {
      throw new AppError(400, 'invalid_messages', 'Each message must be an object.');
    }
    if (!['system', 'user', 'assistant', 'tool'].includes(message.role)) {
      throw new AppError(400, 'unsupported_role', `Unsupported message role: ${message.role}`);
    }
  }
}

function createApp({ env = process.env, catpawaiClient = defaultCatPawAiClient } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  
  let isProxyEnabled = true;
  let autoRefreshInterval = null;
  let autoRefreshIntervalMs = 0;

  app.use('/', express.static(path.join(__dirname, '../public')));

  function getDiagnostics() {
    const discovery = catpawaiClient.discoverCatPawAi(env);
    const needsCatPawToken = discovery.authMode === 'catpaw' && !discovery.catpawTokenConfigured;
    const ok = discovery.openAiBaseUrlConfigured && !needsCatPawToken;
    return {
      ok,
      name: 'catpawai-proxy',
      baseUrl: `http://127.0.0.1:${env.PORT || 13000}/v1`,
      catpawai: discovery,
      nextStep: needsCatPawToken
        ? 'Set CATPAWAI_ACCESS_TOKEN and CATPAWAI_MIS_ID, then retry /v1/chat/completions.'
        : discovery.openAiBaseUrlConfigured
          ? 'Use /v1/chat/completions.'
          : 'Set CATPAWAI_OPENAI_BASE_URL only if CatPawAI exposes an explicit OpenAI-compatible backend.',
    };
  }

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      name: 'catpawai-proxy',
      catpawai: catpawaiClient.discoverCatPawAi(env),
    });
  });

  app.get('/diagnostics', (_req, res) => {
    res.json(getDiagnostics());
  });

  app.get('/v1/models', (_req, res) => {
    res.json({
      object: 'list',
      data: MODELS.map((model) => ({
        id: model.id,
        object: 'model',
        created: 0,
        owned_by: model.owned_by,
      })),
    });
  });

  app.post('/v1/chat/completions', async (req, res) => {
    if (!isProxyEnabled) {
      return res.status(503).json({
        error: {
          message: 'Proxy is currently disabled via UI.',
          type: 'proxy_disabled',
          code: 'service_unavailable'
        }
      });
    }
    try {
      validateChatRequest(req.body);
      const request = {
        model: req.body.model || DEFAULT_MODEL_ID,
        messages: req.body.messages,
        stream: Boolean(req.body.stream),
        temperature: req.body.temperature,
        max_tokens: req.body.max_tokens,
        tools: req.body.tools,
        tool_choice: req.body.tool_choice,
        parallel_tool_calls: req.body.parallel_tool_calls,
        env,
        signal: req.signal,
      };
      if (request.stream && catpawaiClient.createChatCompletionStream) {
        const upstream = await catpawaiClient.createChatCompletionStream(request);
        res.status(200);
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (!upstream.body) {
          res.end();
          return;
        }
        const nodeStream = Readable.fromWeb(upstream.body);
        nodeStream.on('error', (err) => {
          logger.error('Stream transmission error', err);
          res.destroy(err);
        });
        const interceptor = createToolCallInterceptor();
        interceptor.on('error', (err) => {
          logger.error('Interceptor error', err);
          res.destroy(err);
        });
        nodeStream.pipe(interceptor).pipe(res);
        return;
      }
      const result = await catpawaiClient.createChatCompletion({
        ...request,
        stream: false,
      });
      res.status(200).json(result);
    } catch (error) {
      logger.error('Chat completion failed', error);
      const { status, body } = openAiError(error);
      res.status(status).json(body);
    }
  });

  // UI API Endpoints
  app.get('/api/status', (req, res) => {
    const token = env.CATPAWAI_ACCESS_TOKEN || env.CATPAWAI_API_KEY || '';
    res.json({
      ok: true,
      proxyEnabled: isProxyEnabled,
      autoRefreshInterval: autoRefreshIntervalMs,
      tokenPreview: token ? `${token.slice(0, 4)}...${token.slice(-4)}` : 'Not Set'
    });
  });

  app.post('/api/proxy/toggle', (req, res) => {
    isProxyEnabled = Boolean(req.body.enabled);
    logger.info(`Proxy ${isProxyEnabled ? 'enabled' : 'disabled'} via UI`);
    res.json({ ok: true, proxyEnabled: isProxyEnabled });
  });

  app.post('/api/server/exit', (req, res) => {
    logger.info('Server shutdown requested via UI');
    res.json({ ok: true });
    setTimeout(() => process.exit(0), 500);
  });

  app.post('/api/state/refresh', async (req, res) => {
    try {
      logger.info('Manual state refresh triggered');
      await importFromCatPawState();
      // Reload .env into process.env dynamically
      require('dotenv').config({ override: true });
      res.json({ ok: true });
    } catch (err) {
      logger.error('State refresh failed', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/state/auto', (req, res) => {
    const { intervalMs } = req.body;
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
    autoRefreshIntervalMs = Number(intervalMs) || 0;
    
    if (autoRefreshIntervalMs > 0) {
      logger.info(`Auto-refresh enabled for every ${autoRefreshIntervalMs}ms`);
      autoRefreshInterval = setInterval(async () => {
        try {
          logger.info('Auto-refresh triggered');
          await importFromCatPawState();
          require('dotenv').config({ override: true });
        } catch (err) {
          logger.error('Auto-refresh failed', err);
        }
      }, autoRefreshIntervalMs);
    } else {
      logger.info('Auto-refresh disabled');
    }
    res.json({ ok: true, autoRefreshInterval: autoRefreshIntervalMs });
  });

  app.get('/api/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onLog = (logObj) => {
      res.write(`data: ${JSON.stringify(logObj)}\n\n`);
    };

    logger.logEmitter.on('log', onLog);
    
    req.on('close', () => {
      logger.logEmitter.off('log', onLog);
    });
  });

  app.use((error, _req, res, _next) => {
    logger.error('Unhandled server error', error);
    const { status, body } = openAiError(error);
    res.status(status).json(body);
  });

  return app;
}

module.exports = {
  createApp,
  validateChatRequest,
};
