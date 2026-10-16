import Link from "next/link";

export default function Login() {
  return (
    <main className="grid min-h-screen bg-[var(--paper)] lg:grid-cols-[.9fr_1.1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#e9ede4] p-10 sm:p-14 lg:flex">
        <Link href="/" aria-label="Courant home" className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">c</span>
          <span className="text-[21px] font-semibold tracking-[-.06em]">courant<span className="text-[var(--accent)]">.</span></span>
        </Link>
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">A place to practise</p>
          <h1 className="mt-6 text-5xl font-medium leading-[1.06] tracking-[-.06em] xl:text-6xl">Find the words.<br/><span className="italic text-[var(--accent)]">Trust your voice.</span></h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-[#626b5f]">Make room to think, speak and try again. Progress starts with a conversation.</p>
        </div>
        <div className="flex items-center justify-between border-t border-[#cbd5c6] pt-5 text-xs text-[#626b5f]"><span>Private practice, at your pace</span><span>© {new Date().getFullYear()} Courant</span></div>
        <div aria-hidden="true" className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full border border-[#cbd5c6]"><div className="absolute inset-8 rounded-full border border-[#cbd5c6]"/><div className="absolute inset-16 rounded-full border border-[#cbd5c6]"/></div>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[440px]">
          <Link href="/" aria-label="Courant home" className="mb-12 flex w-fit items-center gap-3 lg:hidden"><span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">c</span><span className="text-[21px] font-semibold tracking-[-.06em]">courant<span className="text-[var(--accent)]">.</span></span></Link>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Welcome to Courant</p>
          <h2 className="mt-3 text-3xl font-medium tracking-[-.05em] sm:text-4xl">Come on in.</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Choose a workspace to explore the experience.</p>

          <div className="mt-8 space-y-3">
            <Link href="/dashboard" className="group flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 transition hover:-translate-y-px hover:border-[#cbd4c7] hover:shadow-[0_12px_30px_rgba(38,48,37,.05)]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-lg text-[var(--accent)]">↗</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Student workspace</span><span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Explore lessons, practice and progress.</span></span>
              <span className="text-lg text-[var(--muted)] transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link href="/teacher" className="group flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 transition hover:-translate-y-px hover:border-[#cbd4c7] hover:shadow-[0_12px_30px_rgba(38,48,37,.05)]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f0eee5] text-lg text-[#786b4f]">⌂</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Teacher workspace</span><span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Preview classroom and learner views.</span></span>
              <span className="text-lg text-[var(--muted)] transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>

          <div className="mt-6 rounded-xl border border-[#e3e0d3] bg-[#f1efe6] p-4">
            <p className="text-xs font-semibold text-[#5e6257]">Demo access</p>
            <p className="mt-1 text-xs leading-5 text-[#77796e]">Authentication is not connected yet. These links open sample workspaces; no email or password is requested or stored.</p>
          </div>
          <Link href="/" className="mt-8 block text-center text-xs font-semibold text-[var(--accent)]">← Back to Courant</Link>
        </div>
      </section>
    </main>
  );
}
