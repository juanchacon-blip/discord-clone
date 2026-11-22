import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

/** Fondo: dos auroras violetas muy suaves sobre una rejilla tenue. */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void">
      <div className="animate-float absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-violet-700/30 blur-[140px]" />
      <div className="animate-float-slow absolute -bottom-48 -right-32 h-[30rem] w-[30rem] rounded-full bg-fuchsia-600/15 blur-[140px]" />
      <div className="aurora-grid absolute inset-0" />
    </div>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-[0_0_18px_rgba(168,85,247,.35)]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="white" aria-hidden>
        <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
      </svg>
    </div>
  );
}

/** Tarjeta del Bento Grid: vidrio + foco de luz que sigue al mouse + elevación al pasar. */
export function Bento({ children, className = '', style, onClick }: {
  children: ReactNode; className?: string; style?: CSSProperties; onClick?: () => void;
}) {
  const move = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  const cls = `bento glass group ${className}`;
  return onClick ? (
    <button type="button" onMouseMove={move} onClick={onClick} className={`${cls} text-left`} style={style}>{children}</button>
  ) : (
    <div onMouseMove={move} className={cls} style={style}>{children}</div>
  );
}

/** Número que "cuenta" hasta su valor con una animación suave. */
export function useCountUp(target: number, ms = 900) {
  const [value, setValue] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const from = current.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      current.current = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      setValue(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** Anillo de progreso con degradado y brillo. value va de 0 a 1. */
export function Ring({ value, size = 104, children }: { value: number; size?: number; children?: ReactNode }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(Math.max(0, Math.min(1, value))), 120);
    return () => clearTimeout(t);
  }, [value]);
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c4b5fd" />
            <stop offset="1" stopColor="#e879f9" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(196,181,253,.14)" strokeWidth="9" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ring-grad)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown)}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)', filter: 'drop-shadow(0 0 4px rgba(232,121,249,.4))' }}
        />
      </svg>
      <div className="absolute text-center">{children}</div>
    </div>
  );
}

const GRADIENTS = [
  'from-violet-500 to-fuchsia-500', 'from-indigo-500 to-violet-400', 'from-fuchsia-500 to-pink-400',
  'from-purple-600 to-indigo-400', 'from-violet-400 to-sky-400',
];

/** Avatar con la inicial y un degradado que depende del nombre (siempre el mismo para la misma persona). */
export function Avatar({ name, className = 'h-9 w-9 text-sm' }: { name: string; className?: string }) {
  const hash = [...name].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return (
    <div className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white ${GRADIENTS[hash % GRADIENTS.length]} ${className}`}>
      {(name.trim()[0] || '?').toUpperCase()}
    </div>
  );
}

const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  hash: <path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18" />,
  sliders: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  clip: <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5" />,
  logout: <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" />,
  plus: <path d="M12 5v14M5 12h14" />,
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  send: <path d="M21 3 10 14M21 3l-7 18-4-8-8-4z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
};
export type IconName = keyof typeof ICONS;

/** Iconos de línea (hereda el color del texto). */
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}
