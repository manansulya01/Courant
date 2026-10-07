export default function Hero(){
 return <section className="relative overflow-hidden pt-16 md:pt-24 pb-20">
  <div className="grain absolute inset-0 pointer-events-none"/>
  <div className="container relative grid lg:grid-cols-[1.02fr_.98fr] gap-12 items-center">
   <div><span className="pill">AI-powered speaking practice</span>
    <h1 className="mt-7 text-[clamp(3.5rem,8vw,7.2rem)] leading-[.86] font-black tracking-[-.075em]">Find your<br/><span className="text-[#7c5cff]">voice.</span><br/>Own the room.</h1>
    <p className="mt-7 max-w-xl text-lg leading-8 text-[#667085]">Courant gives every learner a personal AI speaking tutor — for real conversations, instant coaching and confidence that grows session by session.</p>
    <div className="mt-9 flex flex-wrap gap-3"><a id="try" href="#labs" className="rounded-full bg-[#101828] px-6 py-4 font-bold text-white">Start a practice</a><a href="#how" className="rounded-full border border-[#d8d3c8] bg-white px-6 py-4 font-bold">See how it works ↓</a></div>
    <div className="mt-10 flex gap-8 text-sm"><div><b>1:1</b><span className="block text-[#667085]">AI practice</span></div><div><b>14+</b><span className="block text-[#667085]">languages</span></div><div><b>200+</b><span className="block text-[#667085]">scenarios</span></div></div>
   </div>
   <div className="relative"><div className="rounded-[38px] bg-[#e9e4f8] p-4 md:p-6 shadow-[0_30px_80px_rgba(16,24,40,.12)]">
    <div className="rounded-[28px] bg-white p-6 md:p-8">
     <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#c9f76f] text-xl">✦</div><div><b>Courant Coach</b><p className="text-xs text-[#667085]">Live speaking session</p></div></div><span className="rounded-full bg-[#edf9df] px-3 py-1 text-xs font-bold text-[#4f7c18]">● LIVE</span></div>
     <div className="my-10 rounded-3xl bg-[#f5f3ee] p-5"><p className="text-sm text-[#667085]">Coach</p><p className="mt-2 text-xl font-bold">“You’re ordering at a restaurant. I’ll be your server. Ready?”</p><div className="mt-5 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#7c5cff]"/><span className="h-2 w-2 rounded-full bg-[#7c5cff]"/><span className="h-2 w-2 rounded-full bg-[#7c5cff]"/></div></div>
     <div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-[#667085]">Your coaching</p><p className="mt-2 font-bold">Great pace · clearer pronunciation</p></div><div className="text-4xl">🎙️</div></div>
    </div>
   </div><div className="absolute -bottom-5 -left-6 rounded-3xl bg-[#101828] p-5 text-white shadow-xl"><p className="text-xs text-white/60">Confidence</p><p className="text-3xl font-black">+24%</p></div></div>
  </div>
 </section>
}