import axios from 'axios';
import dotenv from 'dotenv';
import { ALL_CATEGORIES } from '../config/categories.js';

dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL;

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

        // Intentar parsear la respuesta JSON
        try {
            const parsed = JSON.parse(aiResponse);
            return parsed;
        } catch (parseError) {
            // Si no es JSON válido, crear una respuesta de error amigable
            return {
                action: 'error',
                response: 'Perdón, no entendí bien. ¿Podrías decirme de nuevo tu gasto? Por ejemplo: "Compré un café de $25"',
                error: aiResponse
            };
        }

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