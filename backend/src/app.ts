import dotenv from 'dotenv';
dotenv.config();

// Precisa ser o primeiro import de tudo (antes das rotas): faz o patch que permite uma
// exceção lançada dentro de um controller `async` chegar até o error handler no fim deste
// arquivo — sem isso, a promise rejeitada de um controller assíncrono simplesmente some,
// sem nunca acionar o `next(err)` (gap identificado na spec 17).
import 'express-async-errors';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Sentry, { initSentry } from './lib/sentry';
import authRoutes from './routes/auth';
import sociedadesRoutes from './routes/sociedades';
import safrasRoutes from './routes/safras';
import despesasRoutes from './routes/despesas';
import despesasPessoaisRoutes from './routes/despesasPessoais';
import regrasDespesaRecorrenteRoutes from './routes/regrasDespesaRecorrente';
import unidadesVendaRoutes from './routes/unidadesVenda';
import acertosRoutes from './routes/acertos';
import assinaturaRoutes from './routes/assinatura';
import adminRoutes from './routes/admin';
import webhooksAsaasRoutes from './routes/webhooksAsaas';

initSentry();

const app = express();
const PORT = process.env.PORT || 3001;

// Railway roda o backend atrás de um proxy reverso — sem isso, o Express enxerga o IP do
// proxy em vez do IP real do visitante, o que quebra a contagem por IP do loginLimiter abaixo
// (todo mundo cai no mesmo "balde", inclusive risco de travar um revisor da Apple sem querer).
app.set('trust proxy', 1);

// FRONTEND_URL aceita uma lista separada por vírgula — necessário desde a migração do domínio
// de produção (2026-08-30), que manteve links antigos (.vercel.app) em uso por usuários que
// ainda não migraram pro domínio próprio (hortiflow-produtor.com.br).
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
// Limite maior que o padrão (100kb) porque a foto de comprovante de despesa vai como base64 no
// corpo da requisição (task 7 — sem upload pra storage externo nesta fase).
app.use(express.json({ limit: '8mb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/sociedades', sociedadesRoutes);
app.use('/api/safras', safrasRoutes);
app.use('/api/despesas', despesasRoutes);
app.use('/api/despesas-pessoais', despesasPessoaisRoutes);
app.use('/api/regras-recorrentes', regrasDespesaRecorrenteRoutes);
app.use('/api/unidades-venda', unidadesVendaRoutes);
app.use('/api/acertos', acertosRoutes);
app.use('/api/assinatura', assinaturaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks/asaas', webhooksAsaasRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error({
    erro: err.message,
    stack: err.stack,
  });
  Sentry.captureException(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
