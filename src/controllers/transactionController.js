import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

export async function createTransaction(userId, phoneNumber, transactionData) {
    try {
        const transaction = Transaction.create({
            userId,
            phoneNumber,
            type: transactionData.type,
            category: transactionData.category,
            amount: transactionData.amount,
            description: transactionData.description,
            originalMessage: transactionData.originalMessage,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
        });

        // Actualizar puntos del usuario si es un registro de gasto hormiga
        if (transactionData.type === 'ant_expense') {
            User.addPoints(userId, 10);
        }

        return transaction;
    } catch (error) {
        console.error('Error creando transacción:', error);
        throw error;
    }
}

export async function getWeeklyStats(userId) {
    try {
        const transactions = Transaction.findByUserLastDays(userId, 7);

        const stats = transactions.reduce((acc, t) => {
            acc.total += t.amount;

            if (t.type === 'ant_expense') {
                acc.antExpenseCount++;
                acc.antExpenseTotal += t.amount;
            } else if (t.type === 'fixed_expense') {
                acc.fixedExpenseTotal += t.amount;
            } else if (t.type === 'variable_expense') {
                acc.variableExpenseTotal += t.amount;
            } else if (t.type === 'income') {
                acc.incomeTotal += t.amount;
            }

            return acc;
        }, {
            total: 0,
            antExpenseCount: 0,
            antExpenseTotal: 0,
            fixedExpenseTotal: 0,
            variableExpenseTotal: 0,
            incomeTotal: 0,
            transactionCount: transactions.length
        });

        return stats;
    } catch (error) {
        console.error('Error obteniendo estadísticas semanales:', error);
        throw error;
    }
}

export async function getMonthlyStats(userId) {
    try {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const transactions = Transaction.findByUserAndMonth(userId, currentMonth, currentYear);
        const statsData = Transaction.getMonthlyStats(userId, currentMonth, currentYear);

        // Organizar estadísticas por tipo
        const stats = {
            income: 0,
            fixedExpenses: 0,
            variableExpenses: 0,
            antExpenses: { total: 0, count: 0 },
            transactions
        };

        statsData.forEach(item => {
            if (item.type === 'income') {
                stats.income = item.total;
            } else if (item.type === 'fixed_expense') {
                stats.fixedExpenses = item.total;
            } else if (item.type === 'variable_expense') {
                stats.variableExpenses = item.total;
            } else if (item.type === 'ant_expense') {
                stats.antExpenses.total = item.total;
                stats.antExpenses.count = item.count;
            }
        });

        stats.balance = stats.income - (stats.fixedExpenses + stats.variableExpenses + stats.antExpenses.total);

        return stats;
    } catch (error) {
        console.error('Error obteniendo estadísticas mensuales:', error);
        throw error;
    }
}

export async function updateLastTransaction(userId, updates) {
    try {
        return Transaction.updateLast(userId, updates);
    } catch (error) {
        console.error('Error actualizando última transacción:', error);
        throw error;
    }
}

export async function getCategoryBreakdown(userId, period = 'month') {
    try {
        let breakdown;

        if (period === 'month') {
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            breakdown = Transaction.getCategoryBreakdown(userId, currentMonth, currentYear);
        } else if (period === 'week') {
            breakdown = Transaction.getWeeklyCategoryBreakdown(userId, 7);
        }

        // Convertir a formato de objeto
        const result = {};
        breakdown.forEach(item => {
            result[item.category] = {
                total: item.total,
                count: item.count,
                type: item.type
            };
        });

        return result;
    } catch (error) {
        console.error('Error obteniendo desglose por categoría:', error);
        throw error;
    }
}
