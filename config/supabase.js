import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = 'https://qbxerekjhyvgymnzskco.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
    console.warn('⚠️  SUPABASE_KEY não encontrada no .env. Upload de imagens pode não funcionar.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
