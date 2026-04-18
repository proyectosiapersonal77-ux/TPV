import { useAuthStore } from '../stores/useAuthStore';

let lastAlertTime = 0;

export const applyTourRestriction = () => {
    const { user } = useAuthStore.getState();
    if (user?.role?.toLowerCase() === 'tour') {
        const now = Date.now();
        // Prevent spamming alerts if multiple service calls happen rapidly
        if (now - lastAlertTime > 1000) {
            alert("Estás en modo Tour. Para realizar cambios, solicita un perfil con permisos de edición.");
            lastAlertTime = now;
        }
        throw new Error("TOUR_MODE_RESTRICTION");
    }
};

export const applyTourRestrictionNoThrow = (): boolean => {
    const { user } = useAuthStore.getState();
    if (user?.role?.toLowerCase() === 'tour') {
        const now = Date.now();
        if (now - lastAlertTime > 1000) {
            alert("Estás en modo Tour. Para realizar cambios, solicita un perfil con permisos de edición.");
            lastAlertTime = now;
        }
        return true;
    }
    return false;
};
