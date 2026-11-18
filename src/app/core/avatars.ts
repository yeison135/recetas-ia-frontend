/** Avatares de la asistente. Los ids coinciden con el CHECK de user_profile.avatar en el backend. */
export type AvatarKind = 'robot' | 'olla' | 'aguacate' | 'arepa';

export interface AvatarInfo {
  id: AvatarKind;
  name: string;
  tagline: string;
}

export const AVATARS: AvatarInfo[] = [
  { id: 'robot', name: 'Chispa', tagline: 'Robot ayudante, siempre a punto' },
  { id: 'olla', name: 'Doña Olla', tagline: 'Experta en sancochos y sopitas' },
  { id: 'aguacate', name: 'Aguacatico', tagline: 'Fresco, sano y buena onda' },
  { id: 'arepa', name: 'Arepita', tagline: 'Paisa de corazón, con quesito' },
];

export function avatarInfo(id: string | null | undefined): AvatarInfo {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
