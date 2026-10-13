import AppShell from "@/components/AppShell";
import Link from "next/link";

const labs=[
  {slug:"confident-introduction",title:"A confident introduction",description:"Introduce yourself without overthinking every word.",level:"Beginner",time:"5 min",category:"Everyday"},
  {slug:"restaurant",title:"At the restaurant",description:"Ask questions, make a choice and keep the conversation moving.",level:"Beginner",time:"6 min",category:"Everyday"},
  {slug:"job-interview",title:"The job interview",description:"Answer thoughtfully when the questions get specific.",level:"Intermediate",time:"8 min",category:"Work"},
  {slug:"school-presentation",title:"Present an idea",description:"Build a clear argument and handle the follow-up.",level:"Intermediate",time:"7 min",category:"Study"},
  {slug:"storytelling",title:"Tell a good story",description:"Use detail, rhythm and pauses to hold attention.",level:"Advanced",time:"8 min",category:"Creative"},
  {slug:"host-event",title:"Welcome the room",description:"Open an event, make transitions and bring it to a close.",level:"Advanced",time:"10 min",category:"Work"},
];

export default function LabsPage(){return <AppShell><div className="mx-auto max-w-[1120px]">
  <div className="flex flex-col justify-between gap-5 border-b border-[var(--line)] pb-8 md:flex-row md:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">The practice room</p><h1 className="mt-4 text-4xl font-medium leading-tight tracking-[-.055em] sm:text-5xl">Real moments.<br/><span className="italic text-[var(--muted)]">Room to rehearse.</span></h1><p className="mt-4 max-w-lg text-sm leading-6 text-[var(--muted)]">Choose a situation you’d like to feel more ready for. There’s no audience here, and no perfect answer required.</p></div><p className="text-xs text-[var(--muted)]">06 exercises · 3 levels</p></div>
  <div className="mt-4">{labs.map((lab,i)=><Link href={"/labs/"+lab.slug} key={lab.slug} className="group grid gap-4 border-b border-[var(--line)] py-6 transition-colors hover:bg-[#f1f0e9] sm:grid-cols-[56px_1fr_120px_90px_24px] sm:items-center sm:px-3">
    <span className="font-mono text-xs text-[var(--muted)]">0{i+1}</span>
    <div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-[9px] font-bold uppercase tracking-[.15em] text-[var(--accent)]">{lab.category}</span><span className="h-1 w-1 rounded-full bg-[#b9bcb2]"/><span className="text-[10px] text-[var(--muted)]">{lab.level}</span></div><h2 className="text-lg font-medium tracking-[-.025em] sm:text-xl">{lab.title}</h2><p className="mt-1 max-w-xl text-xs leading-5 text-[var(--muted)] sm:text-sm">{lab.description}</p></div>
    <span className="text-xs text-[var(--muted)]">{lab.time}</span><span className="hidden text-xs text-[var(--muted)] sm:block">Open exercise</span><span className="text-lg text-[var(--accent)] transition-transform group-hover:translate-x-1">↗</span>
  </Link>)}</div>
  <div className="mt-8 flex flex-col justify-between gap-3 rounded-[20px] bg-[#e9ede4] p-6 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold">Not sure where to start?</p><p className="mt-1 text-xs leading-5 text-[#626b5f]">Try an introduction. It’s short, useful, and you can repeat it as often as you like.</p></div><Link href="/labs/confident-introduction" className="inline-flex w-fit items-center gap-4 rounded-full bg-[var(--accent)] px-4 py-3 text-xs font-semibold text-white">Start here <span>→</span></Link></div>
</div></AppShell>}