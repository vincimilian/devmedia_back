import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import postsRoutes from './routes/posts.js';
import commentsRoutes from './routes/comments.js';
import uploadRoutes from './routes/upload.js';
import followRoutes from './routes/follow.js';
import messagesRoutes from './routes/messages.js';
import searchRoutes from './routes/search.js';
import notificationsRoutes from './routes/notifications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5010;

// Middlewares
const allowedOrigins = [
    'http://localhost:5173',  // Desenvolvimento local
    'http://localhost:5174',  // Desenvolvimento local (porta alternativa)
    'https://gitproj.netlify.app',  // Produção
];

app.use(cors({
    origin: function (origin, callback) {
        // Permite requisições sem origin (como apps mobile ou Postman)
        if (!origin) return callback(null, true);

        // Verifica se a origem está na lista de origens permitidas
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (typeof allowedOrigin === 'string') {
                return origin === allowedOrigin;
            }
            return false;
        });

        // Verifica se é um domínio .netlify.app
        const isNetlifyDomain = /^https:\/\/[a-zA-Z0-9-]+\.netlify\.app$/.test(origin);

        if (isAllowed || isNetlifyDomain) {
            return callback(null, true);
        }

        const msg = 'A política de CORS não permite acesso desta origem.';
        return callback(new Error(msg), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle preflight requests
app.options('*', cors());

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationsRoutes);

// Rota de health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'DevMedia API está funcionando!' });
});

// Tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Algo deu errado!' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
});
