"use client";
import {useState} from "react";
export default function Navbar(){
 const [open,setOpen]=useState(false);
 return <header className="sticky top-0 z-50 border-b border-[#e7e4dc] bg-[#fbfaf7]/90 backdrop-blur">
  <div className="container flex h-20 items-center justify-between">
   <a href="/" className="text-2xl font-black tracking-[-.06em]">courant<span className="text-[#7c5cff]">.</span></a>
   <nav className="hidden md:flex items-center gap-8 text-sm font-semibold"><a href="#superpowers">Superpowers</a><a href="#labs">Labs</a><a href="#program">Program</a><a href="#schools">For schools</a></nav>
   <div className="flex items-center gap-3"><a className="hidden sm:block text-sm font-bold" href="#login">Log in</a><a href="#try" className="rounded-full bg-[#101828] px-5 py-3 text-sm font-bold text-white">Try Courant</a><button onClick={()=>setOpen(!open)} className="md:hidden text-xl">☰</button></div>
  </div>
  {open&&<div className="container pb-5 md:hidden flex flex-col gap-4 font-semibold"><a href="#superpowers">Superpowers</a><a href="#labs">Labs</a><a href="#program">Program</a><a href="#schools">For schools</a></div>}
 </header>
}