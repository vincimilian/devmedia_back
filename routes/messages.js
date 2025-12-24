import express from 'express';
import { db } from '../config/firebase.js';
import { verifyToken } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();

// Enviar mensagem
router.post('/', verifyToken, async (req, res) => {
    try {
        const { recipientId, content, type = 'text', postData } = req.body;
        const senderId = req.user.uid;

        if (!recipientId || !content) {
            return res.status(400).json({ error: 'Destinatário e conteúdo são obrigatórios' });
        }

        if (recipientId === senderId) {
            return res.status(400).json({ error: 'Você não pode enviar mensagem para si mesmo' });
        }

        // Verificar se o destinatário existe
        const recipientDoc = await db.collection('users').doc(recipientId).get();
        if (!recipientDoc.exists) {
            return res.status(404).json({ error: 'Destinatário não encontrado' });
        }

        // Buscar informações do remetente
        const senderDoc = await db.collection('users').doc(senderId).get();
        const senderData = senderDoc.data();

        const message = {
            senderId,
            senderName: senderData?.displayName || req.user.name,
            senderAvatar: senderData?.avatar || '',
            recipientId,
            content,
            type,
            postData: postData || null,
            read: false,
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection('messages').add(message);

        // Criar notificação
        await createNotification(recipientId, 'message', {
            fromUserId: senderId,
            fromUserName: senderData?.displayName || 'Usuário',
            fromUserAvatar: senderData?.avatar || '',
            messagePreview: content.substring(0, 50)
        });

        res.json({ success: true, messageId: docRef.id, message: { id: docRef.id, ...message } });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

// Buscar conversa com um usuário específico
router.get('/conversation/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.uid;

        // Buscar mensagens enviadas pelo usuário atual para o outro usuário
        const sentSnapshot = await db.collection('messages')
            .where('senderId', '==', currentUserId)
            .where('recipientId', '==', userId)
            .get();

        // Buscar mensagens recebidas do outro usuário
        const receivedSnapshot = await db.collection('messages')
            .where('senderId', '==', userId)
            .where('recipientId', '==', currentUserId)
            .get();

        const messages = [];

        sentSnapshot.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data() });
        });

        receivedSnapshot.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data() });
        });

        // Ordenar por data
        messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        res.json(messages);
    } catch (error) {
        console.error('Erro ao buscar conversa:', error);
        res.json([]); // Retornar array vazio em vez de erro
    }
});

// Listar todas as conversas do usuário
router.get('/conversations', verifyToken, async (req, res) => {
    try {
        const currentUserId = req.user.uid;

        // Buscar todas as mensagens do usuário
        const sentSnapshot = await db.collection('messages')
            .where('senderId', '==', currentUserId)
            .get();

        const receivedSnapshot = await db.collection('messages')
            .where('recipientId', '==', currentUserId)
            .get();

        // Mapear conversas únicas
        const conversationsMap = new Map();

        const processMessages = (snapshot) => {
            snapshot.forEach(doc => {
                const data = doc.data();
                const otherUserId = data.senderId === currentUserId ? data.recipientId : data.senderId;

                if (!conversationsMap.has(otherUserId) ||
                    new Date(data.createdAt) > new Date(conversationsMap.get(otherUserId).lastMessageAt)) {
                    conversationsMap.set(otherUserId, {
                        userId: otherUserId,
                        lastMessage: data.content,
                        lastMessageAt: data.createdAt,
                        unread: data.recipientId === currentUserId && !data.read
                    });
                }
            });
        };

        processMessages(sentSnapshot);
        processMessages(receivedSnapshot);

        // Buscar informações dos usuários
        const conversations = [];
        for (const [userId, convData] of conversationsMap) {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                conversations.push({
                    ...convData,
                    userName: userData.displayName,
                    userAvatar: userData.avatar || ''
                });
            }
        }

        // Ordenar por última mensagem
        conversations.sort((a, b) =>
            new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
        );

        res.json(conversations);
    } catch (error) {
        console.error('Erro ao buscar conversas:', error);
        res.json([]); // Retornar array vazio em vez de erro
    }
});

// Marcar mensagem como lida
router.put('/:messageId/read', verifyToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const currentUserId = req.user.uid;

        const messageRef = db.collection('messages').doc(messageId);
        const messageDoc = await messageRef.get();

        if (!messageDoc.exists) {
            return res.status(404).json({ error: 'Mensagem não encontrada' });
        }

        const message = messageDoc.data();

        if (message.recipientId !== currentUserId) {
            return res.status(403).json({ error: 'Não autorizado' });
        }

        await messageRef.update({ read: true });

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao marcar mensagem como lida:', error);
        res.status(500).json({ error: 'Erro ao marcar mensagem como lida' });
    }
});

// Contar mensagens não lidas
router.get('/unread/count', verifyToken, async (req, res) => {
    try {
        const currentUserId = req.user.uid;

        const unreadSnapshot = await db.collection('messages')
            .where('recipientId', '==', currentUserId)
            .where('read', '==', false)
            .get();

        res.json({ count: unreadSnapshot.size });
    } catch (error) {
        console.error('Erro ao contar mensagens não lidas:', error);
        res.status(500).json({ error: 'Erro ao contar mensagens não lidas' });
    }
});

export default router;
