import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Crear directorio data si no existe
const dataDir = join(__dirname, '../../data');
if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'el-matador.db');

// Crear instancia de base de datos
const db = new Database(dbPath, { verbose: console.log });

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

// Crear tablas
function initializeDatabase() {
    console.log('Inicializando base de datos SQLite...');

    // Tabla de usuarios
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_number TEXT UNIQUE NOT NULL,
            name TEXT DEFAULT 'Usuario',
            registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            budget_fixed_expenses REAL DEFAULT 0,
            budget_variable_expenses REAL DEFAULT 0,
            budget_ant_expenses REAL DEFAULT 0,
            level TEXT DEFAULT 'Cazador Novato',
            points INTEGER DEFAULT 0,
            last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabla de transacciones
    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            phone_number TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'fixed_expense', 'variable_expense', 'ant_expense')),
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT NOT NULL,
            original_message TEXT NOT NULL,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            month INTEGER NOT NULL,
            year INTEGER NOT NULL,
            is_recurring BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Índices para mejorar el rendimiento
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
        CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_phone ON transactions(phone_number);
        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, year, month);
    `);

    console.log('✅ Base de datos SQLite inicializada correctamente');
}

// Inicializar la base de datos
initializeDatabase();

export default db;