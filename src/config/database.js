import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Crear directorio data si no existe
const dataDir = join(__dirname, '../../data');
if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'el-matador.db');

let db = null;

// Función para guardar la base de datos a disco
function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        writeFileSync(dbPath, buffer);
    }
}

// Inicializar sql.js y la base de datos
async function initializeDatabase() {
    console.log('Inicializando base de datos SQLite (sql.js)...');

    const SQL = await initSqlJs();

    // Cargar base de datos existente o crear nueva
    if (existsSync(dbPath)) {
        const fileBuffer = readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
        console.log('Base de datos cargada desde archivo existente');
    } else {
        db = new SQL.Database();
        console.log('Nueva base de datos creada');
    }

    // Habilitar foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Tabla de usuarios
    db.run(`
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
    db.run(`
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
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_phone ON transactions(phone_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, year, month)`);

    // Guardar la base de datos inicial
    saveDatabase();

    console.log('✅ Base de datos SQLite inicializada correctamente');

    return db;
}

// Wrapper para mantener compatibilidad con better-sqlite3 API
class DatabaseWrapper {
    constructor() {
        this.db = null;
        this.ready = this.init();
    }

    async init() {
        this.db = await initializeDatabase();
        return this;
    }

    prepare(sql) {
        const self = this;
        return {
            run(...params) {
                self.db.run(sql, params);
                saveDatabase();
                return { changes: self.db.getRowsModified(), lastInsertRowid: self.getLastInsertRowId() };
            },
            get(...params) {
                const stmt = self.db.prepare(sql);
                stmt.bind(params);
                if (stmt.step()) {
                    const row = stmt.getAsObject();
                    stmt.free();
                    return row;
                }
                stmt.free();
                return undefined;
            },
            all(...params) {
                const results = [];
                const stmt = self.db.prepare(sql);
                stmt.bind(params);
                while (stmt.step()) {
                    results.push(stmt.getAsObject());
                }
                stmt.free();
                return results;
            }
        };
    }

    getLastInsertRowId() {
        const result = this.db.exec('SELECT last_insert_rowid() as id');
        return result[0]?.values[0]?.[0] || 0;
    }

    exec(sql) {
        this.db.run(sql);
        saveDatabase();
    }

    pragma(sql) {
        this.db.run(`PRAGMA ${sql}`);
    }
}

const dbWrapper = new DatabaseWrapper();

// Esperar a que la base de datos esté lista antes de exportar
await dbWrapper.ready;

export default dbWrapper;
