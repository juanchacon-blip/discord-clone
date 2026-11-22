import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Avatar, Logo, Ring } from './ui';

const WORDS = ['modo neón', 'tiempo real', 'la nebulosa'];
const TABS = ['# canales', 'drive.sync', 'alertas'];

/** Escribe y borra palabras en bucle (máquina de escribir). */
function useTyper(words: string[]) {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const [del, setDel] = useState(false);
  useEffect(() => {
    const w = words[i];
    const ms = !del && n === w.length ? 1800 : del && n === 0 ? 350 : del ? 40 : 85;
    const t = setTimeout(() => {
      if (!del && n === w.length) setDel(true);
      else if (del && n === 0) { setDel(false); setI((i + 1) % words.length); }
      else setN(n + (del ? -1 : 1));
    }, ms);
    return () => clearTimeout(t);
  }, [n, del, i, words]);
  return words[i].slice(0, n);
}

const stagger = (i: number, base = 120) => ({ animationDelay: `${base + i * 380}ms` });

function ChatPanel() {
  return (
    <div className="flex flex-col gap-2.5 text-sm">
      <div className="glass animate-rise max-w-[85%] rounded-2xl rounded-tl-md px-4 py-2" style={stagger(0)}>
        <b className="mb-0.5 block text-[11px] text-lavender">Luna</b>¿Viste las fotos del viaje? 🌌
      </div>
      <div className="animate-rise max-w-[85%] self-end rounded-2xl rounded-tr-md bg-gradient-to-br from-violet-600 to-fuchsia-600 px-4 py-2" style={stagger(1)}>
        <b className="mb-0.5 block text-[11px] text-violet-100">Tú</b>¡Increíbles! Ya las respaldé ✨
      </div>
      <div className="glass animate-rise flex w-fit items-center gap-1.5 rounded-2xl rounded-tl-md px-4 py-3" style={stagger(2)}>
        {[0, 1, 2].map(i => <span key={i} className="animate-dot h-1.5 w-1.5 rounded-full bg-lavender" style={{ animationDelay: `${i * 0.16}s` }} />)}
      </div>
    </div>
  );
}

function DrivePanel() {
  const files = [['viaje_01.jpg', '✓ ok'], ['viaje_02.jpg', '✓ ok'], ['viaje_03.jpg', '↻ sync']];
  return (
    <div className="flex items-center gap-5">
      <Ring value={0.82} size={96}><span className="font-display text-xl font-bold">82%</span></Ring>
      <ul className="min-w-0 flex-1 space-y-2.5 font-mono text-xs">
        {files.map(([f, st], i) => (
          <li key={f} className="animate-rise flex justify-between gap-2" style={stagger(i, 100)}>
            <span className="truncate text-violet-200/80">{f}</span>
            <span className={st.startsWith('✓') ? 'text-emerald-300' : 'text-lavender'}>{st}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AlertPanel() {
  const items = [['Luna', 'escribió en #general', '3'], ['Kai', 'escribió en #diseño', '1']];
  return (
    <div className="flex flex-col gap-2.5">
      {items.map(([who, what, n], i) => (
        <div key={who} className="glass animate-pop flex items-center gap-3 rounded-2xl px-4 py-3 text-sm" style={stagger(i, 100)}>
          <Avatar name={who} />
          <p className="min-w-0 flex-1 truncate"><b>{who}</b> <span className="text-violet-200/70">{what}</span></p>
          <span className="rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 px-2 text-xs font-bold">{n}</span>
        </div>
      ))}
    </div>
  );
}

/** Ventana de la app: pestañas que rotan solas y se inclina siguiendo al mouse. */
function AppWindow() {
  const [tab, setTab] = useState(0);
  const [paused, setPaused] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setTab(v => (v + 1) % TABS.length), 5500);
    return () => clearTimeout(t);
  }, [tab, paused]);

  const tilt = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    if (card.current) card.current.style.transform = `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
  };
  const leave = () => { if (card.current) card.current.style.transform = ''; setPaused(false); };

  return (
    <div className="relative mx-auto w-full max-w-md" onMouseMove={tilt} onMouseEnter={() => setPaused(true)} onMouseLeave={leave}>
      <span className="animate-bob glass absolute -right-2 -top-5 z-10 rounded-full px-3 py-1 font-mono text-[11px] text-lavender">● en línea</span>
      <span className="animate-bob glass absolute -bottom-4 -left-3 z-10 rounded-full px-3 py-1 font-mono text-[11px] text-lavender" style={{ animationDelay: '-2.5s' }}>☁ respaldado</span>

      <div ref={card} className="glass-deep scanlines corners relative rounded-3xl transition-transform duration-200 ease-out">
        <div className="flex items-center gap-1 border-b border-white/10 px-3 pt-3 font-mono text-xs">
          {TABS.map((t, i) => (
            <button key={t} type="button" onClick={() => setTab(i)}
              className={`relative px-3 pb-3 transition ${i === tab ? 'text-white' : 'text-violet-300/50 hover:text-violet-200'}`}>
              {t}
              {i === tab && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />}
            </button>
          ))}
        </div>
        <div key={tab} className="animate-fade min-h-[14rem] p-5">
          {tab === 0 ? <ChatPanel /> : tab === 1 ? <DrivePanel /> : <AlertPanel />}
        </div>
      </div>
    </div>
  );
}

/** Horizonte synthwave: sol con franjas y suelo en perspectiva que avanza. */
function Horizon() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[60vh]">
      <div className="synth-sun" />
      <div className="synth-floor" />
    </div>
  );
}

export default function Landing({ onLogin, error }: { onLogin: () => void; error?: string }) {
  const word = useTyper(WORDS);
  // El foco de luz sigue al mouse sin re-renderizar (solo cambia una variable CSS)
  const spot = (e: MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--x', `${e.clientX}px`);
    e.currentTarget.style.setProperty('--y', `${e.clientY}px`);
  };

  return (
    <div className="relative min-h-dvh overflow-hidden" onMouseMove={spot}>
      <Horizon />
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(520px circle at var(--x, 70%) var(--y, 30%), rgba(139,92,246,.13), transparent 60%)' }} />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-6 md:py-8">
        <header className="animate-rise flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <span className="font-display text-xl font-bold tracking-tight">Nebula</span>
          </div>
          <span className="hidden font-mono text-xs tracking-widest text-violet-300/50 sm:block">NEBULA//OS</span>
        </header>

        <main className="my-auto grid items-center gap-14 py-12 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <section className="text-center lg:text-left">
            <p className="animate-rise font-mono text-xs tracking-[.22em] text-lavender/80" style={{ animationDelay: '60ms' }}>
              &gt; nebula.os --iniciar
            </p>
            <h1 className="animate-rise mt-4 font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-6xl xl:text-7xl" style={{ animationDelay: '120ms' }}>
              Conversa en<br />
              <span className="glitch text-gradient" data-text={word}>{word}</span><span className="caret" />
            </h1>
            <p className="animate-rise mx-auto mt-6 max-w-md text-base text-violet-200/70 lg:mx-0" style={{ animationDelay: '200ms' }}>
              Chat en tiempo real, imágenes respaldadas en tu Google Drive y avisos que no se te escapan.
            </p>
            {error && <p className="mt-4 w-fit rounded-xl border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-sm text-rose-200 max-lg:mx-auto">Error: {error}</p>}
            <div className="animate-rise mt-9 flex flex-col items-center gap-4 sm:flex-row lg:justify-start" style={{ animationDelay: '280ms' }}>
              <button className="btn-glow group rounded-full px-9 py-3.5 text-base font-bold" onClick={onLogin}>
                Iniciar sesión <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </button>
              <span className="font-mono text-xs text-violet-300/50">// acceso seguro con Auth0</span>
            </div>
          </section>

          <AppWindow />
        </main>
      </div>
    </div>
  );
}
