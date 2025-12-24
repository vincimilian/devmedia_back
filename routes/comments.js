import express from 'express';
import { db } from '../config/firebase.js';
import { verifyToken } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();

// Criar comentário
router.post('/', verifyToken, async (req, res) => {
    try {
        const { postId, content } = req.body;
        const userId = req.user.uid;

        if (!postId || !content) {
            return res.status(400).json({ error: 'PostId e conteúdo são obrigatórios' });
        }

        // Verificar se o post existe
        const postDoc = await db.collection('posts').doc(postId).get();
        if (!postDoc.exists) {
            return res.status(404).json({ error: 'Post não encontrado' });
        }

        // Buscar informações do usuário
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        const comment = {
            postId,
            userId,
            userDisplayName: userData?.displayName || req.user.name,
            userAvatar: userData?.avatar || '',
            content,
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection('comments').add(comment);

        // Atualizar contador de comentários no post
        // Incrementar contador de comentários no post
        const post = postDoc.data();
        await db.collection('posts').doc(postId).update({
            commentsCount: (post.commentsCount || 0) + 1
        });

        // Criar notificação se não for o próprio post
        if (post.userId !== userId) {
            await createNotification(post.userId, 'comment', {
                fromUserId: userId,
                fromUserName: userData?.displayName || 'Usuário',
                fromUserAvatar: userData?.avatar || '',
                postId: postId,
                postContent: post.content.substring(0, 50),
                commentContent: content.substring(0, 50)
            });
        }

        res.json({ success: true, commentId: docRef.id, comment: { id: docRef.id, ...comment } });
    } catch (error) {
        console.error('Erro ao criar comentário:', error);
        res.status(500).json({ error: 'Erro ao criar comentário' });
    }
});

// Listar comentários de um post
router.get('/post/:postId', async (req, res) => {
    try {
        const { postId } = req.params;

        const snapshot = await db.collection('comments')
            .where('postId', '==', postId)
            .orderBy('createdAt', 'asc')
            .get();

        const comments = [];
        snapshot.forEach(doc => {
            comments.push({ id: doc.id, ...doc.data() });
        });

        res.json(comments);
    } catch (error) {
        console.error('Erro ao buscar comentários:', error);
        res.status(500).json({ error: 'Erro ao buscar comentários' });
    }
});

// Deletar comentário
router.delete('/:commentId', verifyToken, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.uid;

        const commentDoc = await db.collection('comments').doc(commentId).get();

        if (!commentDoc.exists) {
            return res.status(404).json({ error: 'Comentário não encontrado' });
        }

        const comment = commentDoc.data();

        if (comment.userId !== userId) {
            return res.status(403).json({ error: 'Não autorizado' });
        }

        // Atualizar contador de comentários no post
        const postDoc = await db.collection('posts').doc(comment.postId).get();
        if (postDoc.exists) {
            const post = postDoc.data();
            await db.collection('posts').doc(comment.postId).update({
                commentsCount: Math.max(0, (post.commentsCount || 0) - 1),
                updatedAt: new Date().toISOString()
            });
        }

        await db.collection('comments').doc(commentId).delete();

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao deletar comentário:', error);
        res.status(500).json({ error: 'Erro ao deletar comentário' });
    }
});

export default router;
