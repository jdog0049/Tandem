import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BookOpen, Check, ChevronRight, Copy, Flame, Heart,
  Home, Library, LoaderCircle, LockKeyhole, LogOut, MoonStar,
  Sparkles, Star, Users
} from "lucide-react";
import type { AppState, Lesson } from "./types";

type Tab = "today" | "together" | "library" | "profile";

async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function Logo() {
  return <div className="logo"><span className="logo-mark"><Sparkles size={18}/></span><span>Tandem</span></div>;
}

function Auth({ refresh }: { refresh: () => void }) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await api(mode === "create" ? "/api/pairs/create" : "/api/pairs/join", {
        method: "POST", body: JSON.stringify({ name, inviteCode: code }),
      });
      refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Try again"); }
    finally { setBusy(false); }
  }

  return <main className="auth-page">
    <section className="auth-story">
      <Logo />
      <div className="story-copy">
        <span className="eyebrow">A LITTLE CURIOUS, EVERY DAY</span>
        <h1>Learn something<br/><em>together.</em></h1>
        <p>Choose three topics every two weeks. Play, wonder, debate—and build a shared library of everything you know.</p>
        <div className="topic-cloud">
          <span>Ancient Egypt</span><span>Dreams</span><span>Volcanoes</span>
        </div>
      </div>
      <p className="tiny-note">Made for two curious people.</p>
    </section>
    <section className="auth-form-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="mobile-logo"><Logo /></div>
        <span className="step-orbit">✦</span>
        <h2>{mode === "create" ? "Start your Tandem" : "Join your person"}</h2>
        <p>{mode === "create" ? "You’ll get a private invite code to share." : "Enter the code your partner sent you."}</p>
        <div className="segmented">
          <button type="button" className={mode === "create" ? "active" : ""} onClick={()=>setMode("create")}>Create</button>
          <button type="button" className={mode === "join" ? "active" : ""} onClick={()=>setMode("join")}>Join</button>
        </div>
        <label>Your name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Jordan" maxLength={30} required /></label>
        {mode === "join" && <label>Invite code<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="CURIO7" maxLength={6} required /></label>}
        {error && <div className="error">{error}</div>}
        <button className="primary wide" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <>Continue <ArrowRight size={18}/></>}</button>
      </form>
    </section>
  </main>;
}

function Setup({ state, refresh }: { state: AppState; refresh: () => void }) {
  const own = state.topics?.find(t => t.slot === `user:${state.user?.id}`);
  const partner = state.partner ? state.topics?.find(t => t.slot === `user:${state.partner?.id}`) : null;
  const shared = state.topics?.find(t => t.slot === "shared");
  const [mine, setMine] = useState(own?.name || "");
  const [ours, setOurs] = useState(shared?.name || "");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  async function save(slot: "mine" | "shared", name: string) {
    setError("");
    try {
      await api("/api/topics", { method:"POST", body:JSON.stringify({ slot, name }) });
      setSaved(slot); refresh(); setTimeout(()=>setSaved(""), 1200);
    } catch(err){ setError(err instanceof Error ? err.message : "Could not save"); }
  }
  function copyCode(){ navigator.clipboard.writeText(state.inviteCode || ""); setSaved("code"); setTimeout(()=>setSaved(""),1200); }

  return <main className="setup-page">
    <header className="simple-header"><Logo/><span className="muted">New 14-day Tandem</span></header>
    <section className="setup-shell">
      <div className="setup-intro"><span className="eyebrow">YOUR NEXT SIDEQUEST</span><h1>Three topics.<br/><em>Two perspectives.</em></h1><p>Each of you picks one. Choose the third together, then your daily learning begins.</p></div>
      {!state.partner && <div className="invite-banner"><div><Users/><strong>Invite your partner</strong><span>Share this code so they can join you.</span></div><button onClick={copyCode}><b>{state.inviteCode}</b>{saved==="code"?<Check/>:<Copy/>}</button></div>}
      <div className="topic-grid">
        <div className="topic-pick coral"><span>01 · YOUR PICK</span><h3>What are you curious about?</h3><input value={mine} onChange={e=>setMine(e.target.value)} placeholder="e.g. Nuclear energy"/><button onClick={()=>save("mine",mine)} disabled={!mine.trim()}>{saved==="mine"?"Saved ✓":own?"Update pick":"Save my pick"}</button></div>
        <div className="topic-pick blue"><span>02 · {state.partner?.name?.toUpperCase() || "PARTNER"}'S PICK</span><h3>{partner?.name || (state.partner ? "Waiting for their choice…" : "Waiting for them to join…")}</h3><div className="waiting-value">{partner?.name || "Their topic will appear here"}</div><div className="waiting-line"><i className={partner?"done":""}/><small>{partner?"Choice locked in":"Not chosen yet"}</small></div></div>
        <div className="topic-pick gold"><span>03 · YOUR SHARED PICK</span><h3>Choose one together</h3><input value={ours} onChange={e=>setOurs(e.target.value)} placeholder="e.g. The psychology of dreams"/><button onClick={()=>save("shared",ours)} disabled={!ours.trim()}>{saved==="shared"?"Saved ✓":shared?"Update shared pick":"Save shared pick"}</button></div>
      </div>
      <div className="ready-note">{state.partner && own && partner && shared ? <><Sparkles/> Everything’s ready—your Tandem is beginning!</> : "The 14-day clock begins automatically when all three picks are in."}</div>
      {error && <div className="error">{error}</div>}
    </section>
  </main>;
}

function LessonCard({ lesson, number, complete }: { lesson: Lesson; number: number; complete:(id:string)=>void }) {
  const [open,setOpen]=useState(false);
  return <article className={`lesson-card tone-${number} ${lesson.completed?"complete":""}`}>
    <button className="lesson-summary" onClick={()=>setOpen(!open)} aria-expanded={open}>
      <span className="lesson-number">{lesson.completed?<Check/>:String(number+1).padStart(2,"0")}</span>
      <span className="lesson-main"><small>{lesson.activityType}</small><strong>{lesson.topicName}</strong><em>{lesson.title}</em></span>
      <ChevronRight className={open?"turned":""}/>
    </button>
    {open && <div className="lesson-body">
      <div className="fact"><Star size={17}/><p>{lesson.fact || lesson.content}</p></div>
      {lesson.prompt && <p className="prompt">{lesson.prompt}</p>}
      <button className="primary" disabled={lesson.completed} onClick={()=>complete(lesson.id)}>{lesson.completed?"Completed ✓":"Mark complete"}</button>
    </div>}
  </article>;
}

function Dashboard({ state, refresh }: { state: AppState; refresh:()=>void }) {
  const [tab,setTab]=useState<Tab>("today");
  const [error,setError]=useState("");
  const [answer,setAnswer]=useState("");
  const [copied,setCopied]=useState(false);
  const lessons=state.lessons || [];
  const mine=lessons.filter(l=>l.completed).length;
  const partnerProgress=state.partner ? state.progress?.[state.partner.id] || 0 : 0;

  const complete=useCallback(async(id:string)=>{
    try{ await api("/api/progress",{method:"POST",body:JSON.stringify({lessonId:id})}); refresh(); }
    catch(err){ setError(err instanceof Error?err.message:"Could not save"); }
  },[refresh]);

  async function submitChallenge(){
    if(!answer.trim())return;
    try{ await api("/api/challenge",{method:"POST",body:JSON.stringify({challengeId:state.challenge?.id,answer})}); setAnswer(""); refresh(); }
    catch(err){setError(err instanceof Error?err.message:"Could not save");}
  }
  async function logout(){await api("/api/logout",{method:"POST"});refresh();}
  function copyInvite(){navigator.clipboard.writeText(state.inviteCode||"");setCopied(true);setTimeout(()=>setCopied(false),1000);}

  useEffect(()=>{
    const ctx=(document as Document & {modelContext?:{registerTool:(tool:unknown,opts?:{signal?:AbortSignal})=>void}}).modelContext;
    if(!ctx?.registerTool)return;
    const ctrl=new AbortController();
    try{
      ctx.registerTool({name:"get_today_status",title:"Get today's Tandem status",description:"Read today's topics and completion status.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({day:state.cycle?.dayNumber,topics:state.topics?.map(t=>t.name),completed:`${mine}/3`,challengeUnlocked:state.challenge?.unlocked})},{signal:ctrl.signal});
      ctx.registerTool({name:"complete_tandem_lesson",title:"Complete a lesson",description:"Mark one visible daily Tandem lesson complete.",inputSchema:{type:"object",properties:{lessonId:{type:"string"}},required:["lessonId"],additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input:{lessonId:string})=>{if(!lessons.some(l=>l.id===input.lessonId))throw new Error("Lesson is not part of today");await complete(input.lessonId);return{completed:true,lessonId:input.lessonId};}},{signal:ctrl.signal});
    }catch{/* WebMCP is optional */}
    return()=>ctrl.abort();
  },[complete,lessons,mine,state]);

  const nav=[["today",Home,"Today"],["together",Heart,"Together"],["library",Library,"Library"],["profile",Users,"Us"]] as const;
  return <div className="app-shell">
    <aside className="sidebar"><Logo/><nav>{nav.map(([id,Icon,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Icon/>{label}</button>)}</nav><div className="sidebar-streak"><Flame/><div><b>{state.streak || 0} day streak</b><span>Keep learning together</span></div></div></aside>
    <main className="main-content">
      <header className="mobile-header"><Logo/><button onClick={()=>setTab("profile")}><Users/></button></header>
      {tab==="today" && <>
        <section className="day-heading"><div><span className="eyebrow">DAY {state.cycle?.dayNumber} OF 14</span><h1>Today’s little<br/><em>rabbit holes.</em></h1></div><div className="date-chip"><span>{new Date().toLocaleDateString("en-US",{weekday:"short"}).toUpperCase()}</span><b>{new Date().getDate()}</b></div></section>
        <div className="topic-pills">{state.topics?.map((t,i)=><span key={t.id} className={`pill-${i}`}><i/>{t.name}</span>)}</div>
        <section className="progress-row">
          <div><span className="avatar coral-avatar">{state.user?.name?.[0]}</span><p><b>You</b><span>{mine} of 3 complete</span></p><div className="mini-progress"><i style={{width:`${mine/3*100}%`}}/></div></div>
          <div><span className="avatar blue-avatar">{state.partner?.name?.[0] || "?"}</span><p><b>{state.partner?.name || "Partner"}</b><span>{partnerProgress} of 3 complete</span></p><div className="mini-progress"><i style={{width:`${partnerProgress/3*100}%`}}/></div></div>
        </section>
        <section className="lessons"><div className="section-label"><span>TODAY’S THREE</span><small>About 8 minutes total</small></div>{lessons.map((l,i)=><LessonCard key={l.id} lesson={l} number={i} complete={complete}/>)}</section>
        <ChallengeCard state={state} answer={answer} setAnswer={setAnswer} submit={submitChallenge}/>
      </>}
      {tab==="together" && <section className="inner-page"><span className="eyebrow">JUST THE TWO OF YOU</span><h1>Together</h1><div className="big-stat"><Flame/><b>{state.streak || 0}</b><span>days learned together</span></div><ChallengeCard state={state} answer={answer} setAnswer={setAnswer} submit={submitChallenge}/></section>}
      {tab==="library" && <section className="inner-page"><span className="eyebrow">THINGS YOU’VE LEARNED</span><h1>Your shared library</h1><p className="lead">Every finished Sidequest will live here. Your first three shelves are already taking shape.</p><div className="library-grid">{state.topics?.map((t,i)=><div className={`library-book book-${i}`} key={t.id}><BookOpen/><small>CURRENT SIDEQUEST</small><h3>{t.name}</h3><span>Day {state.cycle?.dayNumber} of 14</span></div>)}</div></section>}
      {tab==="profile" && <section className="inner-page"><span className="eyebrow">YOUR TANDEM</span><h1>{state.user?.name} <em>&</em> {state.partner?.name || "your person"}</h1><div className="profile-card"><span>PAIR INVITE CODE</span><button onClick={copyInvite}><b>{state.inviteCode}</b>{copied?<Check/>:<Copy/>}</button><p>Keep this code private. It connects a second profile to your shared learning space.</p></div><button className="logout" onClick={logout}><LogOut/> Sign out on this device</button></section>}
      {error&&<div className="toast">{error}</div>}
    </main>
    <nav className="bottom-nav">{nav.map(([id,Icon,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Icon/><span>{label}</span></button>)}</nav>
  </div>;
}

function ChallengeCard({state,answer,setAnswer,submit}:{state:AppState;answer:string;setAnswer:(v:string)=>void;submit:()=>void}){
  const c=state.challenge;
  if(!c)return null;
  return <section className={`challenge-card ${c.unlocked?"unlocked":""}`}>
    <div className="moon"><MoonStar/></div>
    <div className="challenge-copy"><span>TONIGHT’S CHALLENGE · {c.type}</span><h2>{c.unlocked?c.title:"A little mystery for later"}</h2>
      {!c.unlocked?<p><LockKeyhole size={15}/> Unlocks when you’ve both finished today’s three.</p>:<>
        <p>{c.prompt}</p>{c.detail&&<small>{c.detail}</small>}
        {!c.ownSubmitted&&<div className="answer-box"><textarea value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Write your secret answer…"/><button onClick={submit}>Lock it in <ArrowRight/></button></div>}
        {c.ownSubmitted&&!c.answers&&<div className="locked-answer"><LockKeyhole/> Your answer is locked. Waiting for your partner…</div>}
        {c.answers&&<div className="reveals">{c.answers.map(a=><div key={a.userId}><span>{a.name}</span><p>{a.answer}</p></div>)}</div>}
      </>}
    </div>
  </section>;
}

export default function App(){
  const [state,setState]=useState<AppState|null>(null);
  const [error,setError]=useState("");
  const refresh=useCallback(()=>{api("/api/state").then(setState).catch(e=>setError(e.message));},[]);
  useEffect(()=>{refresh();},[refresh]);
  if(error)return <div className="fatal"><Logo/><h2>We couldn’t open Tandem.</h2><p>{error}</p><button className="primary" onClick={()=>location.reload()}>Try again</button></div>;
  if(!state)return <div className="loading"><Logo/><LoaderCircle className="spin"/></div>;
  if(!state.authenticated)return <Auth refresh={refresh}/>;
  if(!state.cycle||state.cycle.status==="draft")return <Setup state={state} refresh={refresh}/>;
  return <Dashboard state={state} refresh={refresh}/>;
}
