document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const phoneNumber = document.getElementById('phoneNumber').value.trim();

    // Validar número de teléfono (10 dígitos o más)
    if (!/^[0-9]{10,}$/.test(phoneNumber)) {
        alert('Por favor ingresa un número de teléfono válido (mínimo 10 dígitos)');
        return;
    }

    // Intentar con diferentes formatos del número
    const phoneVariants = [
        phoneNumber,                           // 7714539343
        `52${phoneNumber}`,                    // 527714539343
        `521${phoneNumber}`,                   // 5217714539343
        phoneNumber.replace(/^52/, ''),        // Si ingresó con 52
        phoneNumber.replace(/^521/, '')        // Si ingresó con 521
    ];

    // Eliminar duplicados
    const uniqueVariants = [...new Set(phoneVariants)].filter(p => p && p.length >= 10);

    // Verificar si el usuario existe con alguna variante
    try {
        let foundPhone = null;

        for (const variant of uniqueVariants) {
            const response = await fetch(`/api/user/${variant}`);
            if (response.ok) {
                foundPhone = variant;
                break;
            }
        }

        if (foundPhone) {
            // Usuario encontrado, guardar el número real y redirigir
            localStorage.setItem('phoneNumber', foundPhone);
            window.location.href = '/dashboard';
        } else {
            // Usuario no existe con ninguna variante
            alert(
                'No encontramos tu usuario.\n\n' +
                'Para usar El Matador:\n' +
                '1. Envía un mensaje al bot de WhatsApp\n' +
                '2. Espera la respuesta de bienvenida\n' +
                '3. Luego podrás acceder a tu dashboard aquí\n\n' +
                'Si ya enviaste un mensaje, verifica tu número de teléfono.'
            );
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Hubo un problema al conectar con el servidor. Intenta de nuevo.');
    }
});

// Auto-completar si ya hay un número guardado
window.addEventListener('DOMContentLoaded', () => {
    const savedPhone = localStorage.getItem('phoneNumber');
    if (savedPhone) {
        document.getElementById('phoneNumber').value = savedPhone;
    }
});