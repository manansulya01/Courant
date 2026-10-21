import Link from "next/link";
export default function Hero(){
 return <section className="relative overflow-hidden py-16 md:py-24">
  <div className="container relative grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
   <div><span className="pill">A quieter way to build confidence</span>
    <h1 className="mt-7 text-[clamp(3.4rem,7.6vw,6.7rem)] font-medium leading-[.91] tracking-[-.075em]">Find your<br/><span className="font-normal italic text-[var(--accent)]">own voice.</span></h1>
    <p className="mt-7 max-w-lg text-base leading-8 text-[var(--muted)] md:text-lg">Practise English by talking naturally with Courant. Start a live voice conversation, get helpful corrections as you speak, and build confidence at your own pace.</p>
    <div className="mt-8 flex flex-wrap gap-3"><Link href="/live-call" className="rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#244735]">Start a live voice conversation <span className="ml-2">↗</span></Link><Link href="/talk" className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-6 py-3.5 text-sm font-semibold transition hover:bg-white">Try a guided chat</Link><a href="#how" className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-6 py-3.5 text-sm font-semibold transition hover:bg-white">How it works ↓</a></div>
    <div className="mt-12 flex flex-wrap gap-x-9 gap-y-4 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)]"><div><span className="block text-lg font-medium text-[var(--ink)]">Speak naturally</span>hands-free conversation</div><div><span className="block text-lg font-medium text-[var(--ink)]">Learn as you talk</span>gentle English coaching</div><div><span className="block text-lg font-medium text-[var(--ink)]">At your pace</span>beginner to advanced</div></div>
   </div>
   <div className="relative">
    <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_20px_60px_rgba(30,35,28,.05)] sm:p-7">
     <div className="flex items-center justify-between border-b border-[var(--line)] pb-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-soft)] font-medium text-[var(--accent)]">c.</div><div><p className="text-sm font-semibold">Your English conversation partner</p><p className="mt-1 text-xs text-[var(--muted)]">Listen, speak, and keep going</p></div></div><span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">LIVE PRACTICE</span></div>
     <div className="py-9 sm:py-12"><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">A conversation can start with</p><p className="mt-4 max-w-sm text-2xl font-medium leading-snug tracking-[-.04em] sm:text-3xl">“Hey! How has your day been?”</p><p className="mt-4 max-w-sm text-sm leading-6 text-[var(--muted)]">Answer out loud. Courant listens, replies in a natural voice, and helps you express yourself more clearly.</p></div>
     <div className="flex items-center justify-between border-t border-[var(--line)] pt-5"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--accent)]"/><span className="text-xs text-[var(--muted)]">Ready when you are</span></div><Link href="/live-call" className="text-sm font-semibold text-[var(--accent)]">Start speaking ↗</Link></div>
    </div>
    <div aria-hidden="true" className="absolute -right-4 -top-4 -z-10 h-24 w-24 rounded-full border border-[#d9dfd1] sm:-right-7 sm:-top-7 sm:h-32 sm:w-32"/><div aria-hidden="true" className="absolute -bottom-5 -left-5 -z-10 h-20 w-20 rounded-full bg-[#e9ede4] sm:-bottom-7 sm:-left-7 sm:h-28 sm:w-28"/>
   </div>
  </div>
 </section>
}