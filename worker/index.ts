interface Env { DB: D1Database; ASSETS: Fetcher }
type SessionUser = { id:string; name:string; pair_id:string; color:string };

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID();
const sessionCookie=(token:string)=>`tandem_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=15552000`;
const clearCookie="tandem_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
function cookie(request:Request,name:string){return request.headers.get("Cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="))?.slice(name.length+1)||""}
async function hash(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function invite(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const bytes=crypto.getRandomValues(new Uint8Array(6));return [...bytes].map(b=>chars[b%chars.length]).join("")}
function clean(value:unknown,max=80){return typeof value==="string"?value.trim().replace(/[<>]/g,"").slice(0,max):""}
function dayNumber(start:string|null){if(!start)return 1;return Math.max(1,Math.min(14,Math.floor((Date.now()-new Date(start+"T00:00:00Z").getTime())/86400000)+1))}
async function body(request:Request){try{return await request.json() as Record<string,unknown>}catch{return {}}}
async function currentUser(request:Request,env:Env):Promise<SessionUser|null>{
  const token=cookie(request,"tandem_session");if(!token)return null;
  return await env.DB.prepare(`SELECT u.id,u.name,u.pair_id,u.color FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).bind(await hash(token),now()).first<SessionUser>();
}
async function makeSession(userId:string,env:Env){const token=uid()+uid();const expires=new Date(Date.now()+180*86400000).toISOString();await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await hash(token),userId,expires).run();return token}
const lenses=["the origin story","a surprising turning point","the people behind it","a common misconception","how it works","its biggest mystery","a real-world example","the debate around it","an overlooked detail","how it changed over time","its connection to everyday life","a question experts still ask","the idea worth remembering","the big-picture takeaway"];
const activities=["2-minute read","Prediction","Quick reflection","True or false?","Explain it simply","Connection game","Tiny thought experiment"];
const challengeTypes=["Debate Night","Prediction","Would You Rather","Secret Answer","Rank It","Who Remembers?","Explain It to Me","Real-Life Mission","Two Truths & a Lie","Switch Sides","Bet on Your Partner","Connection Game","Teach Back","Finale"];
function lessonRows(cycleId:string,topics:{id:string;name:string}[]){
  return topics.flatMap(topic=>Array.from({length:14},(_,i)=>({
    id:uid(),cycleId,topicId:topic.id,day:i+1,type:activities[i%activities.length],
    title:`Explore ${lenses[i]}`,
    content:`Take a closer look at ${topic.name} through ${lenses[i]}. Focus on one detail you would want to tell someone later.`,
    prompt:i%3===0?`What makes this detail about ${topic.name} memorable?`:i%3===1?`Before you read, what would you have guessed?`:`How would you explain this in one sentence?`
  })));
}
function challengeRows(cycleId:string,topics:{name:string}[]){
  return Array.from({length:14},(_,i)=>{const topic=topics[i%topics.length]?.name||"today's topic";const type=challengeTypes[i];let prompt=`What was the most surprising thing you learned about ${topic} today?`;let detail="Answer separately. Your responses reveal when both of you submit.";
    if(type==="Debate Night")prompt=`Take opposite sides: Is learning about ${topic} more useful for understanding the present or the past?`;
    if(type==="Prediction")prompt=`Make a bold prediction: what will people understand differently about ${topic} 25 years from now?`;
    if(type==="Would You Rather")prompt=`Would you rather become an instant expert on ${topic}, or keep discovering it slowly together?`;
    if(type==="Rank It")prompt=`Rank today's three topics from “most likely to send me down a rabbit hole” to least likely.`;
    if(type==="Explain It to Me")prompt=`Explain one idea from ${topic} in 30 seconds without using the topic’s name.`;
    if(type==="Switch Sides")prompt=`Choose a claim about ${topic}. Defend it—then switch sides and challenge your own argument.`;
    if(type==="Real-Life Mission"){prompt=`Find one example of ${topic} in your surroundings, a movie, a map, or the news—and show each other.`;detail="This one is meant to happen away from the screen."}
    return{id:uid(),cycleId,day:i+1,type,title:type==="Debate Night"?"Pick a side. Then switch.":type==="Finale"?"What will you remember?":`Tonight: ${type}`,prompt,detail};
  });
}
async function activateIfReady(cycleId:string,env:Env){
  const cycle=await env.DB.prepare("SELECT pair_id,status FROM cycles WHERE id=?").bind(cycleId).first<{pair_id:string;status:string}>();
  if(!cycle||cycle.status!=="draft")return;
  const users=(await env.DB.prepare("SELECT id FROM users WHERE pair_id=?").bind(cycle.pair_id).all<{id:string}>()).results;
  const topics=(await env.DB.prepare("SELECT id,name,slot FROM topics WHERE cycle_id=?").bind(cycleId).all<{id:string;name:string;slot:string}>()).results;
  if(users.length!==2||topics.length!==3||!topics.some(t=>t.slot==="shared")||!users.every(u=>topics.some(t=>t.slot===`user:${u.id}`)))return;
  const start=new Date().toISOString().slice(0,10);const end=new Date(Date.now()+13*86400000).toISOString().slice(0,10);
  const lessonStatements=lessonRows(cycleId,topics).map(l=>env.DB.prepare("INSERT INTO lessons(id,cycle_id,topic_id,day_number,activity_type,title,content,prompt) VALUES(?,?,?,?,?,?,?,?)").bind(l.id,l.cycleId,l.topicId,l.day,l.type,l.title,l.content,l.prompt));
  const challengeStatements=challengeRows(cycleId,topics).map(c=>env.DB.prepare("INSERT INTO challenges(id,cycle_id,day_number,type,title,prompt,detail) VALUES(?,?,?,?,?,?,?)").bind(c.id,c.cycleId,c.day,c.type,c.title,c.prompt,c.detail));
  await env.DB.batch([env.DB.prepare("UPDATE cycles SET status='active',start_date=?,end_date=? WHERE id=?").bind(start,end,cycleId),...lessonStatements,...challengeStatements]);
}
async function getState(request:Request,env:Env){
  const user=await currentUser(request,env);if(!user)return json({authenticated:false});
  const members=(await env.DB.prepare("SELECT id,name,color FROM users WHERE pair_id=? ORDER BY created_at").bind(user.pair_id).all<{id:string;name:string;color:string}>()).results;
  const partner=members.find(m=>m.id!==user.id)||null;
  const pair=await env.DB.prepare("SELECT invite_code FROM pairs WHERE id=?").bind(user.pair_id).first<{invite_code:string}>();
  let cycle=await env.DB.prepare("SELECT id,status,start_date FROM cycles WHERE pair_id=? ORDER BY created_at DESC LIMIT 1").bind(user.pair_id).first<{id:string;status:string;start_date:string|null}>();
  if(!cycle){const id=uid();await env.DB.prepare("INSERT INTO cycles(id,pair_id,status,created_at) VALUES(?,?,'draft',?)").bind(id,user.pair_id,now()).run();cycle={id,status:"draft",start_date:null}}
  const topics=(await env.DB.prepare("SELECT id,name,slot,chosen_by as chosenBy FROM topics WHERE cycle_id=? ORDER BY rowid").bind(cycle.id).all()).results;
  if(cycle.status==="draft")return json({authenticated:true,user:{id:user.id,name:user.name,color:user.color},partner,inviteCode:pair?.invite_code,cycle:{...cycle,dayNumber:1,startDate:null},topics});
  const day=dayNumber(cycle.start_date);
  const lessons=(await env.DB.prepare(`SELECT l.id,l.topic_id as topicId,t.name as topicName,l.day_number as dayNumber,l.activity_type as activityType,l.title,l.content,l.prompt,CASE WHEN p.user_id IS NULL THEN 0 ELSE 1 END as completed FROM lessons l JOIN topics t ON t.id=l.topic_id LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=? WHERE l.cycle_id=? AND l.day_number=? ORDER BY t.rowid`).bind(user.id,cycle.id,day).all<any>()).results.map(x=>({...x,completed:Boolean(x.completed)}));
  const counts=(await env.DB.prepare(`SELECT p.user_id as userId,COUNT(*) as count FROM progress p JOIN lessons l ON l.id=p.lesson_id WHERE l.cycle_id=? AND l.day_number=? GROUP BY p.user_id`).bind(cycle.id,day).all<{userId:string;count:number}>()).results;
  const progress=Object.fromEntries(members.map(m=>[m.id,Number(counts.find(c=>c.userId===m.id)?.count||0)]));
  const ch=await env.DB.prepare("SELECT id,type,title,prompt,detail FROM challenges WHERE cycle_id=? AND day_number=?").bind(cycle.id,day).first<any>();
  let challenge=null;if(ch){const unlocked=members.length===2&&members.every(m=>progress[m.id]>=3);const answers=(await env.DB.prepare(`SELECT a.user_id as userId,u.name,a.answer FROM challenge_answers a JOIN users u ON u.id=a.user_id WHERE a.challenge_id=? ORDER BY a.created_at`).bind(ch.id).all<any>()).results;const ownSubmitted=answers.some(a=>a.userId===user.id);challenge={...ch,unlocked,ownSubmitted,answers:answers.length===2?answers:null}}
  const streak=Math.max(0,day-1)+(members.every(m=>progress[m.id]>=3)?1:0);
  return json({authenticated:true,user:{id:user.id,name:user.name,color:user.color},partner,inviteCode:pair?.invite_code,cycle:{id:cycle.id,status:cycle.status,dayNumber:day,startDate:cycle.start_date},topics,lessons,progress,challenge,streak});
}
async function handleApi(request:Request,env:Env,path:string){
  if(path==="/api/state"&&request.method==="GET")return getState(request,env);
  if(path==="/api/pairs/create"&&request.method==="POST"){const b=await body(request);const name=clean(b.name,30);if(!name)return json({error:"Please enter your name."},400);const pairId=uid(),userId=uid(),cycleId=uid(),code=invite(),created=now();await env.DB.batch([env.DB.prepare("INSERT INTO pairs(id,invite_code,created_at) VALUES(?,?,?)").bind(pairId,code,created),env.DB.prepare("INSERT INTO users(id,pair_id,name,color,created_at) VALUES(?,?,?,?,?)").bind(userId,pairId,name,"coral",created),env.DB.prepare("INSERT INTO cycles(id,pair_id,status,created_at) VALUES(?,?,'draft',?)").bind(cycleId,pairId,created)]);const token=await makeSession(userId,env);return new Response(JSON.stringify({ok:true}),{status:201,headers:{"Content-Type":"application/json","Set-Cookie":sessionCookie(token)}})}
  if(path==="/api/pairs/join"&&request.method==="POST"){const b=await body(request),name=clean(b.name,30),code=clean(b.inviteCode,6).toUpperCase();if(!name||!code)return json({error:"Enter your name and six-character code."},400);const pair=await env.DB.prepare("SELECT id FROM pairs WHERE invite_code=?").bind(code).first<{id:string}>();if(!pair)return json({error:"That invite code wasn’t found."},404);const count=await env.DB.prepare("SELECT COUNT(*) as n FROM users WHERE pair_id=?").bind(pair.id).first<{n:number}>();if(Number(count?.n)>=2)return json({error:"This Tandem already has two people."},409);const userId=uid();await env.DB.prepare("INSERT INTO users(id,pair_id,name,color,created_at) VALUES(?,?,?,?,?)").bind(userId,pair.id,name,"blue",now()).run();const cycle=await env.DB.prepare("SELECT id FROM cycles WHERE pair_id=? AND status='draft' ORDER BY created_at DESC LIMIT 1").bind(pair.id).first<{id:string}>();if(cycle)await activateIfReady(cycle.id,env);const token=await makeSession(userId,env);return new Response(JSON.stringify({ok:true}),{status:201,headers:{"Content-Type":"application/json","Set-Cookie":sessionCookie(token)}})}
  const user=await currentUser(request,env);if(!user)return json({error:"Please sign in again."},401);
  if(path==="/api/topics"&&request.method==="POST"){const b=await body(request),name=clean(b.name,70),requested=clean(b.slot,10);if(!name||!["mine","shared"].includes(requested))return json({error:"Choose a topic first."},400);const cycle=await env.DB.prepare("SELECT id,status FROM cycles WHERE pair_id=? ORDER BY created_at DESC LIMIT 1").bind(user.pair_id).first<{id:string;status:string}>();if(!cycle||cycle.status!=="draft")return json({error:"This Sidequest has already started."},409);const slot=requested==="mine"?`user:${user.id}`:"shared";const existing=await env.DB.prepare("SELECT id FROM topics WHERE cycle_id=? AND slot=?").bind(cycle.id,slot).first<{id:string}>();if(existing)await env.DB.prepare("UPDATE topics SET name=?,chosen_by=? WHERE id=?").bind(name,user.id,existing.id).run();else await env.DB.prepare("INSERT INTO topics(id,cycle_id,slot,chosen_by,name) VALUES(?,?,?,?,?)").bind(uid(),cycle.id,slot,user.id,name).run();await activateIfReady(cycle.id,env);return json({ok:true})}
  if(path==="/api/progress"&&request.method==="POST"){const b=await body(request),lessonId=clean(b.lessonId,50);const lesson=await env.DB.prepare(`SELECT l.id FROM lessons l JOIN cycles c ON c.id=l.cycle_id WHERE l.id=? AND c.pair_id=?`).bind(lessonId,user.pair_id).first();if(!lesson)return json({error:"Lesson not found."},404);await env.DB.prepare("INSERT OR IGNORE INTO progress(user_id,lesson_id,completed_at) VALUES(?,?,?)").bind(user.id,lessonId,now()).run();return json({ok:true})}
  if(path==="/api/challenge"&&request.method==="POST"){const b=await body(request),challengeId=clean(b.challengeId,50),answer=clean(b.answer,600);if(!answer)return json({error:"Write an answer first."},400);const ch=await env.DB.prepare(`SELECT ch.id,ch.day_number as day, c.id as cycleId FROM challenges ch JOIN cycles c ON c.id=ch.cycle_id WHERE ch.id=? AND c.pair_id=?`).bind(challengeId,user.pair_id).first<{id:string;day:number;cycleId:string}>();if(!ch)return json({error:"Challenge not found."},404);const members=(await env.DB.prepare("SELECT id FROM users WHERE pair_id=?").bind(user.pair_id).all<{id:string}>()).results;const counts=(await env.DB.prepare(`SELECT p.user_id as userId,COUNT(*) as n FROM progress p JOIN lessons l ON l.id=p.lesson_id WHERE l.cycle_id=? AND l.day_number=? GROUP BY p.user_id`).bind(ch.cycleId,ch.day).all<{userId:string;n:number}>()).results;if(!members.every(m=>Number(counts.find(c=>c.userId===m.id)?.n||0)>=3))return json({error:"Both of you need to finish today first."},403);await env.DB.prepare("INSERT INTO challenge_answers(challenge_id,user_id,answer,created_at) VALUES(?,?,?,?) ON CONFLICT(challenge_id,user_id) DO UPDATE SET answer=excluded.answer,created_at=excluded.created_at").bind(ch.id,user.id,answer,now()).run();return json({ok:true})}
  if(path==="/api/logout"&&request.method==="POST"){const token=cookie(request,"tandem_session");if(token)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hash(token)).run();return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json","Set-Cookie":clearCookie}})}
  return json({error:"Not found"},404);
}
export default {async fetch(request:Request,env:Env){const url=new URL(request.url);try{if(url.pathname.startsWith("/api/"))return await handleApi(request,env,url.pathname);return env.ASSETS.fetch(request)}catch(error){console.error(error);return json({error:"Tandem hit a snag. Please try again."},500)}}};
