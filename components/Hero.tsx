import Link from "next/link";
export default function Hero(){
 return <section className="relative overflow-hidden py-16 md:py-24 lg:py-28">
  <div className="container relative grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
   <div className="rise-in">
    <span className="pill"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"/> A quieter way to build confidence</span>
    <h1 className="mt-7 text-[clamp(3.4rem,7.6vw,6.7rem)] font-medium leading-[.91] tracking-[-.078em]">Find your<br/><span className="font-normal italic text-[var(--accent)]">own voice.</span></h1>
    <p className="mt-7 max-w-lg text-base leading-8 text-[var(--muted)] md:text-lg">A thoughtful place to practise the conversations that matter. Find your words, try again, and build confidence at your own pace.</p>
    <div className="mt-8 flex flex-wrap gap-3"><Link href="/labs" className="group rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-[var(--accent-hover)]">Find a practice <span className="ml-4 inline-block transition-transform group-hover:translate-x-1">↗</span></Link><a href="#how" className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-6 py-3.5 text-sm font-semibold transition hover:border-[#cbd4c7] hover:bg-white">How it works <span className="ml-2 text-[var(--muted)]">↓</span></a></div>
    <div className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)] sm:gap-7"><div><span className="mb-1 block text-base font-medium text-[var(--ink)] sm:text-lg">One-to-one</span>Private practice</div><div><span className="mb-1 block text-base font-medium text-[var(--ink)] sm:text-lg">At your pace</span>Repeat whenever</div><div><span className="mb-1 block text-base font-medium text-[var(--ink)] sm:text-lg">Your progress</span>Small steps</div></div>
   </div>
   <div className="relative rise-in lg:[animation-delay:100ms]">
    <div className="absolute -inset-3 rounded-[34px] bg-[#eeeee5] sm:-inset-5"/>
    <div className="relative rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_24px_70px_rgba(30,35,28,.07)] sm:p-7">
     <div className="flex items-center justify-between border-b border-[var(--line)] pb-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-soft)] font-medium text-[var(--accent)]">c.</div><div><p className="text-sm font-semibold">Practice, privately</p><p className="mt-1 text-xs text-[var(--muted)]">A moment to think out loud</p></div></div><span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Exercise 01</span></div>
     <div className="py-9 sm:py-12"><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">A prompt to begin</p><p className="mt-4 max-w-sm text-2xl font-medium leading-snug tracking-[-.045em] sm:text-3xl">“Tell me about something you’re proud of.”</p><p className="mt-4 max-w-sm text-sm leading-6 text-[var(--muted)]">Take a breath. There’s no timer and no need to get it perfect on the first try.</p></div>
     <div className="flex items-center justify-between border-t border-[var(--line)] pt-5"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--accent)]"/><span className="text-xs text-[var(--muted)]">Ready when you are</span></div><Link href="/labs/confident-introduction" className="group text-sm font-semibold text-[var(--accent)]">Begin <span className="inline-block transition-transform group-hover:translate-x-1">↗</span></Link></div>
    </div>
    <div aria-hidden="true" className="absolute -right-4 -top-4 -z-10 h-24 w-24 rounded-full border border-[#d9dfd1] sm:-right-7 sm:-top-7 sm:h-32 sm:w-32"/><div aria-hidden="true" className="absolute -bottom-5 -left-5 -z-10 h-20 w-20 rounded-full bg-[#dfe7d9] sm:-bottom-7 sm:-left-7 sm:h-28 sm:w-28"/>
   </div>
  </div>
 </section>
}
