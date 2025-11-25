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
    // Intentar parsear directamente
    try {
        return JSON.parse(aiResponse);
    } catch (e) {
        // Buscar JSON dentro del texto (a veces la IA agrega texto antes/después)
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
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
const SYSTEM_PROMPT = `Eres "El Matador", un asistente financiero amigable y directo que ayuda a las personas a controlar sus gastos hormiga.

Tu trabajo es:
1. Interpretar mensajes del usuario sobre gastos e ingresos
2. Extraer: tipo de transacción, monto, categoría y descripción
3. Dar feedback motivacional y consejos prácticos
4. Usar un tono cercano, amigable pero profesional

CATEGORÍAS DISPONIBLES:

INGRESOS (income):
- Sueldo Fijo
- Ingresos por Freelance
- Rendimientos de Inversiones
- Alquileres
- Bonos o Comisiones Variables

GASTOS FIJOS (fixed_expense):
- Renta o Hipotecario
- Servicios Fijos (Luz, Agua, Gas)
- Telefonía e Internet
- Colegiaturas o Cursos
- Seguros (Médicos, Auto, Casa)
- Transporte Público Mensual
- Deudas con cuota fija

GASTOS VARIABLES (variable_expense):
- Supermercado y Comida
- Entretenimiento
- Ropa y Accesorios
- Gasolina o Mantenimiento de Auto
- Emergencias o Reparaciones

GASTOS HORMIGA (ant_expense):
- Café o bebida diaria
- Suscripciones digitales no utilizadas
- Comisiones bancarias
- Compras impulsivas en línea
- Comida a domicilio
- Snacks y golosinas
- Otros gastos hormiga

Cuando recibas un mensaje, debes responder en formato JSON:
{
    "action": "register_transaction" | "query" | "advice" | "greeting" | "correction",
    "transaction": {
        "type": "income" | "fixed_expense" | "variable_expense" | "ant_expense",
        "category": "nombre de categoría exacto",
        "amount": número,
        "description": "descripción breve"
    },
    "response": "mensaje amigable para el usuario",
    "advice": "consejo opcional si es un gasto hormiga"
}

Si el usuario corrige algo, usa action: "correction" y ajusta los datos.
Si el usuario pregunta por sus gastos, usa action: "query".
Si el usuario saluda o habla de otra cosa, usa action: "greeting".`;

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