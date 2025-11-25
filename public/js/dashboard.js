const phoneNumber = localStorage.getItem('phoneNumber');

if (!phoneNumber) {
    window.location.href = '/';
}

let currentCategoryType = 'ant_expense';

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserData();
    await loadMonthlyStats();
    await loadCategoryBreakdown(currentCategoryType);
    await loadTransactions();
    setupEventListeners();
});

function setupEventListeners() {
    // Tabs de categorías
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategoryType = tab.dataset.type;
            await loadCategoryBreakdown(currentCategoryType);
        });
    });

    // Botón de cerrar sesión
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('phoneNumber');
        window.location.href = '/';
    });
}

async function loadUserData() {
    try {
        const response = await fetch(`/api/user/${phoneNumber}`);
        const user = await response.json();

        document.getElementById('userName').textContent = user.name || 'Usuario';
        document.getElementById('userLevel').textContent = `Nivel: ${user.level}`;
        document.getElementById('levelDisplay').textContent = user.level;
        document.getElementById('pointsDisplay').textContent = user.points;

        // Calcular progreso para la siguiente nivel
        const levels = {
            'Cazador Novato': { min: 0, max: 200 },
            'Cazador Intermedio': { min: 200, max: 500 },
            'Cazador Experto': { min: 500, max: 1000 },
            'Maestro Cazador': { min: 1000, max: 1000 }
        };

        const currentLevel = levels[user.level];
        const progress = ((user.points - currentLevel.min) / (currentLevel.max - currentLevel.min)) * 100;
        document.getElementById('progressBar').style.width = `${Math.min(progress, 100)}%`;

    } catch (error) {
        console.error('Error cargando datos del usuario:', error);
    }
}

async function loadMonthlyStats() {
    try {
        const response = await fetch(`/api/stats/monthly/${phoneNumber}`);
        const stats = await response.json();

        document.getElementById('totalIncome').textContent = `$${stats.income.toFixed(2)}`;
        const totalExpenses = stats.fixedExpenses + stats.variableExpenses + stats.antExpenses.total;
        document.getElementById('totalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
        document.getElementById('antExpenses').textContent = `$${stats.antExpenses.total.toFixed(2)}`;
        document.getElementById('antCount').textContent = `${stats.antExpenses.count} transacciones`;
        document.getElementById('balance').textContent = `$${stats.balance.toFixed(2)}`;

        // Generar insights
        generateInsights(stats);

    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

async function loadCategoryBreakdown(type) {
    try {
        const response = await fetch(`/api/breakdown/${phoneNumber}?period=month`);
        const breakdown = await response.json();

        const container = document.getElementById('categoryBreakdown');
        container.innerHTML = '';

        const filtered = Object.entries(breakdown)
            .filter(([_, data]) => data.type === type)
            .sort((a, b) => b[1].total - a[1].total);

        if (filtered.length === 0) {
            container.innerHTML = '<p class="loading">No hay transacciones en esta categoría</p>';
            return;
        }

        filtered.forEach(([category, data]) => {
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `
                <div class="category-name">${category}</div>
                <div class="category-stats">
                    <span class="category-count">${data.count} transacciones</span>
                    <span class="category-amount">$${data.total.toFixed(2)}</span>
                </div>
            `;
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Error cargando desglose:', error);
    }
}

async function loadTransactions() {
    try {
        const response = await fetch(`/api/transactions/${phoneNumber}`);
        const transactions = await response.json();

        const container = document.getElementById('transactionsList');
        container.innerHTML = '';

        if (transactions.length === 0) {
            container.innerHTML = '<p class="loading">No hay transacciones registradas</p>';
            return;
        }

        transactions.slice(0, 20).forEach(transaction => {
            const item = document.createElement('div');
            item.className = `transaction-item ${transaction.type}`;

            const date = new Date(transaction.date);
            const formattedDate = date.toLocaleDateString('es-MX', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });

            const icon = getTransactionIcon(transaction.type);

            item.innerHTML = `
                <div class="transaction-info">
                    <div class="transaction-category">${icon} ${transaction.category}</div>
                    <div class="transaction-description">${transaction.description}</div>
                    <div class="transaction-date">${formattedDate}</div>
                </div>
                <div class="transaction-amount">
                    ${transaction.type === 'income' ? '+' : '-'}$${transaction.amount.toFixed(2)}
                </div>
            `;
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Error cargando transacciones:', error);
    }
}

function getTransactionIcon(type) {
    const icons = {
        'income': '💵',
        'fixed_expense': '📌',
        'variable_expense': '📊',
        'ant_expense': '🐜'
    };
    return icons[type] || '💰';
}

function generateInsights(stats) {
    const container = document.getElementById('aiInsights');
    container.innerHTML = '';

    const insights = [];

    // Análisis de gastos hormiga
    const totalExpenses = stats.fixedExpenses + stats.variableExpenses + stats.antExpenses.total;
    if (totalExpenses > 0) {
        const antPercentage = (stats.antExpenses.total / totalExpenses * 100).toFixed(1);

        if (antPercentage > 20) {
            insights.push({
                icon: '⚠️',
                text: `Los gastos hormiga representan el ${antPercentage}% de tus gastos. ¡Hay mucho potencial de ahorro aquí!`
            });
        } else if (antPercentage > 10) {
            insights.push({
                icon: '💡',
                text: `Gastos hormiga al ${antPercentage}%. Reducirlos puede mejorar significativamente tu balance.`
            });
        } else {
            insights.push({
                icon: '✅',
                text: `¡Excelente! Tus gastos hormiga están bajo control (${antPercentage}% del total).`
            });
        }
    }

    // Análisis de balance
    if (stats.balance > 0) {
        const savingsRate = (stats.balance / stats.income * 100).toFixed(1);
        insights.push({
            icon: '💰',
            text: `Estás ahorrando el ${savingsRate}% de tus ingresos. ${savingsRate > 20 ? '¡Increíble!' : 'Sigue mejorando.'}`
        });
    } else if (stats.balance < 0) {
        insights.push({
            icon: '🚨',
            text: `Tus gastos superan tus ingresos por $${Math.abs(stats.balance).toFixed(2)}. Necesitas ajustar tu presupuesto.`
        });
    }

    // Potencial de ahorro
    if (stats.antExpenses.total > 0) {
        const potential = stats.antExpenses.total * 0.3;
        insights.push({
            icon: '🎯',
            text: `Si reduces tus gastos hormiga en 30%, ahorrarías $${potential.toFixed(2)} este mes.`
        });
    }

    // Renderizar insights
    if (insights.length === 0) {
        container.innerHTML = '<p>Registra más transacciones para obtener análisis personalizados.</p>';
    } else {
        insights.forEach(insight => {
            const div = document.createElement('div');
            div.style.marginBottom = '1rem';
            div.innerHTML = `<strong>${insight.icon}</strong> ${insight.text}`;
            container.appendChild(div);
        });
    }
}

// Actualizar datos cada 30 segundos
setInterval(async () => {
    await loadMonthlyStats();
    await loadCategoryBreakdown(currentCategoryType);
    await loadTransactions();
}, 30000);