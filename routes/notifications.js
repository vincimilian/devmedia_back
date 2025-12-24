import express from 'express';
import { db } from '../config/firebase.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Buscar notificações do usuário
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { limit = 20 } = req.query;

        const snapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .get();

        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push({ id: doc.id, ...doc.data() });
        });

        // Ordenar por data em memória
        notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(notifications.slice(0, parseInt(limit)));
    } catch (error) {
        console.error('Erro ao buscar notificações:', error);
        res.json([]); // Retornar array vazio em caso de erro
    }
});

// Contar notificações não lidas
router.get('/unread/count', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;

        const snapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .where('read', '==', false)
            .get();

        res.json({ count: snapshot.size });
    } catch (error) {
        console.error('Erro ao contar notificações:', error);
        res.status(500).json({ error: 'Erro ao contar notificações' });
    }
});

// Marcar notificação como lida
router.put('/:notificationId/read', verifyToken, async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.uid;

        const notifRef = db.collection('notifications').doc(notificationId);
        const notifDoc = await notifRef.get();

        if (!notifDoc.exists) {
            return res.status(404).json({ error: 'Notificação não encontrada' });
        }

        if (notifDoc.data().userId !== userId) {
            return res.status(403).json({ error: 'Não autorizado' });
        }

        await notifRef.update({ read: true });
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao marcar notificação:', error);
        res.status(500).json({ error: 'Erro ao marcar notificação' });
    }
});

// Marcar todas como lidas
router.put('/read-all', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;

        const snapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .where('read', '==', false)
            .get();

        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });

        await batch.commit();
        res.json({ success: true, count: snapshot.size });
    } catch (error) {
        console.error('Erro ao marcar todas:', error);
        res.status(500).json({ error: 'Erro ao marcar todas' });
    }
});

// Função helper para criar notificação (exportada para uso em outras rotas)
export const createNotification = async (userId, type, data) => {
    try {
        const notification = {
            userId,
            type, // 'like', 'comment', 'follow', 'message', 'new_post'
            ...data,
            read: false,
            createdAt: new Date().toISOString()
        };

        await db.collection('notifications').add(notification);
    } catch (error) {
        console.error('Erro ao criar notificação:', error);
    }
};

export default router;
