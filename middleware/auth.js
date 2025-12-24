import { auth } from '../config/firebase.js';

export const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        const token = authHeader.split('Bearer ')[1];

        const decodedToken = await auth.verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email
        };

        next();
    } catch (error) {
        console.error('Erro ao verificar token:', error);
        return res.status(401).json({ error: 'Token inválido' });
    }
};
