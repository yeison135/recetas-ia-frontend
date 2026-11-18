import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Api } from './api';
import { AuthService } from './auth';
import { AvatarKind, avatarInfo } from './avatars';

/** Avatar elegido por la persona; se carga al entrar y se actualiza al cambiarlo en el perfil. */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly api = inject(Api);
  readonly avatar = signal<AvatarKind>('robot');
  readonly avatarName = computed(() => avatarInfo(this.avatar()).name);

  constructor() {
    inject(AuthService).loggedOut.subscribe(() => this.avatar.set('robot'));
  }

  async load(): Promise<void> {
    try {
      const p = await firstValueFrom(this.api.profile());
      this.avatar.set(avatarInfo(p.avatar).id);
    } catch {
      // Sin perfil (red caída): se queda el avatar por defecto.
    }
  }
}
