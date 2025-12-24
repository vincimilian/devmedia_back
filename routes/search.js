import express from 'express';
import { db } from '../config/firebase.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Buscar posts, usuários e tags
router.get('/', verifyToken, async (req, res) => {
    try {
        const { q, type = 'all' } = req.query;

        if (!q || q.trim().length < 2) {
            return res.json({ users: [], posts: [], tags: [] });
        }

        const query = q.toLowerCase().trim();
        const results = {
            users: [],
            posts: [],
            tags: []
        };

        // Buscar usuários
        if (type === 'all' || type === 'users') {
            const usersSnapshot = await db.collection('users').limit(50).get();
            usersSnapshot.forEach(doc => {
                const data = doc.data();
                const displayName = (data.displayName || '').toLowerCase();
                if (displayName.includes(query)) {
                    results.users.push({
                        id: doc.id,
                        displayName: data.displayName,
                        avatar: data.avatar,
                        bio: data.bio
                    });
                }
            });
            results.users = results.users.slice(0, 10);
        }

        // Buscar posts
        if (type === 'all' || type === 'posts') {
            const postsSnapshot = await db.collection('posts')
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();

            postsSnapshot.forEach(doc => {
                const data = doc.data();
                const content = (data.content || '').toLowerCase();
                if (content.includes(query)) {
                    results.posts.push({
                        id: doc.id,
                        ...data
                    });
                }
            });
            results.posts = results.posts.slice(0, 10);
        }

        // Buscar por tags
        if (type === 'all' || type === 'tags') {
            const postsSnapshot = await db.collection('posts')
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();

            const tagMatches = new Map();

            postsSnapshot.forEach(doc => {
                const data = doc.data();
                const tags = data.tags || [];

                tags.forEach(tag => {
                    const tagLower = tag.toLowerCase();
                    if (tagLower.includes(query)) {
                        if (!tagMatches.has(tagLower)) {
                            tagMatches.set(tagLower, {
                                tag: tag,
                                count: 0,
                                posts: []
                            });
                        }
                        const tagData = tagMatches.get(tagLower);
                        tagData.count++;
                        if (tagData.posts.length < 3) {
                            tagData.posts.push({
                                id: doc.id,
                                ...data
                            });
                        }
                    }
                });
            });

            results.tags = Array.from(tagMatches.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
        }

        res.json(results);
    } catch (error) {
        console.error('Erro ao buscar:', error);
        res.status(500).json({ error: 'Erro ao buscar' });
    }
});

export default router;
