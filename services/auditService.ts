import { db } from '../db';
import { queueChange } from './syncService';
import { AuditLog } from '../types';

// Helper to generate UUID v4
function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

export const logAction = async (
    action: string,
    entityType: string,
    entityId: string,
    employeeId: string,
    details: any
): Promise<void> => {
    const auditLog: AuditLog = {
        id: uuidv4(),
        action,
        entity_type: entityType,
        entity_id: entityId,
        employee_id: employeeId,
        details: JSON.stringify(details),
        created_at: new Date().toISOString()
    };

    try {
        await db.audit_logs.put(auditLog);
        await queueChange('audit_logs', 'create', auditLog);
    } catch (e) {
        console.error("Failed to save audit log", e);
    }
};
