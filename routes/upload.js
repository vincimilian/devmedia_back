import express from 'express';
import multer from 'multer';
import { supabase } from '../config/supabase.js';
import { db } from '../config/firebase.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Configurar multer para upload em memória
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas'));
        }
    }
});

// Upload de imagem para Supabase Storage
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhuma imagem fornecida' });
        }

        const userId = req.user.uid;
        const timestamp = Date.now();
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${userId}/${timestamp}.${fileExt}`;

        // Upload para Supabase Storage
        const { data, error } = await supabase.storage
            .from('image_bucket')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Erro ao fazer upload no Supabase:', error);
            return res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
        }

        // Obter URL pública
        const { data: publicUrlData } = supabase.storage
            .from('image_bucket')
            .getPublicUrl(fileName);

        const publicUrl = publicUrlData.publicUrl;

        res.json({
            success: true,
            url: publicUrl,
            fileName: data.path
        });
    } catch (error) {
        console.error('Erro ao fazer upload:', error);
        res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
    }
});

// Upload de avatar (foto de perfil)
router.post('/avatar', verifyToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhuma imagem fornecida' });
        }

        const userId = req.user.uid;
        const timestamp = Date.now();
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `avatars/${userId}/${timestamp}.${fileExt}`;

        // Upload para Supabase Storage
        const { data, error } = await supabase.storage
            .from('image_bucket')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Erro ao fazer upload no Supabase:', error);
            return res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
        }

        // Obter URL pública
        const { data: publicUrlData } = supabase.storage
            .from('image_bucket')
            .getPublicUrl(fileName);

        const publicUrl = publicUrlData.publicUrl;

        // Atualizar avatar no perfil do usuário
        await db.collection('users').doc(userId).update({
            avatar: publicUrl,
            updatedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            url: publicUrl,
            fileName: data.path
        });
    } catch (error) {
        console.error('Erro ao fazer upload do avatar:', error);
        res.status(500).json({ error: 'Erro ao fazer upload do avatar' });
    }
});

export default router;
