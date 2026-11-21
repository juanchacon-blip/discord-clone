import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

/** Fondo animado: auroras violetas que flotan sobre una rejilla tenue. */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void">
      <div className="animate-float absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-violet-700/40 blur-[120px]" />
      <div className="animate-float-slow absolute -right-32 top-1/4 h-[30rem] w-[30rem] rounded-full bg-fuchsia-600/25 blur-[120px]" />
      <div className="animate-float absolute -bottom-48 left-1/3 h-[32rem] w-[32rem] rounded-full bg-indigo-600/30 blur-[130px]" style={{ animationDelay: '-5s' }} />
      <div className="aurora-grid absolute inset-0" />
    </div>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-[0_0_26px_rgba(168,85,247,.7)]"
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
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)', filter: 'drop-shadow(0 0 7px rgba(232,121,249,.75))' }}
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
    <div className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white shadow-[0_0_14px_rgba(139,92,246,.45)] ${GRADIENTS[hash % GRADIENTS.length]} ${className}`}>
      {(name.trim()[0] || '?').toUpperCase()}
    </div>
  );
}
