import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from 'baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import User from '../models/User.js';
import { processMessage } from './deepseek.js';
import {
    createTransaction,
    getWeeklyStats,
    getMonthlyStats,
    updateLastTransaction,
    getCategoryBreakdown
} from '../controllers/transactionController.js';

let sock;

export async function initializeWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false
    });

    // Evento de actualización de conexión
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Mostrar QR
        if (qr) {
            console.log('\n=================================');
            console.log('Escanea este QR con WhatsApp:');
            console.log('=================================\n');
            qrcode.generate(qr, { small: true });
        }

        // Estado de conexión
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log('Conexión cerrada debido a:', lastDisconnect?.error);

            if (shouldReconnect) {
                console.log('Reconectando...');
                initializeWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('\n✅ El Matador está listo y conectado a WhatsApp con Baileys!');
            console.log('El bot está esperando mensajes...\n');
        }
    });

    // Guardar credenciales cuando se actualicen
    sock.ev.on('creds.update', saveCreds);

    // Manejar mensajes
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const message of messages) {
                if (!message.key.fromMe && message.message) {
                    await handleMessage(message);
                }
            }
        }
    });

    return sock;
}

async function handleMessage(message) {
    try {
        const remoteJid = message.key.remoteJid;

        // SOLO procesar mensajes privados individuales (@s.whatsapp.net)
        // Ignorar todo lo demás
        if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net')) {
            // Ignorar grupos
            if (remoteJid?.includes('@g.us')) {
                console.log('⏭️  Ignorando mensaje de grupo');
                return;
            }
            // Ignorar broadcast
            if (remoteJid?.includes('@broadcast')) {
                console.log('⏭️  Ignorando mensaje de broadcast');
                return;
            }
            // Ignorar estados
            if (remoteJid?.includes('status@broadcast')) {
                console.log('⏭️  Ignorando estado de WhatsApp');
                return;
            }
            // Ignorar cualquier otro tipo
            console.log('⏭️  Ignorando mensaje no privado');
            return;
        }

        // Extraer texto del mensaje
        const messageText = message.message?.conversation ||
                           message.message?.extendedTextMessage?.text ||
                           '';

        // Ignorar mensajes vacíos o sin texto
        if (!messageText.trim()) {
            console.log('⏭️  Ignorando mensaje sin texto');
            return;
        }

        const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
        console.log(`📱 Mensaje privado de ${phoneNumber}: ${messageText}`);

        // Buscar o crear usuario
        let user = User.findByPhone(phoneNumber);
        if (!user) {
            const name = message.pushName || 'Usuario';
            user = User.findOrCreate(phoneNumber, name);

            await sendMessage(phoneNumber,
                `¡Hola! Soy *El Matador*, tu asistente financiero personal. 🎯\n\n` +
                `Estoy aquí para ayudarte a controlar tus gastos hormiga.\n\n` +
                `Solo dime tus gastos de forma natural:\n` +
                `• "Compré un café de $25"\n` +
                `• "Pagué mi renta, $5000"\n` +
                `• "Me pagaron mi sueldo, $15000"\n\n` +
                `También puedes preguntarme:\n` +
                `• "¿Cuánto he gastado este mes?"\n` +
                `• "¿Cuáles son mis gastos hormiga?"\n` +
                `• "Dame un resumen"\n\n` +
                `¡Empecemos a cazar esos gastos hormiga! 🐜`
            );
            return;
        }

        // Actualizar última interacción
        User.updateLastInteraction(user.id);

        // Obtener contexto del usuario
        const weeklyStats = await getWeeklyStats(user.id);
        const userContext = { weeklyStats };

        // Procesar mensaje con DeepSeek
        const aiResponse = await processMessage(messageText, userContext);

        // Manejar según la acción
        switch (aiResponse.action) {
            case 'register_transaction':
                await handleRegisterTransaction(phoneNumber, user, aiResponse, messageText);
                break;

            case 'correction':
                await handleCorrection(phoneNumber, user, aiResponse);
                break;

            case 'query':
                await handleQuery(phoneNumber, user, messageText);
                break;

            case 'advice':
                await sendMessage(phoneNumber, aiResponse.response);
                break;

            case 'greeting':
                await sendMessage(phoneNumber, aiResponse.response);
                break;

            default:
                await sendMessage(phoneNumber, aiResponse.response || 'No entendí bien. ¿Podrías reformular tu mensaje?');
        }

    } catch (error) {
        console.error('Error manejando mensaje:', error);
        const phoneNumber = message.key.remoteJid.replace('@s.whatsapp.net', '');
        await sendMessage(phoneNumber, 'Disculpa, tuve un problema. Intenta de nuevo.');
    }
}

async function handleRegisterTransaction(phoneNumber, user, aiResponse, originalMessage) {
    try {
        const transaction = await createTransaction(
            user.id,
            user.phone_number,
            {
                ...aiResponse.transaction,
                originalMessage
            }
        );

        let reply = `✅ *Registrado!*\n\n`;
        reply += `💰 Monto: $${transaction.amount}\n`;
        reply += `📁 Categoría: ${transaction.category}\n`;
        reply += `📝 ${transaction.description}\n\n`;

        // Agregar consejo si es gasto hormiga
        if (transaction.type === 'ant_expense') {
            const weeklyStats = await getWeeklyStats(user.id);
            reply += `🐜 *Gasto Hormiga detectado*\n`;
            reply += `Esta semana: ${weeklyStats.antExpenseCount} gastos hormiga ($${weeklyStats.antExpenseTotal})\n\n`;

            if (aiResponse.advice) {
                reply += `💡 ${aiResponse.advice}\n\n`;
            }

            // Gamificación - obtener usuario actualizado
            const updatedUser = User.findById(user.id);
            reply += `⭐ +10 puntos | Nivel: ${updatedUser.level}`;
        } else {
            reply += aiResponse.response;
        }

        await sendMessage(phoneNumber, reply);

    } catch (error) {
        console.error('Error registrando transacción:', error);
        await sendMessage(phoneNumber, 'Hubo un error al guardar tu transacción. Intenta de nuevo.');
    }
}

async function handleCorrection(phoneNumber, user, aiResponse) {
    try {
        const updated = await updateLastTransaction(user.id, aiResponse.transaction);

        if (updated) {
            await sendMessage(phoneNumber,
                `✅ *Corregido!*\n\n` +
                `💰 Nuevo monto: $${updated.amount}\n` +
                `📁 ${updated.category}\n` +
                `📝 ${updated.description}`
            );
        } else {
            await sendMessage(phoneNumber, 'No encontré una transacción reciente para corregir.');
        }
    } catch (error) {
        console.error('Error corrigiendo transacción:', error);
        await sendMessage(phoneNumber, 'Hubo un error al corregir. Intenta de nuevo.');
    }
}

async function handleQuery(phoneNumber, user, userMessage) {
    try {
        const lowerMessage = userMessage.toLowerCase();

        if (lowerMessage.includes('mes') || lowerMessage.includes('mensual')) {
            const stats = await getMonthlyStats(user.id);
            const breakdown = await getCategoryBreakdown(user.id, 'month');

            let reply = `📊 *Resumen del Mes*\n\n`;
            reply += `💵 Ingresos: $${stats.income.toFixed(2)}\n`;
            reply += `📌 Gastos Fijos: $${stats.fixedExpenses.toFixed(2)}\n`;
            reply += `📊 Gastos Variables: $${stats.variableExpenses.toFixed(2)}\n`;
            reply += `🐜 Gastos Hormiga: $${stats.antExpenses.total.toFixed(2)} (${stats.antExpenses.count} transacciones)\n\n`;
            reply += `💰 Balance: $${stats.balance.toFixed(2)}\n\n`;

            if (stats.antExpenses.total > 0) {
                const totalExpenses = stats.fixedExpenses + stats.variableExpenses + stats.antExpenses.total;
                if (totalExpenses > 0) {
                    const antPercentage = ((stats.antExpenses.total / totalExpenses) * 100).toFixed(1);
                    reply += `⚠️ Los gastos hormiga representan el ${antPercentage}% de tus gastos totales.\n\n`;

                    if (antPercentage > 15) {
                        reply += `💡 *Recomendación:* Si reduces tus gastos hormiga en 20%, ahorrarías $${(stats.antExpenses.total * 0.2).toFixed(2)} al mes.\n\n`;
                    }
                }
            }

            reply += `📊 _Escribe "ver dashboard" para ver gráficas detalladas_`;

            await sendMessage(phoneNumber, reply);

        } else if (lowerMessage.includes('semana') || lowerMessage.includes('semanal')) {
            const stats = await getWeeklyStats(user.id);

            let reply = `📊 *Resumen de la Semana*\n\n`;
            reply += `📝 Transacciones: ${stats.transactionCount}\n`;
            reply += `💵 Ingresos: $${stats.incomeTotal.toFixed(2)}\n`;
            reply += `💸 Gastos Totales: $${stats.total.toFixed(2)}\n\n`;
            reply += `🐜 Gastos Hormiga: ${stats.antExpenseCount} ($${stats.antExpenseTotal.toFixed(2)})\n\n`;

            if (stats.antExpenseCount > 0) {
                const avgPerDay = (stats.antExpenseTotal / 7).toFixed(2);
                reply += `📈 Promedio diario en gastos hormiga: $${avgPerDay}\n\n`;
            }

            reply += `📊 _Escribe "ver dashboard" para ver gráficas detalladas_`;

            await sendMessage(phoneNumber, reply);

        } else if (lowerMessage.includes('hormiga')) {
            const breakdown = await getCategoryBreakdown(user.id, 'month');
            const antExpenses = Object.entries(breakdown)
                .filter(([_, data]) => data.type === 'ant_expense')
                .sort((a, b) => b[1].total - a[1].total);

            if (antExpenses.length === 0) {
                await sendMessage(phoneNumber, '¡No has registrado gastos hormiga este mes! 🎉');
                return;
            }

            let reply = `🐜 *Tus Gastos Hormiga del Mes*\n\n`;
            antExpenses.forEach(([category, data]) => {
                reply += `• ${category}: $${data.total.toFixed(2)} (${data.count} veces)\n`;
            });

            await sendMessage(phoneNumber, reply);

        } else if (lowerMessage.includes('dashboard') || lowerMessage.includes('visual') || lowerMessage.includes('grafica') || lowerMessage.includes('gráfica') || lowerMessage.includes('detalle') || lowerMessage.includes('completo')) {
            await sendMessage(phoneNumber,
                `📊 *Dashboard Visual*\n\n` +
                `Para ver tus estadísticas de forma más visual y detallada, visita tu dashboard personal:\n\n` +
                `🔗 https://elmatador.adfay.io/\n\n` +
                `*Instrucciones:*\n` +
                `1️⃣ Abre el enlace en tu navegador\n` +
                `2️⃣ Ingresa tu número de teléfono (sin espacios ni guiones)\n` +
                `3️⃣ Explora tus gráficas y estadísticas\n\n` +
                `Ahí podrás ver:\n` +
                `• 📈 Gráficas de gastos por categoría\n` +
                `• 📅 Historial detallado de transacciones\n` +
                `• 🐜 Análisis de gastos hormiga\n` +
                `• 💰 Tendencias de ahorro`
            );
        } else {
            await sendMessage(phoneNumber,
                `Puedo mostrarte:\n\n` +
                `• "Resumen del mes"\n` +
                `• "Resumen de la semana"\n` +
                `• "Mis gastos hormiga"\n` +
                `• "Ver dashboard" - Para gráficas detalladas 📊\n\n` +
                `¿Qué te gustaría ver?`
            );
        }

    } catch (error) {
        console.error('Error en consulta:', error);
        await sendMessage(phoneNumber, 'Hubo un error al obtener tus estadísticas.');
    }
}

// Función para simular delay humano
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Calcular tiempo de escritura basado en longitud del mensaje
function getTypingDelay(text) {
    const baseDelay = 500; // Delay mínimo
    const charsPerSecond = 30; // Velocidad de escritura simulada
    const calculatedDelay = (text.length / charsPerSecond) * 1000;
    // Entre 1 y 4 segundos máximo
    return Math.min(Math.max(calculatedDelay, baseDelay), 4000);
}

async function sendMessage(phoneNumber, text) {
    try {
        const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

        // Simular que está escribiendo
        await sock.sendPresenceUpdate('composing', jid);

        // Esperar tiempo proporcional al mensaje
        const typingTime = getTypingDelay(text);
        await delay(typingTime);

        // Pausar el estado de escribiendo
        await sock.sendPresenceUpdate('paused', jid);

        // Pequeño delay antes de enviar
        await delay(200);

        // Enviar mensaje
        await sock.sendMessage(jid, { text });
    } catch (error) {
        console.error('Error enviando mensaje:', error);
    }
}

export function getClient() {
    return sock;
}
