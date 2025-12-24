import express from 'express';
import { db } from '../config/firebase.js';
import { verifyToken } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();

// Feed inteligente com priorização de seguidos
router.get('/feed', verifyToken, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const currentUserId = req.user.uid;

        // Buscar usuários que o usuário atual segue
        const followingSnapshot = await db.collection('follows')
            .where('followerId', '==', currentUserId)
            .get();

        const followingIds = followingSnapshot.docs.map(doc => doc.data().followingId);

        // Buscar TODOS os posts
        const postsSnapshot = await db.collection('posts')
            .orderBy('createdAt', 'desc')
            .limit(parseInt(limit) * 3)
            .get();

        let allPosts = [];
        postsSnapshot.forEach(doc => {
            allPosts.push({ id: doc.id, ...doc.data() });
        });

        // Se não há posts, retornar vazio
        if (allPosts.length === 0) {
            return res.json([]);
        }

        // Se não segue ninguém, retornar posts com leve shuffle
        if (followingIds.length === 0) {
            const shuffled = [...allPosts];
            // Embaralhar levemente os primeiros posts
            for (let i = Math.min(5, shuffled.length - 1); i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return res.json(shuffled.slice(0, parseInt(limit)));
        }

        // Separar posts de seguidos e não seguidos
        const followedPosts = allPosts.filter(post => followingIds.includes(post.userId));
        const otherPosts = allPosts.filter(post => !followingIds.includes(post.userId));

        // Embaralhar levemente (ordem semi-aleatória)
        const shuffleArray = (array) => {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        };

        const shuffledFollowed = shuffleArray(followedPosts);
        const shuffledOthers = shuffleArray(otherPosts);

        // Intercalar posts: 2 de seguidos, 1 de outros
        const finalPosts = [];
        let followedIndex = 0;
        let othersIndex = 0;

        while (finalPosts.length < parseInt(limit) &&
            (followedIndex < shuffledFollowed.length || othersIndex < shuffledOthers.length)) {

            // Adicionar 2 posts de seguidos
            for (let i = 0; i < 2 && followedIndex < shuffledFollowed.length; i++) {
                finalPosts.push(shuffledFollowed[followedIndex++]);
            }

            // Adicionar 1 post de outros
            if (othersIndex < shuffledOthers.length) {
                finalPosts.push(shuffledOthers[othersIndex++]);
            }

            // Se não há mais posts de seguidos, adicionar dos outros
            if (followedIndex >= shuffledFollowed.length && othersIndex < shuffledOthers.length) {
                finalPosts.push(shuffledOthers[othersIndex++]);
            }
        }

        res.json(finalPosts.slice(0, parseInt(limit)));
    } catch (error) {
        console.error('Erro ao buscar feed:', error);
        res.status(500).json({ error: 'Erro ao buscar feed' });
    }
});

// Criar post
router.post('/', verifyToken, async (req, res) => {
    try {
        const { content, imageUrl, tags } = req.body;
        const userId = req.user.uid;

        // Buscar informações do usuário
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        const post = {
            userId,
            userDisplayName: userData?.displayName || req.user.name,
            userAvatar: userData?.avatar || '',
            content,
            imageUrl: imageUrl || null,
            tags: tags || [],
            likes: [],
            likesCount: 0,
            commentsCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await db.collection('posts').add(post);

        // Notificar seguidores sobre novo post
        const followersSnapshot = await db.collection('follows')
            .where('followingId', '==', userId)
            .get();

        const notificationPromises = [];
        followersSnapshot.forEach(doc => {
            const followerId = doc.data().followerId;
            notificationPromises.push(
                createNotification(followerId, 'new_post', {
                    fromUserId: userId,
                    fromUserName: userData?.displayName || req.user.name,
                    fromUserAvatar: userData?.avatar || '',
                    postId: docRef.id,
                    postContent: content.substring(0, 50)
                })
            );
        });

        await Promise.all(notificationPromises);

        res.json({ success: true, postId: docRef.id, post: { id: docRef.id, ...post } });
    } catch (error) {
        console.error('Erro ao criar post:', error);
        res.status(500).json({ error: 'Erro ao criar post' });
    }
});

// Listar posts (feed)
router.get('/', async (req, res) => {
    try {
        const { limit = 20, startAfter } = req.query;

        let query = db.collection('posts')
            .orderBy('createdAt', 'desc')
            .limit(parseInt(limit));

        if (startAfter) {
            const startDoc = await db.collection('posts').doc(startAfter).get();
            query = query.startAfter(startDoc);
        }

        const snapshot = await query.get();
        const posts = [];

        snapshot.forEach(doc => {
            posts.push({ id: doc.id, ...doc.data() });
        });

        res.json(posts);
    } catch (error) {
        console.error('Erro ao buscar posts:', error);
        res.status(500).json({ error: 'Erro ao buscar posts' });
    }
});

// Buscar post por ID
router.get('/:postId', async (req, res) => {
    try {
        const { postId } = req.params;
        const postDoc = await db.collection('posts').doc(postId).get();

        if (!postDoc.exists) {
            return res.status(404).json({ error: 'Post não encontrado' });
        }

        res.json({ id: postDoc.id, ...postDoc.data() });
    } catch (error) {
        console.error('Erro ao buscar post:', error);
        res.status(500).json({ error: 'Erro ao buscar post' });
    }
});

// Curtir/Descurtir post
router.post('/:postId/like', verifyToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.uid;

        const postRef = db.collection('posts').doc(postId);
        const postDoc = await postRef.get();

        if (!postDoc.exists) {
            return res.status(404).json({ error: 'Post não encontrado' });
        }

        const post = postDoc.data();
        const likes = post.likes || [];
        const userLiked = likes.includes(userId);

        if (userLiked) {
            // Remover like
            await postRef.update({
                likes: likes.filter(id => id !== userId),
                likesCount: Math.max(0, (post.likesCount || 0) - 1),
                updatedAt: new Date().toISOString()
            });
            res.json({ success: true, liked: false });
        } else {
            // Adicionar like
            await postRef.update({
                likes: [...likes, userId],
                likesCount: (post.likesCount || 0) + 1,
                updatedAt: new Date().toISOString()
            });

            // Criar notificação se não for o próprio post
            if (post.userId !== userId) {
                const userDoc = await db.collection('users').doc(userId).get();
                const userData = userDoc.data();

                await createNotification(post.userId, 'like', {
                    fromUserId: userId,
                    fromUserName: userData?.displayName || 'Usuário',
                    fromUserAvatar: userData?.avatar || '',
                    postId: postId,
                    postContent: post.content.substring(0, 50)
                });
            }

            res.json({ success: true, liked: true });
        }
    } catch (error) {
        console.error('Erro ao curtir post:', error);
        res.status(500).json({ error: 'Erro ao curtir post' });
    }
});

// Deletar post
router.delete('/:postId', verifyToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.uid;

        const postDoc = await db.collection('posts').doc(postId).get();

        if (!postDoc.exists) {
            return res.status(404).json({ error: 'Post não encontrado' });
        }

        const post = postDoc.data();

        if (post.userId !== userId) {
            return res.status(403).json({ error: 'Não autorizado' });
        }

        await db.collection('posts').doc(postId).delete();

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao deletar post:', error);
        res.status(500).json({ error: 'Erro ao deletar post' });
    }
});

// Buscar posts de um usuário
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20 } = req.query;

        const snapshot = await db.collection('posts')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(parseInt(limit))
            .get();

        const posts = [];
        snapshot.forEach(doc => {
            posts.push({ id: doc.id, ...doc.data() });
        });

        res.json(posts);
    } catch (error) {
        console.error('Erro ao buscar posts do usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar posts do usuário' });
    }
});

// Compartilhar post
router.post('/:postId/share', verifyToken, async (req, res) => {
    try {
        const { postId } = req.params;
        const { comment } = req.body;
        const userId = req.user.uid;

        // Buscar post original
        const originalPostDoc = await db.collection('posts').doc(postId).get();
        if (!originalPostDoc.exists) {
            return res.status(404).json({ error: 'Post não encontrado' });
        }

        const originalPost = originalPostDoc.data();

        // Buscar informações do usuário
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        // Criar post compartilhado
        const sharedPost = {
            userId,
            userDisplayName: userData?.displayName || req.user.name,
            userAvatar: userData?.avatar || '',
            content: comment || '',
            sharedFrom: {
                postId,
                userId: originalPost.userId,
                userDisplayName: originalPost.userDisplayName,
                userAvatar: originalPost.userAvatar,
                content: originalPost.content,
                imageUrl: originalPost.imageUrl || null,
                tags: originalPost.tags || []
            },
            likes: [],
            likesCount: 0,
            commentsCount: 0,
            sharesCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await db.collection('posts').add(sharedPost);

        // Incrementar contador de compartilhamentos no post original
        await db.collection('posts').doc(postId).update({
            sharesCount: (originalPost.sharesCount || 0) + 1
        });

        res.json({ success: true, postId: docRef.id, post: { id: docRef.id, ...sharedPost } });
    } catch (error) {
        console.error('Erro ao compartilhar post:', error);
        res.status(500).json({ error: 'Erro ao compartilhar post' });
    }
});

export default router;
