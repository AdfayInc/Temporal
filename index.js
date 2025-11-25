import dotenv from 'dotenv';
import './src/config/database.js'; // Inicializa SQLite automáticamente
import { initializeWhatsApp } from './src/services/whatsapp.js';
import { startServer } from './src/server.js';

// Cargar variables de entorno
dotenv.config();

console.log(`
╔═══════════════════════════════════════╗
║                                       ║
║        🎯 EL MATADOR 🎯              ║
║   Cazador de Gastos Hormiga          ║
║   SQLite + Baileys Edition           ║
║                                       ║
╚═══════════════════════════════════════╝
`);

async function main() {
    try {
        // La base de datos SQLite se inicializa automáticamente al importar
        console.log('✅ Base de datos SQLite lista');

        // Inicializar servidor web
        console.log('🌐 Iniciando servidor web...');
        startServer();

        // Inicializar bot de WhatsApp con Baileys
        console.log('📱 Iniciando bot de WhatsApp con Baileys...');
        await initializeWhatsApp();

        console.log('\n✅ Sistema inicializado correctamente');
        console.log('⏳ Esperando escaneo del código QR...\n');

    } catch (error) {
        console.error('❌ Error al iniciar el sistema:', error);
        process.exit(1);
    }
}

// Manejo de errores no capturados
process.on('unhandledRejection', (error) => {
    console.error('Error no manejado:', error);
});

process.on('SIGINT', () => {
    console.log('\n\n👋 Cerrando El Matador...');
    process.exit(0);
});

// Iniciar aplicación
main();
