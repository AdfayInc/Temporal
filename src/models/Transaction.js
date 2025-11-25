import db from '../config/database.js';

class Transaction {
    // Crear transacción
    static create(data) {
        const stmt = db.prepare(`
            INSERT INTO transactions (
                user_id, phone_number, type, category,
                amount, description, original_message,
                month, year, is_recurring
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const now = new Date();
        const info = stmt.run(
            data.userId,
            data.phoneNumber,
            data.type,
            data.category,
            data.amount,
            data.description,
            data.originalMessage,
            data.month || now.getMonth() + 1,
            data.year || now.getFullYear(),
            data.isRecurring || 0
        );

        return this.findById(info.lastInsertRowid);
    }

    // Buscar por ID
    static findById(id) {
        const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
        return stmt.get(id);
    }

    // Obtener transacciones del mes
    static findByUserAndMonth(userId, month, year) {
        const stmt = db.prepare(`
            SELECT * FROM transactions
            WHERE user_id = ? AND month = ? AND year = ?
            ORDER BY date DESC
        `);
        return stmt.all(userId, month, year);
    }

    // Obtener transacciones de la semana
    static findByUserLastDays(userId, days = 7) {
        const stmt = db.prepare(`
            SELECT * FROM transactions
            WHERE user_id = ?
            AND date >= datetime('now', '-' || ? || ' days')
            ORDER BY date DESC
        `);
        return stmt.all(userId, days);
    }

    // Obtener todas las transacciones de un usuario
    static findByUser(userId, limit = 100) {
        const stmt = db.prepare(`
            SELECT * FROM transactions
            WHERE user_id = ?
            ORDER BY date DESC
            LIMIT ?
        `);
        return stmt.all(userId, limit);
    }

    // Buscar por número de teléfono
    static findByPhone(phoneNumber, limit = 100) {
        const stmt = db.prepare(`
            SELECT * FROM transactions
            WHERE phone_number = ?
            ORDER BY date DESC
            LIMIT ?
        `);
        return stmt.all(phoneNumber, limit);
    }

    // Actualizar última transacción del usuario
    static updateLast(userId, updates) {
        const last = db.prepare(`
            SELECT id FROM transactions
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `).get(userId);

        if (!last) return null;

        const fields = [];
        const values = [];

        if (updates.amount !== undefined) {
            fields.push('amount = ?');
            values.push(updates.amount);
        }
        if (updates.category !== undefined) {
            fields.push('category = ?');
            values.push(updates.category);
        }
        if (updates.description !== undefined) {
            fields.push('description = ?');
            values.push(updates.description);
        }
        if (updates.type !== undefined) {
            fields.push('type = ?');
            values.push(updates.type);
        }

        if (fields.length === 0) return last;

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(last.id);

        const stmt = db.prepare(`
            UPDATE transactions
            SET ${fields.join(', ')}
            WHERE id = ?
        `);

        stmt.run(...values);
        return this.findById(last.id);
    }

    // Eliminar transacción
    static delete(id) {
        const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
        return stmt.run(id);
    }

    // Obtener estadísticas mensuales
    static getMonthlyStats(userId, month, year) {
        const stmt = db.prepare(`
            SELECT
                type,
                SUM(amount) as total,
                COUNT(*) as count
            FROM transactions
            WHERE user_id = ? AND month = ? AND year = ?
            GROUP BY type
        `);

        return stmt.all(userId, month, year);
    }

    // Obtener desglose por categoría
    static getCategoryBreakdown(userId, month, year) {
        const stmt = db.prepare(`
            SELECT
                category,
                type,
                SUM(amount) as total,
                COUNT(*) as count
            FROM transactions
            WHERE user_id = ? AND month = ? AND year = ?
            GROUP BY category, type
            ORDER BY total DESC
        `);

        return stmt.all(userId, month, year);
    }

    // Obtener desglose por categoría de la semana
    static getWeeklyCategoryBreakdown(userId, days = 7) {
        const stmt = db.prepare(`
            SELECT
                category,
                type,
                SUM(amount) as total,
                COUNT(*) as count
            FROM transactions
            WHERE user_id = ?
            AND date >= datetime('now', '-' || ? || ' days')
            GROUP BY category, type
            ORDER BY total DESC
        `);

        return stmt.all(userId, days);
    }

    // Obtener total por tipo
    static getTotalByType(userId, type, month, year) {
        const stmt = db.prepare(`
            SELECT SUM(amount) as total
            FROM transactions
            WHERE user_id = ? AND type = ? AND month = ? AND year = ?
        `);

        const result = stmt.get(userId, type, month, year);
        return result?.total || 0;
    }
}

export default Transaction;