import { Component, input } from '@angular/core';

export type FaceState = 'idle' | 'listening' | 'thinking' | 'speaking';

/** Cara animada de la asistente, solo CSS. La misma idea se reutilizará en la pantalla del dispositivo. */
@Component({
  selector: 'app-face',
  template: `
    <div class="face" [attr.data-state]="state()" role="img" [attr.aria-label]="label()">
      <div class="eyes">
        <span class="eye"></span>
        <span class="eye"></span>
      </div>
      <div class="cheeks"><span></span><span></span></div>
      <div class="mouth"></div>
      <div class="ring"></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .face {
      --size: 132px;
      position: relative;
      width: var(--size);
      height: var(--size);
      margin: 0 auto;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #ffd9a8, #f2a65a 70%, #d9822b);
      box-shadow: inset 0 -8px 18px rgb(120 50 10 / 25%), var(--shadow);
      display: grid;
      place-items: center;
    }
    .eyes { position: absolute; top: 38%; display: flex; gap: 30px; }
    .eye {
      width: 14px; height: 18px; border-radius: 50%; background: #2b211b;
      animation: blink 5s infinite;
    }
    .cheeks { position: absolute; top: 56%; display: flex; gap: 56px; }
    .cheeks span { width: 16px; height: 9px; border-radius: 50%; background: rgb(214 80 60 / 35%); }
    .mouth {
      position: absolute; top: 62%;
      width: 34px; height: 14px;
      border: 4px solid #2b211b; border-top: 0;
      border-radius: 0 0 40px 40px;
      transition: height 0.15s, width 0.15s;
    }
    .ring {
      position: absolute; inset: -10px; border-radius: 50%;
      border: 3px solid transparent;
    }
    .face[data-state='speaking'] .mouth { animation: talk 0.32s infinite alternate; }
    .face[data-state='listening'] .ring { border-color: var(--accent); animation: listen 1.2s infinite; }
    .face[data-state='thinking'] .eye { animation: think 1.6s infinite; height: 14px; }
    .face[data-state='thinking'] .mouth { width: 18px; height: 6px; border-radius: 0 0 12px 12px; }
    @keyframes blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
    @keyframes talk { from { height: 6px; width: 30px; } to { height: 20px; width: 26px; border-radius: 0 0 20px 20px / 0 0 26px 26px; } }
    @keyframes listen { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.12); opacity: 0; } }
    @keyframes think { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(4px) translateY(-3px); } }
  `,
})
export class Face {
  readonly state = input<FaceState>('idle');

  protected label(): string {
    switch (this.state()) {
      case 'listening': return 'La Sazón te está escuchando';
      case 'thinking': return 'La Sazón está pensando';
      case 'speaking': return 'La Sazón está hablando';
      default: return 'La Sazón';
    }
  }
}
