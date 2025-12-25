import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configuração do transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465, // true para 465, false para outras portas
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Templates de email simples
const getEmailTemplate = (type, data) => {
    switch (type) {
        case 'welcome':
            return {
                subject: 'Bem-vindo ao DevMedia!',
                html: `
                    <h1>Olá, ${data.name}!</h1>
                    <p>Seja bem-vindo à nossa comunidade de desenvolvedores.</p>
                    <p>Aproveite para conectar com outros devs e compartilhar conhecimento.</p>
                `
            };
        case 'new_follower':
            return {
                subject: 'Você tem um novo seguidor!',
                html: `
                    <h1>Olá, ${data.name}!</h1>
                    <p><strong>${data.followerName}</strong> começou a seguir você.</p>
                    <a href="${data.actionUrl}">Ver perfil</a>
                `
            };
        case 'new_comment':
            return {
                subject: 'Novo comentário no seu post',
                html: `
                    <h1>Olá, ${data.name}!</h1>
                    <p><strong>${data.commenterName}</strong> comentou no seu post:</p>
                    <blockquote>"${data.commentContent}"</blockquote>
                    <a href="${data.actionUrl}">Ver comentário</a>
                `
            };
        case 'new_like':
            return {
                subject: 'Alguém curtiu seu post',
                html: `
                    <h1>Olá, ${data.name}!</h1>
                    <p><strong>${data.likerName}</strong> curtiu seu post.</p>
                    <a href="${data.actionUrl}">Ver post</a>
                `
            };
        default:
            return {
                subject: 'Nova notificação - DevMedia',
                html: `<p>Você tem uma nova notificação.</p>`
            };
    }
};

/**
 * Envia um email para o usuário
 * @param {string} to - Email do destinatário
 * @param {string} type - Tipo de notificação (welcome, new_follower, etc)
 * @param {object} data - Dados para o template
 */
export const sendEmail = async (to, type, data) => {
    try {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.log('⚠️ Credenciais de email não configuradas. Simulando envio:');
            console.log(`To: ${to}, Type: ${type}, Data:`, data);
            return;
        }

        const template = getEmailTemplate(type, data);

        const info = await transporter.sendMail({
            from: '"DevMedia Team" <noreply@devmedia.com>',
            to,
            subject: template.subject,
            html: template.html,
        });

        console.log('✅ Email enviado:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error);
        // Não lançar erro para não quebrar o fluxo da aplicação
    }
};
