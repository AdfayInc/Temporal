// Categorías según los módulos de "El Matador"

export const INCOME_CATEGORIES = {
    SUELDO_FIJO: 'Sueldo Fijo',
    FREELANCE: 'Ingresos por Freelance',
    INVERSIONES: 'Rendimientos de Inversiones',
    ALQUILERES: 'Alquileres',
    BONOS: 'Bonos o Comisiones Variables'
};

export const FIXED_EXPENSE_CATEGORIES = {
    RENTA: 'Renta o Hipotecario',
    SERVICIOS: 'Servicios Fijos (Luz, Agua, Gas)',
    TELEFONIA: 'Telefonía e Internet',
    EDUCACION: 'Colegiaturas o Cursos',
    SEGUROS: 'Seguros (Médicos, Auto, Casa)',
    TRANSPORTE: 'Transporte Público Mensual',
    DEUDAS: 'Deudas con cuota fija'
};

export const VARIABLE_EXPENSE_CATEGORIES = {
    SUPERMERCADO: 'Supermercado y Comida',
    ENTRETENIMIENTO: 'Entretenimiento',
    ROPA: 'Ropa y Accesorios',
    GASOLINA: 'Gasolina o Mantenimiento de Auto',
    EMERGENCIAS: 'Emergencias o Reparaciones'
};

export const ANT_EXPENSE_CATEGORIES = {
    CAFE: 'Café o bebida diaria',
    SUSCRIPCIONES: 'Suscripciones digitales no utilizadas',
    COMISIONES: 'Comisiones bancarias',
    COMPRAS_IMPULSIVAS: 'Compras impulsivas en línea',
    COMIDA_DOMICILIO: 'Comida a domicilio',
    SNACKS: 'Snacks y golosinas',
    OTROS: 'Otros gastos hormiga'
};

export const ALL_CATEGORIES = {
    income: INCOME_CATEGORIES,
    fixed_expense: FIXED_EXPENSE_CATEGORIES,
    variable_expense: VARIABLE_EXPENSE_CATEGORIES,
    ant_expense: ANT_EXPENSE_CATEGORIES
};