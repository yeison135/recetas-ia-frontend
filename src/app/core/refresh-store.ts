import { IS_NATIVE } from './config';

const KEY = 'sazon.rt';

/**
 * Dónde vive el refresh token en la app nativa: almacenamiento seguro respaldado por el
 * Android Keystore. En la web no se usa: el refresh va en una cookie HttpOnly que JavaScript no ve.
 */
export const RefreshStore = {
  async get(): Promise<string | null> {
    if (!IS_NATIVE) return null;
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
    const value = await SecureStorage.get(KEY);
    return typeof value === 'string' ? value : null;
  },

  async set(token: string): Promise<void> {
    if (!IS_NATIVE) return;
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
    await SecureStorage.set(KEY, token);
  },

  async clear(): Promise<void> {
    if (!IS_NATIVE) return;
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
    await SecureStorage.remove(KEY);
  },
};
