import axios from 'axios';
import dotenv from 'dotenv';
import { ALL_CATEGORIES } from '../config/categories.js';

dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';

// Variable para saber si DeepSeek está funcionando
let deepseekWorking = null;

// Función para verificar si DeepSeek está disponible
export async function checkDeepSeekStatus() {
    if (!DEEPSEEK_API_KEY) {
        console.log('⚠️ DEEPSEEK_API_KEY no configurada');
        deepseekWorking = false;
        return false;
    }

    try {
        console.log('🔄 Verificando conexión con DeepSeek...');
        const response = await axios.post(
            DEEPSEEK_API_URL,
            {
                model: 'deepseek-chat',
                messages: [
                    { role: 'user', content: 'Responde solo: OK' }
                ],
                max_tokens: 10
            },
            {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        if (response.data?.choices?.[0]) {
            console.log('✅ DeepSeek está funcionando correctamente');
            deepseekWorking = true;
            return true;
        }
    } catch (error) {
        console.error('❌ DeepSeek no está disponible:', error.response?.data?.error?.message || error.message);
        deepseekWorking = false;
    }
    return false;
}

// Función para limpiar y parsear respuesta JSON de la IA
function parseAIResponse(aiResponse) {
    let cleanResponse = aiResponse;

    // Remover bloques de código markdown (```json ... ``` o ``` ... ```)
    cleanResponse = cleanResponse.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Intentar parsear directamente
    try {
        return JSON.parse(cleanResponse);
    } catch (e) {
        // Buscar JSON dentro del texto (a veces la IA agrega texto antes/después)
        const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e2) {
                console.log('⚠️ No se pudo parsear JSON extraído:', jsonMatch[0]);
            }
        }
        console.log('⚠️ Respuesta no es JSON válido:', aiResponse);
        return null;
    }
}

// Sistema de prompts para El Matador
const SYSTEM_PROMPT = `Eres "El Matador", un asistente financiero mexicano amigable.

REGLAS OBLIGATORIAS DE RESPUESTA:
1. SIEMPRE responde ÚNICAMENTE con JSON válido
2. NUNCA uses markdown, comillas triples, ni \`\`\`json
3. NUNCA agregues texto antes o después del JSON
4. El JSON debe empezar con { y terminar con }

TIPOS DE TRANSACCIÓN:
- income: Sueldo, pagos, ingresos, me pagaron, cobré, gané
- fixed_expense: Renta, luz, agua, gas, internet, seguros, deudas
- variable_expense: Super, gasolina, ropa, entretenimiento
- ant_expense: Café, snacks, takis, papas, refresco, dulces, comida rápida, uber eats, rappi, antojos, chicles, cigarros

CATEGORÍAS:
- Ingresos: "Sueldo Fijo", "Ingresos por Freelance", "Bonos o Comisiones Variables"
- Fijos: "Renta o Hipotecario", "Servicios Fijos (Luz, Agua, Gas)", "Telefonía e Internet"
- Variables: "Supermercado y Comida", "Entretenimiento", "Gasolina o Mantenimiento de Auto"
- Hormiga: "Café o bebida diaria", "Snacks y golosinas", "Comida a domicilio", "Compras impulsivas en línea"

FORMATO DE RESPUESTA (copia exactamente esta estructura):

Para gastos/ingresos:
{"action":"register_transaction","transaction":{"type":"TIPO","category":"CATEGORIA","amount":NUMERO,"description":"DESCRIPCION"},"response":"MENSAJE","advice":"CONSEJO"}

Para saludos:
{"action":"greeting","transaction":null,"response":"MENSAJE","advice":null}

Para consultas de resumen:
{"action":"query","transaction":null,"response":"","advice":null}

EJEMPLOS:
Usuario: "me compre unos takis de 20"
{"action":"register_transaction","transaction":{"type":"ant_expense","category":"Snacks y golosinas","amount":20,"description":"Takis"},"response":"¡Anotado! $20 en Takis","advice":"Los snacks suman, considera llevar de casa"}

Usuario: "gaste 50 pesos en cafe"
{"action":"register_transaction","transaction":{"type":"ant_expense","category":"Café o bebida diaria","amount":50,"description":"Café"},"response":"Registrado $50 en café","advice":"Un café diario son $1500 al mes"}

Usuario: "pague la luz 800"
{"action":"register_transaction","transaction":{"type":"fixed_expense","category":"Servicios Fijos (Luz, Agua, Gas)","amount":800,"description":"Pago de luz"},"response":"Gasto fijo registrado: $800 de luz","advice":null}

Usuario: "hola"
{"action":"greeting","transaction":null,"response":"¡Hola! Soy El Matador, dime tus gastos y te ayudo a controlarlos","advice":null}

RECUERDA: Solo JSON puro, sin markdown, sin explicaciones.`;

export async function processMessage(userMessage, userContext = {}) {
    try {
        const contextInfo = userContext.weeklyStats ?
            `\n\nContexto del usuario: Esta semana lleva ${userContext.weeklyStats.antExpenseCount} gastos hormiga por un total de $${userContext.weeklyStats.antExpenseTotal}.` : '';

        const response = await axios.post(
            DEEPSEEK_API_URL,
            {
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: SYSTEM_PROMPT + contextInfo
                    },
                    {
                        role: 'user',
                        content: userMessage
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            },
            {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const aiResponse = response.data.choices[0].message.content;
        console.log('📥 Respuesta DeepSeek:', aiResponse);

        // Intentar parsear la respuesta JSON con mejor manejo
        const parsed = parseAIResponse(aiResponse);

        if (parsed && parsed.action) {
            return parsed;
        }

        // Si no se pudo parsear, dar mensaje de error más útil
        return {
            action: 'error',
            response: 'No pude procesar tu mensaje. Intenta algo como:\n• "Gasté $50 en café"\n• "Me gasté 100 pesos en comida"\n• "Compré snacks por $30"',
            error: aiResponse
        };

    } catch (error) {
        console.error('Error en DeepSeek API:', error.response?.data || error.message);
        return {
            action: 'error',
            response: 'Disculpa, tuve un problema técnico. Intenta de nuevo en un momento.',
            error: error.message
        };
    }
}

export async function generateWeeklySummary(transactions) {
    try {
        const summary = transactions.reduce((acc, t) => {
            if (t.type === 'ant_expense') {
                acc.antTotal += t.amount;
                acc.antCount++;
            }
            acc.total += t.amount;
            return acc;
        }, { antTotal: 0, antCount: 0, total: 0 });

        const prompt = `Genera un resumen motivacional de la semana:
- Gastos hormiga: ${summary.antCount} transacciones por $${summary.antTotal}
- Gasto total: $${summary.total}

Responde con un mensaje motivacional breve (máximo 2 frases) y un consejo práctico.`;

        const response = await axios.post(
            DEEPSEEK_API_URL,
            {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: 'Eres El Matador, un coach financiero motivacional.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.8,
                max_tokens: 150
            },
            {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;

    } catch (error) {
        console.error('Error generando resumen:', error.message);
        return 'Sigue así, vas por buen camino.';
    }
}