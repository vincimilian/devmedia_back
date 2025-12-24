import express from 'express';
import { db } from '../config/firebase.js';
import { verifyToken } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();

// Seguir usuário
router.post('/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.uid;

        if (userId === currentUserId) {
            return res.status(400).json({ error: 'Você não pode seguir a si mesmo' });
        }

        // Verificar se o usuário a ser seguido existe
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Criar relacionamento de seguir
        const followData = {
            followerId: currentUserId,
            followingId: userId,
            createdAt: new Date().toISOString()
        };

        await db.collection('follows').add(followData);

        // Atualizar contadores
        const currentUserRef = db.collection('users').doc(currentUserId);
        const targetUserRef = db.collection('users').doc(userId);

        await currentUserRef.update({
            followingCount: (await currentUserRef.get()).data()?.followingCount || 0 + 1
        });

        await targetUserRef.update({
            followersCount: (await targetUserRef.get()).data()?.followersCount || 0 + 1
        });

        // Criar notificação
        const followerDoc = await db.collection('users').doc(currentUserId).get();
        const followerData = followerDoc.data();

        await createNotification(userId, 'follow', {
            fromUserId: currentUserId,
            fromUserName: followerData?.displayName || 'Usuário',
            fromUserAvatar: followerData?.avatar || ''
        });

        res.json({ success: true, message: 'Usuário seguido com sucesso' });
    } catch (error) {
        console.error('Erro ao seguir usuário:', error);
        res.status(500).json({ error: 'Erro ao seguir usuário' });
    }
});

// Deixar de seguir usuário
router.delete('/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.uid;

        // Buscar relacionamento
        const followsSnapshot = await db.collection('follows')
            .where('followerId', '==', currentUserId)
            .where('followingId', '==', userId)
            .get();

        if (followsSnapshot.empty) {
            return res.status(404).json({ error: 'Você não segue este usuário' });
        }

        // Deletar relacionamento
        const batch = db.batch();
        followsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        // Atualizar contadores
        const currentUserRef = db.collection('users').doc(currentUserId);
        const targetUserRef = db.collection('users').doc(userId);

        const currentUserData = (await currentUserRef.get()).data();
        const targetUserData = (await targetUserRef.get()).data();

        await currentUserRef.update({
            followingCount: Math.max(0, (currentUserData?.followingCount || 0) - 1)
        });

        await targetUserRef.update({
            followersCount: Math.max(0, (targetUserData?.followersCount || 0) - 1)
        });

        res.json({ success: true, message: 'Deixou de seguir o usuário' });
    } catch (error) {
        console.error('Erro ao deixar de seguir:', error);
        res.status(500).json({ error: 'Erro ao deixar de seguir' });
    }
});

// Listar seguidores de um usuário
router.get('/followers/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const followsSnapshot = await db.collection('follows')
            .where('followingId', '==', userId)
            .get();

        const followerIds = followsSnapshot.docs.map(doc => doc.data().followerId);

        if (followerIds.length === 0) {
            return res.json([]);
        }

        // Buscar informações dos seguidores
        const followers = [];
        for (const followerId of followerIds) {
            const userDoc = await db.collection('users').doc(followerId).get();
            if (userDoc.exists) {
                followers.push({ id: followerId, ...userDoc.data() });
            }
        }

        res.json(followers);
    } catch (error) {
        console.error('Erro ao buscar seguidores:', error);
        res.status(500).json({ error: 'Erro ao buscar seguidores' });
    }
});

// Listar quem o usuário segue
router.get('/following/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const followsSnapshot = await db.collection('follows')
            .where('followerId', '==', userId)
            .get();

        const followingIds = followsSnapshot.docs.map(doc => doc.data().followingId);

        if (followingIds.length === 0) {
            return res.json([]);
        }

        // Buscar informações dos usuários seguidos
        const following = [];
        for (const followingId of followingIds) {
            const userDoc = await db.collection('users').doc(followingId).get();
            if (userDoc.exists) {
                following.push({ id: followingId, ...userDoc.data() });
            }
        }

        res.json(following);
    } catch (error) {
        console.error('Erro ao buscar seguindo:', error);
        res.status(500).json({ error: 'Erro ao buscar seguindo' });
    }
});

// Verificar se segue um usuário
router.get('/check/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.uid;

        const followsSnapshot = await db.collection('follows')
            .where('followerId', '==', currentUserId)
            .where('followingId', '==', userId)
            .get();

        res.json({ isFollowing: !followsSnapshot.empty });
    } catch (error) {
        console.error('Erro ao verificar seguidor:', error);
        res.status(500).json({ error: 'Erro ao verificar seguidor' });
    }
});

export default router;
