"use client";
import {useState} from "react";
import Link from "next/link";
export default function Navbar(){
 const [open,setOpen]=useState(false);
 return <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur">
  <div className="container flex h-[72px] items-center justify-between">
   <Link href="/" className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">c</span><span className="text-[21px] font-semibold tracking-[-.06em]">courant<span className="text-[var(--accent)]">.</span></span></Link>
   <nav className="hidden items-center gap-8 text-xs font-medium text-[#666b62] md:flex"><a className="transition hover:text-[var(--ink)]" href="#how">Approach</a><a className="transition hover:text-[var(--ink)]" href="#labs">Practice library</a><a className="transition hover:text-[var(--ink)]" href="#program">Learning path</a><a className="transition hover:text-[var(--ink)]" href="#schools">For schools</a></nav>
   <div className="flex items-center gap-4"><Link className="hidden text-xs font-semibold sm:block" href="/login">Sign in</Link><Link href="/labs" className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#244735]">Try a practice ↗</Link><button aria-label="Toggle navigation" aria-expanded={open} onClick={()=>setOpen(!open)} className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] md:hidden">{open?"×":"☰"}</button></div>
  </div>
  {open&&<nav aria-label="Mobile navigation" className="container flex flex-col gap-4 border-t border-[var(--line)] py-5 text-sm font-medium md:hidden"><a href="#how" onClick={()=>setOpen(false)}>Approach</a><a href="#labs" onClick={()=>setOpen(false)}>Practice library</a><a href="#program" onClick={()=>setOpen(false)}>Learning path</a><a href="#schools" onClick={()=>setOpen(false)}>For schools</a><Link href="/login" onClick={()=>setOpen(false)}>Sign in</Link></nav>}
 </header>;
}