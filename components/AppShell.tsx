"use client";
import {useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";

const navigation = [
  {label:"Overview",href:"/dashboard",number:"01"},
  {label:"Practice room",href:"/labs",number:"02"},
  {label:"Talk in English",href:"/talk",number:"03"},
  {label:"Practice plan",href:"/practice-plan",number:"04"},
  {label:"My progress",href:"/dashboard#progress",number:"05"},
  {label:"Recordings",href:"/dashboard#recordings",number:"06"},
  {label:"Creator Studio",href:"/creator",number:"07"},
  {label:"Account settings",href:"/settings",number:"08"},
];

export default function AppShell({children}:{children:React.ReactNode}) {
  const [open,setOpen]=useState(false);
  const pathname=usePathname();
  const date=new Intl.DateTimeFormat("en",{weekday:"long",month:"long",day:"numeric"}).format(new Date());
  return <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
    {open&&<button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={()=>setOpen(false)}/>}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[var(--line)] bg-[var(--surface)] px-5 py-6 transition-transform lg:translate-x-0 ${open?"translate-x-0":"-translate-x-full"}`}>
      <Link href="/" className="flex items-center gap-3 px-3 py-2" onClick={()=>setOpen(false)}>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">c</span>
        <span className="text-[21px] font-semibold tracking-[-.06em]">courant<span className="text-[var(--accent)]">.</span></span>
      </Link>
      <div className="mt-12 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Your workspace</div>
      <nav aria-label="Main navigation" className="mt-3 space-y-1">
        {navigation.map(item=>{
          const active=pathname===item.href || (item.href==="/labs"&&pathname.startsWith("/labs")) || (item.href==="/talk"&&pathname==="/talk") || (item.href==="/creator"&&pathname==="/creator") || (item.href==="/practice-plan"&&pathname==="/practice-plan") || (item.href==="/dashboard"&&pathname==="/dashboard");
          return <Link key={item.href} href={item.href} onClick={()=>setOpen(false)} aria-current={active?"page":undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] transition-colors ${active?"bg-[var(--accent-soft)] font-semibold text-[var(--accent)]":"text-[#666b62] hover:bg-[#f2f1eb] hover:text-[var(--ink)]"}`}>
            <span className="w-5 font-mono text-[10px] opacity-60">{item.number}</span>{item.label}{active&&<span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)]"/>}
          </Link>;
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-[var(--line)] p-4">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--accent)]"/><p className="text-xs font-semibold">A little, often.</p></div>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Ten focused minutes can change how you show up in a conversation.</p>
        <Link href="/labs" className="mt-3 inline-block text-xs font-semibold text-[var(--accent)]">Start a session ↗</Link>
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-[var(--line)] pt-5 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#e9e5d9] text-xs font-semibold">A</div>
        <div><p className="text-xs font-semibold">Alex Morgan</p><p className="mt-1 text-[10px] text-[var(--muted)]">Personal workspace</p></div>
        <Link href="/login" className="ml-auto text-xs text-[var(--muted)]" aria-label="Account settings">↗</Link>
      </div>
    </aside>
    <div className="lg:pl-[260px]">
      <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between border-b border-[var(--line)] bg-[var(--paper)]/95 px-4 backdrop-blur md:px-9">
        <div className="flex items-center gap-3">
          <button aria-label="Open navigation" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] lg:hidden" onClick={()=>setOpen(true)}>☰</button>
          <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted)]">{date}</p><p className="mt-1 text-xs font-medium">A good day to find your words.</p></div>
        </div>
        <Link href="/labs" className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#244735]">New practice <span className="ml-2">↗</span></Link>
      </header>
      <main className="px-4 py-8 md:px-9 md:py-10">{children}</main>
    </div>
  </div>;
}