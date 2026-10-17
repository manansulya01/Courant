"use client";
import {useState} from "react";
import Link from "next/link";

export default function Navbar(){
 const [open,setOpen]=useState(false);
 return <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur-xl">
  <div className="container flex h-[72px] items-center justify-between">
   <Link href="/" aria-label="Courant home" className="group flex items-center gap-3">
    <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white shadow-sm transition-transform duration-300 group-hover:rotate-[-8deg]">c</span>
    <span className="text-[21px] font-semibold tracking-[-.065em]">courant<span className="text-[var(--accent)]">.</span></span>
   </Link>
   <nav aria-label="Main navigation" className="hidden items-center gap-8 text-xs font-medium text-[var(--muted)] md:flex">
    <a className="quiet-link" href="#how">Our approach</a><a className="quiet-link" href="#labs">Practice library</a><a className="quiet-link" href="#program">Learning path</a><a className="quiet-link" href="#schools">For schools</a>
   </nav>
   <div className="flex items-center gap-3 sm:gap-5">
    <Link className="hidden text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--ink)] sm:block" href="/login">Sign in</Link>
    <Link href="/labs" className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-[var(--accent-hover)] sm:px-5">Try a practice <span className="ml-1.5">↗</span></Link>
    <button aria-label={open?"Close navigation":"Open navigation"} aria-expanded={open} onClick={()=>setOpen(!open)} className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-base md:hidden">{open?"×":"☰"}</button>
   </div>
  </div>
  {open&&<nav aria-label="Mobile navigation" className="container flex flex-col gap-1 border-t border-[var(--line)] py-3 text-sm font-medium md:hidden">
   {[[ "Our approach","#how"],["Practice library","#labs"],["Learning path","#program"],["For schools","#schools"]].map(([label,href])=><a key={href} className="rounded-xl px-3 py-3 transition hover:bg-[var(--accent-soft)]" href={href} onClick={()=>setOpen(false)}>{label}<span className="float-right text-[var(--muted)]">↗</span></a>)}
   <Link className="rounded-xl px-3 py-3 transition hover:bg-[var(--accent-soft)]" href="/login" onClick={()=>setOpen(false)}>Sign in</Link>
  </nav>}
 </header>;
}
