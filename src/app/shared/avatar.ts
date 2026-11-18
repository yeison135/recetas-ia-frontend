import { Component, computed, input } from '@angular/core';

import { AvatarKind, avatarInfo } from '../core/avatars';

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface FaceLayout {
  x: number;
  y: number;
  scale: number;
  color: string;
  cheeks: boolean;
}

/** Dónde va la cara en cada personaje y de qué color (blanca sobre la pantalla del robot). */
const FACES: Record<AvatarKind, FaceLayout> = {
  robot: { x: 100, y: 110, scale: 0.95, color: '#ffffff', cheeks: false },
  olla: { x: 100, y: 124, scale: 0.9, color: '#3b2418', cheeks: true },
  aguacate: { x: 100, y: 92, scale: 0.78, color: '#2c3a12', cheeks: true },
  arepa: { x: 100, y: 116, scale: 0.92, color: '#4a2a10', cheeks: true },
};

/**
 * Avatar de la asistente en estilo 3D suave (SVG con degradados). La cara cambia con el estado:
 * parpadea en reposo, mueve la boca al hablar, abre los ojos al escuchar y mira arriba al pensar.
 */
@Component({
  selector: 'app-avatar',
  template: `
    <svg viewBox="0 0 200 200" [attr.width]="size()" [attr.height]="size()" role="img"
      [attr.aria-label]="label()" [class]="'avatar ' + state()">
      <ellipse class="shadow" cx="100" cy="191" rx="56" ry="7" />
      @if (state() === 'listening') {
        <circle class="ring" cx="100" cy="108" r="92" />
      }
      <g class="body">
        @switch (kind()) {
          @case ('robot') {
            <defs>
              <radialGradient id="rb-body" cx="35%" cy="28%" r="80%">
                <stop offset="0" stop-color="#a8e1ff" /><stop offset="0.45" stop-color="#3aa6ee" /><stop offset="1" stop-color="#1b63b8" />
              </radialGradient>
              <radialGradient id="rb-ball" cx="35%" cy="30%" r="70%">
                <stop offset="0" stop-color="#b9e8ff" /><stop offset="1" stop-color="#1f7fd0" />
              </radialGradient>
              <linearGradient id="rb-screen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#2a3644" /><stop offset="1" stop-color="#151d27" />
              </linearGradient>
            </defs>
            <line x1="100" y1="30" x2="100" y2="52" stroke="#2a8ad8" stroke-width="7" stroke-linecap="round" />
            <circle class="antenna" cx="100" cy="24" r="12" fill="url(#rb-ball)" />
            <rect x="16" y="86" width="28" height="52" rx="14" fill="url(#rb-body)" />
            <rect x="156" y="86" width="28" height="52" rx="14" fill="url(#rb-body)" />
            <rect x="30" y="48" width="140" height="126" rx="46" fill="url(#rb-body)" />
            <rect x="48" y="68" width="104" height="86" rx="30" fill="url(#rb-screen)" />
            <ellipse cx="70" cy="60" rx="24" ry="7" fill="#fff" opacity="0.4" transform="rotate(-14 70 60)" />
          }
          @case ('olla') {
            <defs>
              <radialGradient id="ol-body" cx="32%" cy="25%" r="85%">
                <stop offset="0" stop-color="#ffb08a" /><stop offset="0.5" stop-color="#ef6a3d" /><stop offset="1" stop-color="#b8401f" />
              </radialGradient>
              <linearGradient id="ol-lid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#f1f3f6" /><stop offset="1" stop-color="#a9afba" />
              </linearGradient>
            </defs>
            <g class="steam" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.85">
              <path d="M78 46 q-6 -7 0 -14 q6 -7 0 -14" />
              <path d="M100 42 q-6 -7 0 -14 q6 -7 0 -14" />
              <path d="M122 46 q-6 -7 0 -14 q6 -7 0 -14" />
            </g>
            <rect x="8" y="96" width="32" height="18" rx="9" fill="#3b3b40" />
            <rect x="160" y="96" width="32" height="18" rx="9" fill="#3b3b40" />
            <rect x="28" y="74" width="144" height="104" rx="34" fill="url(#ol-body)" />
            <rect x="24" y="70" width="152" height="16" rx="8" fill="#c94a26" />
            <ellipse cx="100" cy="66" rx="70" ry="14" fill="url(#ol-lid)" />
            <ellipse cx="100" cy="51" rx="15" ry="9" fill="#2d2d33" />
            <ellipse cx="62" cy="98" rx="20" ry="7" fill="#fff" opacity="0.35" transform="rotate(-12 62 98)" />
          }
          @case ('aguacate') {
            <defs>
              <radialGradient id="ag-skin" cx="35%" cy="25%" r="85%">
                <stop offset="0" stop-color="#6fae4a" /><stop offset="0.55" stop-color="#2f6b2c" /><stop offset="1" stop-color="#1b4219" />
              </radialGradient>
              <radialGradient id="ag-flesh" cx="45%" cy="35%" r="75%">
                <stop offset="0" stop-color="#f6fbc4" /><stop offset="0.6" stop-color="#d6ec8a" /><stop offset="1" stop-color="#a9d15a" />
              </radialGradient>
              <radialGradient id="ag-pit" cx="35%" cy="30%" r="75%">
                <stop offset="0" stop-color="#d9935a" /><stop offset="1" stop-color="#7a4520" />
              </radialGradient>
            </defs>
            <path d="M100 16 C132 16 152 60 162 100 C174 152 140 186 100 186 C60 186 26 152 38 100 C48 60 68 16 100 16 Z" fill="url(#ag-skin)" />
            <path d="M100 30 C126 30 142 66 150 102 C160 146 133 174 100 174 C67 174 40 146 50 102 C58 66 74 30 100 30 Z" fill="url(#ag-flesh)" />
            <circle cx="100" cy="138" r="26" fill="url(#ag-pit)" />
            <ellipse cx="91" cy="128" rx="9" ry="5" fill="#fff" opacity="0.35" transform="rotate(-25 91 128)" />
            <ellipse cx="78" cy="56" rx="14" ry="6" fill="#fff" opacity="0.45" transform="rotate(-35 78 56)" />
          }
          @case ('arepa') {
            <defs>
              <radialGradient id="ar-body" cx="38%" cy="30%" r="80%">
                <stop offset="0" stop-color="#fff0b8" /><stop offset="0.5" stop-color="#f6c95e" /><stop offset="1" stop-color="#d4952e" />
              </radialGradient>
            </defs>
            <circle cx="100" cy="110" r="78" fill="url(#ar-body)" />
            <g fill="#a5641f" opacity="0.35">
              <ellipse cx="52" cy="140" rx="7" ry="4" /><ellipse cx="150" cy="132" rx="8" ry="4" />
              <ellipse cx="136" cy="168" rx="6" ry="3" /><ellipse cx="66" cy="166" rx="5" ry="3" />
              <ellipse cx="160" cy="98" rx="5" ry="3" />
            </g>
            <path d="M54 62 Q100 34 146 62 Q150 76 138 76 Q134 92 122 80 Q112 96 102 80 Q90 96 80 80 Q66 88 62 74 Q50 74 54 62 Z" fill="#fffaf0" />
            <ellipse cx="72" cy="64" rx="16" ry="5" fill="#fff" opacity="0.8" transform="rotate(-18 72 64)" />
          }
        }
        <!-- Cara compartida -->
        <g [attr.transform]="faceTransform()">
          <g class="eyes" [attr.transform]="state() === 'thinking' ? 'translate(5 -6)' : null">
            <ellipse class="eye" cx="-22" cy="-4" rx="9" [attr.ry]="state() === 'listening' ? 14 : 12" [attr.fill]="face().color" />
            <ellipse class="eye" cx="22" cy="-4" rx="9" [attr.ry]="state() === 'listening' ? 14 : 12" [attr.fill]="face().color" />
            @if (face().cheeks) {
              <circle cx="-19" cy="-9" r="3" fill="#fff" />
              <circle cx="25" cy="-9" r="3" fill="#fff" />
            }
          </g>
          @if (face().cheeks) {
            <ellipse cx="-38" cy="12" rx="9" ry="5" fill="#ff6b7d" opacity="0.4" />
            <ellipse cx="38" cy="12" rx="9" ry="5" fill="#ff6b7d" opacity="0.4" />
          }
          @switch (state()) {
            @case ('speaking') { <ellipse class="talk" cx="0" cy="17" rx="10" ry="8" [attr.fill]="face().color" /> }
            @case ('listening') { <circle cx="0" cy="17" r="5" [attr.fill]="face().color" /> }
            @case ('thinking') { <path d="M -8 18 L 9 15" fill="none" [attr.stroke]="face().color" stroke-width="5" stroke-linecap="round" /> }
            @default { <path d="M -14 12 Q 0 25 14 12" fill="none" [attr.stroke]="face().color" stroke-width="5" stroke-linecap="round" /> }
          }
        </g>
      </g>
    </svg>
  `,
  styles: `
    :host { display: inline-block; line-height: 0; }
    svg { overflow: visible; }
    .shadow { fill: rgb(0 0 0 / 18%); }
    .body { animation: float 3.2s ease-in-out infinite; transform-origin: center; }
    .eye { transform-box: fill-box; transform-origin: center; animation: blink 5s infinite; }
    .talk { transform-box: fill-box; transform-origin: center; animation: talk 0.28s ease-in-out infinite alternate; }
    .ring { fill: none; stroke: #6bd38a; stroke-width: 5; transform-box: fill-box; transform-origin: center; animation: ring 1.3s ease-out infinite; }
    .steam path { animation: steam 2.4s ease-in-out infinite; }
    .steam path:nth-child(2) { animation-delay: 0.5s; }
    .steam path:nth-child(3) { animation-delay: 1s; }
    .antenna { transform-box: fill-box; transform-origin: center; }
    .thinking .antenna { animation: glow 0.9s ease-in-out infinite alternate; }
    .speaking .body { animation-duration: 1.4s; }
    @keyframes float { 50% { transform: translateY(-4px); } }
    @keyframes blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
    @keyframes talk { from { transform: scaleY(0.35); } to { transform: scaleY(1.1); } }
    @keyframes ring { from { transform: scale(0.94); opacity: 0.9; } to { transform: scale(1.08); opacity: 0; } }
    @keyframes steam { 0% { opacity: 0; transform: translateY(6px); } 40% { opacity: 0.85; } 100% { opacity: 0; transform: translateY(-8px); } }
    @keyframes glow { to { filter: brightness(1.5); transform: scale(1.12); } }
    @media (prefers-reduced-motion: reduce) { .body, .eye, .steam path { animation: none; } }
  `,
})
export class Avatar {
  readonly kind = input<AvatarKind>('robot');
  readonly state = input<AvatarState>('idle');
  readonly size = input(140);

  protected readonly face = computed(() => FACES[this.kind()]);
  protected readonly faceTransform = computed(() => {
    const f = this.face();
    return `translate(${f.x} ${f.y}) scale(${f.scale})`;
  });
  protected readonly label = computed(() => {
    const name = avatarInfo(this.kind()).name;
    switch (this.state()) {
      case 'listening': return `${name} te está escuchando`;
      case 'thinking': return `${name} está pensando`;
      case 'speaking': return `${name} está hablando`;
      default: return name;
    }
  });
}
