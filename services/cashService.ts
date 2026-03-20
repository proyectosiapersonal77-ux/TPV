import { db } from '../db';
import { CashRegister, CashMovement } from '../types';
import { queueChange } from './syncService';
import { v4 as uuidv4 } from 'uuid';

export const getCurrentRegister = async (): Promise<CashRegister | null> => {
    // Get the most recently opened register that is still open
    const openRegisters = await db.cash_registers
        .where('status')
        .equals('open')
        .toArray();
    
    if (openRegisters.length > 0) {
        // Sort by opened_at descending just in case, though there should only be one
        return openRegisters.sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())[0];
    }
    return null;
};

export const openRegister = async (openingBalance: number, employeeId: string): Promise<CashRegister> => {
    const current = await getCurrentRegister();
    if (current) {
        throw new Error("Ya hay una caja abierta.");
    }

    const newRegister: CashRegister = {
        id: uuidv4(),
        opened_at: new Date().toISOString(),
        opened_by: employeeId,
        opening_balance: openingBalance,
        status: 'open'
    };

    await db.cash_registers.put(newRegister);
    await queueChange('cash_registers', 'create', newRegister);

    return newRegister;
};

export const closeRegister = async (
    registerId: string, 
    closingBalance: number, 
    employeeId: string, 
    notes?: string
): Promise<CashRegister> => {
    const register = await db.cash_registers.get(registerId);
    if (!register) throw new Error("Caja no encontrada.");
    if (register.status === 'closed') throw new Error("La caja ya está cerrada.");

    const expectedBalance = await getExpectedBalance(registerId);

    const closedRegister: CashRegister = {
        ...register,
        closed_at: new Date().toISOString(),
        closed_by: employeeId,
        closing_balance: closingBalance,
        expected_balance: expectedBalance,
        status: 'closed',
        notes: notes
    };

    await db.cash_registers.put(closedRegister);
    await queueChange('cash_registers', 'update', closedRegister);

    return closedRegister;
};

export const addCashMovement = async (
    registerId: string, 
    type: 'in' | 'out', 
    amount: number, 
    reason: string, 
    employeeId: string
): Promise<CashMovement> => {
    const register = await db.cash_registers.get(registerId);
    if (!register || register.status !== 'open') {
        throw new Error("No hay una caja abierta para registrar el movimiento.");
    }

    const movement: CashMovement = {
        id: uuidv4(),
        register_id: registerId,
        type,
        amount,
        reason,
        employee_id: employeeId,
        created_at: new Date().toISOString()
    };

    await db.cash_movements.put(movement);
    await queueChange('cash_movements', 'create', movement);

    return movement;
};

export const getRegisterMovements = async (registerId: string): Promise<CashMovement[]> => {
    return await db.cash_movements
        .where('register_id')
        .equals(registerId)
        .toArray();
};

export const getExpectedBalance = async (registerId: string): Promise<number> => {
    const register = await db.cash_registers.get(registerId);
    if (!register) return 0;

    const movements = await getRegisterMovements(registerId);
    
    let totalMovements = 0;
    for (const mov of movements) {
        if (mov.type === 'in') totalMovements += mov.amount;
        if (mov.type === 'out') totalMovements -= mov.amount;
    }

    // Calculate cash sales during the open period
    const orders = await db.orders.toArray();
    const cashSales = orders.filter(o => 
        o.status === 'paid' && 
        o.payment_method === 'cash' &&
        new Date(o.closed_at || o.created_at) >= new Date(register.opened_at) &&
        (!register.closed_at || new Date(o.closed_at || o.created_at) <= new Date(register.closed_at))
    ).reduce((acc, o) => acc + (o.total || 0), 0);

    return register.opening_balance + totalMovements + cashSales;
};

export const getCashSales = async (registerId: string): Promise<number> => {
    const register = await db.cash_registers.get(registerId);
    if (!register) return 0;

    const orders = await db.orders.toArray();
    return orders.filter(o => 
        o.status === 'paid' && 
        o.payment_method === 'cash' &&
        new Date(o.closed_at || o.created_at) >= new Date(register.opened_at) &&
        (!register.closed_at || new Date(o.closed_at || o.created_at) <= new Date(register.closed_at))
    ).reduce((acc, o) => acc + (o.total || 0), 0);
};
