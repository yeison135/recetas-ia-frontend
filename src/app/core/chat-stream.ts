import { Injectable, inject } from '@angular/core';

import { AuthService } from './auth';
import { API_BASE, isUuid } from './config';

export interface ChatStreamEvent {
  type: 'tool' | 'recipe' | 'timer' | 'shopping_list' | 'saved_recipe' | 'meal_plan' | 'favorite' | 'text' | 'done' | 'error';
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Envía un mensaje y lee la respuesta SSE con fetch (EventSource no permite POST ni cabeceras).
 * Si el access token venció, renueva la sesión una vez y reintenta. `signal` permite cancelarla
 * (al salir de la pantalla o cerrar sesión): el servidor deja de llamar al LLM.
 */
@Injectable({ providedIn: 'root' })
export class ChatStream {
  private readonly auth = inject(AuthService);

  async send(conversationId: string, text: string, onEvent: (e: ChatStreamEvent) => void,
             signal?: AbortSignal): Promise<void> {
    if (!isUuid(conversationId)) {
      throw new Error('Conversación inválida');
    }
    let res = await this.post(conversationId, text, signal);
    if (res.status === 401 && (await this.auth.refresh())) {
      res = await this.post(conversationId, text, signal);
    }
    if (!res.ok || !res.body) {
      onEvent({ type: 'error', data: { message: await errorMessage(res) } });
      return;
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = parseEvent(raw);
        if (event) onEvent(event);
      }
    }
  }

  private post(conversationId: string, text: string, signal?: AbortSignal): Promise<Response> {
    return fetch(`${API_BASE}/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${this.auth.accessToken() ?? ''}`,
      },
      body: JSON.stringify({ text }),
      signal,
    });
  }
}

export function parseEvent(raw: string): ChatStreamEvent | null {
  let type = 'message';
  const data: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) type = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (!data.length) return null;
  try {
    return { type: type as ChatStreamEvent['type'], data: JSON.parse(data.join('\n')) };
  } catch {
    return null;
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return body.detail;
  } catch {
    // respuesta sin JSON
  }
  return res.status === 429 ? 'Vas muy rápido. Espera un momento.' : 'No pude conectarme con la cocina.';
}
