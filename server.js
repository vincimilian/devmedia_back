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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
