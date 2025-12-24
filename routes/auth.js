import express from 'express';
import { db } from '../config/firebase.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Criar ou atualizar perfil do usuário
router.post('/profile', verifyToken, async (req, res) => {
    try {
        const { displayName, bio, avatar, skills, github, linkedin, website } = req.body;
        const userId = req.user.uid;

        const userProfile = {
            uid: userId,
            email: req.user.email,
            displayName: displayName || req.user.name,
            bio: bio || '',
            avatar: avatar || '',
            skills: skills || [],
            github: github || '',
            linkedin: linkedin || '',
            website: website || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await db.collection('users').doc(userId).set(userProfile, { merge: true });

        res.json({ success: true, profile: userProfile });
    } catch (error) {
        console.error('Erro ao criar perfil:', error);
        res.status(500).json({ error: 'Erro ao criar perfil' });
    }
});

// Buscar perfil de outro usuário
router.get('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({ id: userDoc.id, ...userDoc.data() });
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
});

// Listar todos os usuários (para enviar posts)
router.get('/users', verifyToken, async (req, res) => {
    try {
        const currentUserId = req.user.uid;
        const usersSnapshot = await db.collection('users').limit(50).get();

        const users = [];
        usersSnapshot.forEach(doc => {
            if (doc.id !== currentUserId) {
                users.push({
                    id: doc.id,
                    displayName: doc.data().displayName,
                    avatar: doc.data().avatar
                });
            }
        });

        res.json(users);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// Obter perfil do usuário autenticado
router.get('/me', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            // Criar perfil básico se não existir
            const basicProfile = {
                uid: userId,
                email: req.user.email,
                displayName: req.user.name,
                bio: '',
                avatar: '',
                skills: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await db.collection('users').doc(userId).set(basicProfile);
            return res.json(basicProfile);
        }

        res.json(userDoc.data());
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
});

export default router;
