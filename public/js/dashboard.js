const phoneNumber = localStorage.getItem('phoneNumber');

if (!phoneNumber) {
    window.location.href = '/';
}

let currentCategoryType = 'ant_expense';
let currentFilter = 'month';
let customStartDate = null;
let customEndDate = null;
let lastUpdateTime = Date.now();
let allTransactions = [];

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserData();
    await loadAllData();
    setupEventListeners();
    startAutoRefresh();
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

    // Filtros de fecha
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;

            const customRange = document.getElementById('customDateRange');
            if (currentFilter === 'custom') {
                customRange.style.display = 'flex';
            } else {
                customRange.style.display = 'none';
                await loadAllData();
            }
        });
    });

    // Aplicar rango personalizado
    document.getElementById('applyDateRange').addEventListener('click', async () => {
        customStartDate = document.getElementById('startDate').value;
        customEndDate = document.getElementById('endDate').value;
        if (customStartDate && customEndDate) {
            await loadAllData();
        }
    });

    // Exportar CSV
    document.getElementById('exportCSV').addEventListener('click', () => {
        exportToCSV();
    });

    // Exportar Excel
    document.getElementById('exportExcel').addEventListener('click', () => {
        exportToExcel();
    });

    // Botón de cerrar sesión
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('phoneNumber');
        window.location.href = '/';
    });
}

function startAutoRefresh() {
    // Actualizar cada 10 segundos
    setInterval(async () => {
        await loadAllData();
        updateLastUpdateIndicator();
    }, 10000);

    // Actualizar indicador cada segundo
    setInterval(() => {
        updateLastUpdateIndicator();
    }, 1000);
}

function updateLastUpdateIndicator() {
    const seconds = Math.floor((Date.now() - lastUpdateTime) / 1000);
    const indicator = document.getElementById('lastUpdate');
    if (seconds < 60) {
        indicator.textContent = `Actualizado hace ${seconds}s`;
    } else {
        indicator.textContent = `Actualizado hace ${Math.floor(seconds / 60)}m`;
    }
}

async function loadAllData() {
    lastUpdateTime = Date.now();
    await Promise.all([
        loadStats(),
        loadCategoryBreakdown(currentCategoryType),
        loadTransactions()
    ]);
    updateSummaryTitle();
}

function updateSummaryTitle() {
    const titles = {
        'today': 'Resumen de Hoy',
        'week': 'Resumen de la Semana',
        'month': 'Resumen del Mes',
        'custom': 'Resumen Personalizado'
    };
    document.getElementById('summaryTitle').textContent = titles[currentFilter] || 'Resumen';
}

function getDateRange() {
    const now = new Date();
    let startDate, endDate;

    switch (currentFilter) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'week':
            const dayOfWeek = now.getDay();
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            startDate = new Date(now.setDate(diff));
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'custom':
            startDate = customStartDate ? new Date(customStartDate) : new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = customEndDate ? new Date(customEndDate + 'T23:59:59') : new Date();
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date();
    }

    return { startDate, endDate };
}

async function loadUserData() {
    try {
        const response = await fetch(`/api/user/${phoneNumber}`);
        const user = await response.json();

        document.getElementById('userName').textContent = user.name || 'Usuario';
        document.getElementById('userLevel').textContent = `Nivel: ${user.level}`;
        document.getElementById('levelDisplay').textContent = user.level;
        document.getElementById('pointsDisplay').textContent = user.points;

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

async function loadStats() {
    try {
        const response = await fetch(`/api/transactions/${phoneNumber}`);
        allTransactions = await response.json();

        const { startDate, endDate } = getDateRange();

        const filtered = allTransactions.filter(t => {
            const date = new Date(t.date);
            return date >= startDate && date <= endDate;
        });

        const stats = {
            income: 0,
            fixedExpenses: 0,
            variableExpenses: 0,
            antExpenses: { total: 0, count: 0 }
        };

        filtered.forEach(t => {
            if (t.type === 'income') {
                stats.income += t.amount;
            } else if (t.type === 'fixed_expense') {
                stats.fixedExpenses += t.amount;
            } else if (t.type === 'variable_expense') {
                stats.variableExpenses += t.amount;
            } else if (t.type === 'ant_expense') {
                stats.antExpenses.total += t.amount;
                stats.antExpenses.count++;
            }
        });

        stats.balance = stats.income - (stats.fixedExpenses + stats.variableExpenses + stats.antExpenses.total);

        document.getElementById('totalIncome').textContent = `$${stats.income.toFixed(2)}`;
        const totalExpenses = stats.fixedExpenses + stats.variableExpenses + stats.antExpenses.total;
        document.getElementById('totalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
        document.getElementById('antExpenses').textContent = `$${stats.antExpenses.total.toFixed(2)}`;
        document.getElementById('antCount').textContent = `${stats.antExpenses.count} transacciones`;
        document.getElementById('balance').textContent = `$${stats.balance.toFixed(2)}`;

        generateInsights(stats);

    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

async function loadCategoryBreakdown(type) {
    try {
        const { startDate, endDate } = getDateRange();

        const filtered = allTransactions.filter(t => {
            const date = new Date(t.date);
            return date >= startDate && date <= endDate && t.type === type;
        });

        const breakdown = {};
        filtered.forEach(t => {
            if (!breakdown[t.category]) {
                breakdown[t.category] = { total: 0, count: 0, type: t.type };
            }
            breakdown[t.category].total += t.amount;
            breakdown[t.category].count++;
        });

        const container = document.getElementById('categoryBreakdown');
        container.innerHTML = '';

        const sorted = Object.entries(breakdown).sort((a, b) => b[1].total - a[1].total);

        if (sorted.length === 0) {
            container.innerHTML = '<p class="loading">No hay transacciones en esta categoría</p>';
            return;
        }

        sorted.forEach(([category, data]) => {
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
        const { startDate, endDate } = getDateRange();

        const filtered = allTransactions.filter(t => {
            const date = new Date(t.date);
            return date >= startDate && date <= endDate;
        });

        const container = document.getElementById('transactionsList');
        container.innerHTML = '';

        if (filtered.length === 0) {
            container.innerHTML = '<p class="loading">No hay transacciones en este período</p>';
            return;
        }

        filtered.slice(0, 50).forEach(transaction => {
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

    if (stats.income > 0) {
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
    }

    if (stats.antExpenses.total > 0) {
        const potential = stats.antExpenses.total * 0.3;
        insights.push({
            icon: '🎯',
            text: `Si reduces tus gastos hormiga en 30%, ahorrarías $${potential.toFixed(2)} en este período.`
        });
    }

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

function exportToCSV() {
    const { startDate, endDate } = getDateRange();
    const filtered = allTransactions.filter(t => {
        const date = new Date(t.date);
        return date >= startDate && date <= endDate;
    });

    if (filtered.length === 0) {
        alert('No hay transacciones para exportar');
        return;
    }

    const headers = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto'];
    const typeNames = {
        'income': 'Ingreso',
        'fixed_expense': 'Gasto Fijo',
        'variable_expense': 'Gasto Variable',
        'ant_expense': 'Gasto Hormiga'
    };

    const rows = filtered.map(t => {
        const date = new Date(t.date).toLocaleDateString('es-MX');
        return [
            date,
            typeNames[t.type] || t.type,
            t.category,
            t.description,
            t.type === 'income' ? t.amount : -t.amount
        ];
    });

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

    downloadFile(csvContent, 'transacciones.csv', 'text/csv');
}

function exportToExcel() {
    const { startDate, endDate } = getDateRange();
    const filtered = allTransactions.filter(t => {
        const date = new Date(t.date);
        return date >= startDate && date <= endDate;
    });

    if (filtered.length === 0) {
        alert('No hay transacciones para exportar');
        return;
    }

    const typeNames = {
        'income': 'Ingreso',
        'fixed_expense': 'Gasto Fijo',
        'variable_expense': 'Gasto Variable',
        'ant_expense': 'Gasto Hormiga'
    };

    // Crear contenido HTML para Excel
    let html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="UTF-8"></head>
        <body>
        <table border="1">
            <tr style="background:#673AB7;color:white;font-weight:bold;">
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Monto</th>
            </tr>
    `;

    let totalIncome = 0;
    let totalExpenses = 0;

    filtered.forEach(t => {
        const date = new Date(t.date).toLocaleDateString('es-MX');
        const amount = t.type === 'income' ? t.amount : -t.amount;
        const color = t.type === 'income' ? '#00E676' : (t.type === 'ant_expense' ? '#FFC107' : '#FF5252');

        if (t.type === 'income') {
            totalIncome += t.amount;
        } else {
            totalExpenses += t.amount;
        }

        html += `
            <tr>
                <td>${date}</td>
                <td>${typeNames[t.type]}</td>
                <td>${t.category}</td>
                <td>${t.description}</td>
                <td style="color:${color};font-weight:bold;">${amount.toFixed(2)}</td>
            </tr>
        `;
    });

    // Agregar resumen
    html += `
        <tr><td colspan="5"></td></tr>
        <tr style="font-weight:bold;background:#f0f0f0;">
            <td colspan="4">Total Ingresos</td>
            <td style="color:#00E676;">$${totalIncome.toFixed(2)}</td>
        </tr>
        <tr style="font-weight:bold;background:#f0f0f0;">
            <td colspan="4">Total Gastos</td>
            <td style="color:#FF5252;">-$${totalExpenses.toFixed(2)}</td>
        </tr>
        <tr style="font-weight:bold;background:#673AB7;color:white;">
            <td colspan="4">Balance</td>
            <td>$${(totalIncome - totalExpenses).toFixed(2)}</td>
        </tr>
    `;

    html += '</table></body></html>';

    downloadFile(html, 'transacciones.xls', 'application/vnd.ms-excel');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}
