import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GoogleAuthProvider } from 'firebase/auth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const googleProvider = new GoogleAuthProvider();

// Tente carregar o arquivo serviceAccountKey.json
let serviceAccount;
try {
    const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    console.log('✅ Service Account Key carregado do arquivo JSON');
} catch (error) {
    console.log('⚠️  Arquivo serviceAccountKey.json não encontrado, usando variáveis de ambiente');
    serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
    };
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || serviceAccount.project_id + '.appspot.com'
});

export const db = admin.firestore();
export const auth = admin.auth();
export const bucket = admin.storage().bucket();

export default admin;
