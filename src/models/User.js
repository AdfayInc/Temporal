import db from '../config/database.js';

class User {
    // Crear o encontrar usuario
    static findOrCreate(phoneNumber, name = 'Usuario') {
        const existing = this.findByPhone(phoneNumber);
        if (existing) {
            return existing;
        }

        const stmt = db.prepare(`
            INSERT INTO users (phone_number, name)
            VALUES (?, ?)
        `);

        const info = stmt.run(phoneNumber, name);
        return this.findById(info.lastInsertRowid);
    }

    // Buscar por ID
    static findById(id) {
        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
        return stmt.get(id);
    }

    // Buscar por número de teléfono
    static findByPhone(phoneNumber) {
        const stmt = db.prepare('SELECT * FROM users WHERE phone_number = ?');
        return stmt.get(phoneNumber);
    }

    // Actualizar última interacción
    static updateLastInteraction(id) {
        const stmt = db.prepare(`
            UPDATE users
            SET last_interaction = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        return stmt.run(id);
    }

    // Actualizar puntos y nivel
    static addPoints(id, points) {
        const user = this.findById(id);
        if (!user) return null;

        const newPoints = user.points + points;
        const newLevel = this.calculateLevel(newPoints);

        const stmt = db.prepare(`
            UPDATE users
            SET points = ?,
                level = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(newPoints, newLevel, id);
        return this.findById(id);
    }

    // Calcular nivel basado en puntos
    static calculateLevel(points) {
        if (points >= 1000) return 'Maestro Cazador';
        if (points >= 500) return 'Cazador Experto';
        if (points >= 200) return 'Cazador Intermedio';
        return 'Cazador Novato';
    }

    // Actualizar presupuesto
    static updateBudget(id, budget) {
        const stmt = db.prepare(`
            UPDATE users
            SET budget_fixed_expenses = ?,
                budget_variable_expenses = ?,
                budget_ant_expenses = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        return stmt.run(
            budget.fixed_expenses || 0,
            budget.variable_expenses || 0,
            budget.ant_expenses || 0,
            id
        );
    }

    // Obtener top usuarios por puntos
    static getLeaderboard(limit = 10) {
        const stmt = db.prepare(`
            SELECT id, name, phone_number, points, level
            FROM users
            ORDER BY points DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    // Actualizar nombre
    static updateName(id, name) {
        const stmt = db.prepare(`
            UPDATE users
            SET name = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        return stmt.run(name, id);
    }
}

export default User;