import express from 'express';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { getMonthlyStats, getCategoryBreakdown } from '../controllers/transactionController.js';

const router = express.Router();

// Obtener usuario por número de teléfono
router.get('/user/:phoneNumber', async (req, res) => {
    try {
        const user = User.findByPhone(req.params.phoneNumber);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener estadísticas mensuales
router.get('/stats/monthly/:phoneNumber', async (req, res) => {
    try {
        const user = User.findByPhone(req.params.phoneNumber);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const stats = await getMonthlyStats(user.id);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener desglose por categoría
router.get('/breakdown/:phoneNumber', async (req, res) => {
    try {
        const user = User.findByPhone(req.params.phoneNumber);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const period = req.query.period || 'month';
        const breakdown = await getCategoryBreakdown(user.id, period);
        res.json(breakdown);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener transacciones del mes actual
router.get('/transactions/:phoneNumber', async (req, res) => {
    try {
        const user = User.findByPhone(req.params.phoneNumber);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();

        const transactions = Transaction.findByUserAndMonth(user.id, month, year);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener todas las transacciones de un usuario
router.get('/transactions/all/:phoneNumber', async (req, res) => {
    try {
        const user = User.findByPhone(req.params.phoneNumber);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const transactions = Transaction.findByUser(user.id, 100);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar presupuesto mensual
router.put('/user/:phoneNumber/budget', async (req, res) => {
    try {
        const user = User.findByPhone(req.params.phoneNumber);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        User.updateBudget(user.id, req.body.monthlyBudget);
        const updatedUser = User.findById(user.id);

        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener ranking de usuarios (gamificación)
router.get('/leaderboard', async (req, res) => {
    try {
        const users = User.getLeaderboard(10);
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug: Ver todos los usuarios registrados
router.get('/debug/users', async (req, res) => {
    try {
        const users = User.getLeaderboard(100); // Reutilizamos esta función
        res.json({
            total: users.length,
            users: users.map(u => ({
                id: u.id,
                phone: u.phone_number,
                name: u.name,
                level: u.level,
                points: u.points
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
