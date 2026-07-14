import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import sociedadesRoutes from './routes/sociedades';
import safrasRoutes from './routes/safras';
import despesasPessoaisRoutes from './routes/despesasPessoais';
import regrasDespesaRecorrenteRoutes from './routes/regrasDespesaRecorrente';
import acertosRoutes from './routes/acertos';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
app.use('/api/despesas-pessoais', despesasPessoaisRoutes);
app.use('/api/regras-recorrentes', regrasDespesaRecorrenteRoutes);
app.use('/api/acertos', acertosRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error({
    erro: err.message,
    stack: err.stack,
  });
  res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
