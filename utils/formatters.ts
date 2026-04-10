export const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '0,00€';
    return `${value.toFixed(2).replace('.', ',')}€`;
};

export const formatNumber = (value: number | undefined | null, decimals: number = 2): string => {
    if (value === undefined || value === null) return '0'.padEnd(decimals + 2, ',0');
    return value.toFixed(decimals).replace('.', ',');
};
