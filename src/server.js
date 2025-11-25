import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', apiRoutes);

// Ruta principal del dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Ruta del dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

export function startServer() {
    app.listen(PORT, () => {
        console.log(`\n🌐 Servidor web corriendo en http://localhost:${PORT}`);
        console.log(`📊 Dashboard disponible en http://localhost:${PORT}/dashboard\n`);
    });
}

export default app;