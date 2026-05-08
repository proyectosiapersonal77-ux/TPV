import { supabase } from '../Supabase';

export const SETTINGS_KEYS = {
    BRAND_LOGO: 'brandLogo',
    BRAND_PRIMARY_COLOR: 'brandPrimaryColor',
    THEME_MODE: 'themeMode',
    GLOBAL_SOUNDS_ENABLED: 'globalSoundsEnabled',
    GLOBAL_HAPTICS_ENABLED: 'globalHapticsEnabled',
};

export const fetchAndApplyGlobalSettings = async () => {
    try {
        const { data, error } = await supabase.from('app_settings').select('*');
        if (error) {
            console.error('Error fetching global settings:', error);
            return;
        }

        if (data && data.length > 0) {
            data.forEach((setting) => {
                const key = setting.key;
                const value = setting.value;
                
                // Save to local storage for quick access
                if (value === null) {
                   localStorage.removeItem(key);
                } else {
                   localStorage.setItem(key, value);
                }

                // Apply them visually if needed
                if (key === SETTINGS_KEYS.BRAND_PRIMARY_COLOR) {
                    document.documentElement.style.setProperty('--brand-accent', value);
                    document.documentElement.style.setProperty('--brand-accentHover', value);
                } else if (key === SETTINGS_KEYS.THEME_MODE) {
                    if (value === 'light') {
                        document.documentElement.classList.add('light-mode');
                    } else {
                        document.documentElement.classList.remove('light-mode');
                    }
                }
            });
            // Fire event so open screens can refresh variables that depend on localstorage
            window.dispatchEvent(new Event('brandUpdated'));
            window.dispatchEvent(new Event('globalPreferencesUpdated'));
        }
    } catch (e) {
        console.error('Exception fetching top level settings:', e);
    }
};

export const updateGlobalSetting = async (key: string, value: string | null) => {
    // 1. apply locally first for snappy UI
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
    
    if (key === SETTINGS_KEYS.BRAND_PRIMARY_COLOR && value) {
        document.documentElement.style.setProperty('--brand-accent', value);
        document.documentElement.style.setProperty('--brand-accentHover', value);
    } else if (key === SETTINGS_KEYS.THEME_MODE) {
        if (value === 'light') {
            document.documentElement.classList.add('light-mode');
        } else {
            document.documentElement.classList.remove('light-mode');
        }
    }

    // Fire events depending on key
    if (key === SETTINGS_KEYS.BRAND_LOGO || key === SETTINGS_KEYS.BRAND_PRIMARY_COLOR || key === SETTINGS_KEYS.THEME_MODE) {
        window.dispatchEvent(new Event('brandUpdated'));
    } else if (key === SETTINGS_KEYS.GLOBAL_SOUNDS_ENABLED || key === SETTINGS_KEYS.GLOBAL_HAPTICS_ENABLED) {
        window.dispatchEvent(new Event('globalPreferencesUpdated'));
    }

    // 2. Push to Supabase
    try {
        if (value === null) {
           const { error } = await supabase.from('app_settings').delete().eq('key', key);
           if (error) console.error('Failed to remove setting in Supabase', error);
        } else {
           const { error } = await supabase
               .from('app_settings')
               .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
           
           if (error) {
               console.error('Failed to update setting in Supabase', error);
           }
        }
    } catch (e) {
        console.error('Exception updating setting:', e);
    }
};
