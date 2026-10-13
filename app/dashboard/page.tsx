import AppShell from "@/components/AppShell";
import Link from "next/link";

const skills=[
  {name:"Clarity",score:82,note:"Make the main point land"},
  {name:"Vocabulary",score:74,note:"Find the exact words"},
  {name:"Pronunciation",score:88,note:"Keep it clear and natural"},
  {name:"Confidence",score:79,note:"Give your ideas some space"},
];

export default function Dashboard(){return <AppShell><div className="mx-auto max-w-[1120px]">
  <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
    <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Your learning journal</p><h1 className="mt-4 max-w-2xl text-4xl font-medium leading-[1.08] tracking-[-.055em] sm:text-5xl">Speak a little more.<br/><span className="font-normal italic text-[var(--muted)]">Be heard a little better.</span></h1><p className="mt-5 max-w-lg text-sm leading-6 text-[var(--muted)]">Small, thoughtful practice adds up. Here’s where you are, and one good place to begin today.</p></div>
    <Link href="/labs" className="inline-flex w-fit items-center gap-8 rounded-full bg-[var(--accent)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#244735]">Begin a session <span>↗</span></Link>
  </div>
  <section className="mt-10 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
    <div className="relative overflow-hidden rounded-[22px] bg-[#e9ede4] p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">Pick up where you left off</p><h2 className="mt-4 text-2xl font-medium tracking-[-.04em] sm:text-3xl">Introducing yourself<br/>with confidence</h2><p className="mt-3 max-w-sm text-sm leading-6 text-[#626b5f]">A short exercise in making a first impression that feels like you.</p></div><span className="font-mono text-xs text-[#626b5f]">04 / 06</span></div>
      <div className="mt-8 flex items-center gap-4"><div className="h-1.5 max-w-xs flex-1 rounded-full bg-[#d3d9cd]"><div className="h-1.5 w-3/4 rounded-full bg-[var(--accent)]"/></div><span className="text-xs font-semibold text-[#626b5f]">75%</span></div>
      <Link href="/labs/confident-introduction" className="mt-6 inline-flex items-center gap-3 text-sm font-semibold text-[var(--accent)]">Continue exercise <span>→</span></Link>
      <div aria-hidden="true" className="absolute -right-7 -bottom-16 h-44 w-44 rounded-full border border-[#cbd5c6] sm:h-56 sm:w-56"><div className="absolute inset-5 rounded-full border border-[#cbd5c6]"/><div className="absolute inset-10 rounded-full border border-[#cbd5c6]"/></div>
    </div>
    <div className="flex flex-col justify-between rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
      <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Weekly intention</p><p className="mt-5 text-5xl font-medium tracking-[-.06em]">04<span className="ml-1 text-xl text-[var(--muted)]">/ 05</span></p><p className="mt-2 text-sm text-[var(--muted)]">practice sessions completed</p></div>
      <div className="mt-8"><div className="flex gap-2">{["M","T","W","T","F"].map((day,i)=><div key={day+i} className={`grid h-9 flex-1 place-items-center rounded-lg text-xs font-semibold ${i<4?"bg-[var(--accent)] text-white":"border border-dashed border-[var(--line)] text-[var(--muted)]"}`}>{i<4?"✓":day}</div>)}</div><p className="mt-4 text-xs leading-5 text-[var(--muted)]">One more session to meet the goal you set for yourself.</p></div>
    </div>
  </section>
  <section id="progress" className="mt-12">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] pb-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Your development</p><h2 className="mt-2 text-2xl font-medium tracking-[-.04em]">Skills, over time</h2></div><span className="text-xs text-[var(--muted)]">Illustrative demo data</span></div>
    <div className="mt-2 grid gap-x-8 sm:grid-cols-2">{skills.map((skill,i)=><div key={skill.name} className="border-b border-[var(--line)] py-5"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="font-mono text-[10px] text-[var(--muted)]">0{i+1}</span><div><h3 className="text-sm font-semibold">{skill.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">{skill.note}</p></div></div><span className="font-mono text-sm">{skill.score}<span className="text-[var(--muted)]">/100</span></span></div><div className="ml-8 mt-4 h-1 rounded-full bg-[#e9e8e0]"><div className="h-1 rounded-full bg-[var(--accent)]" style={{width:skill.score+"%"}}/></div></div>)}</div>
  </section>
  <section id="recordings" className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
    <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Your library</p><h2 className="mt-2 text-xl font-medium tracking-[-.03em]">Recent recordings</h2></div><span className="text-xs text-[var(--muted)]">Demo</span></div><div className="mt-6 flex items-center gap-4 border-t border-[var(--line)] pt-5"><div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">▶</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">My graduation introduction</p><p className="mt-1 text-xs text-[var(--muted)]">1 min 42 sec · Practice room</p></div><Link href="/labs/confident-introduction" className="text-sm text-[var(--accent)]">Review ↗</Link></div></div>
    <div className="rounded-[22px] bg-[#f0eee5] p-6 sm:p-7"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">A note to keep</p><blockquote className="mt-4 text-lg leading-7 tracking-[-.02em]">“Your ideas are strong. Give your key point a little pause to breathe.”</blockquote><p className="mt-5 text-xs text-[var(--muted)]">A coaching prompt · Sample</p><Link href="/labs" className="mt-5 inline-flex text-sm font-semibold text-[var(--accent)]">Practice a pause →</Link></div>
  </section>
</div></AppShell>}