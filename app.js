const STORAGE='kokoQuizV05';
const OLD_STORAGES=['kokoQuizV04','kokoQuizV03','kokoQuizV02','kokoQuizV01'];
const STAGES=[{level:1,target:300},{level:2,target:600},{level:3,target:1000},{level:4,target:2000}];
const SUBJECTS=['国語','数学','英語','理科','社会'];
let questions=[], qmap={};
let state=loadState();
let quiz=[], qi=0, pending=null, sessionMode='daily', sessionAnswers=[];
let calDate=new Date(), selectedDate=dateKey();

function blankState(){return {history:{},qstats:{}}}
function loadState(){
  try{
    let v=JSON.parse(localStorage.getItem(STORAGE));
    if(v) return normalizeState(v);
    for(const key of OLD_STORAGES){
      let old=JSON.parse(localStorage.getItem(key));
      if(!old)continue;
      if(key==='kokoQuizV02')return normalizeState(old);
      const migrated=blankState(); migrated.qstats=old.qstats||{};
      for(const [k,h] of Object.entries(old.history||{})){
        const ans=(h.answers||[]).map(a=>({...a,mode:'daily',eval:mapOldEval(a.eval)}));
        migrated.history[k]={official:ans.length>=10?ans.slice(0,10):[],attempts:ans,masterGained:0};
      }
      return normalizeState(migrated);
    }
  }catch(e){}
  return blankState();
}
function mapOldEval(e){return e==='known'?'perfect':e==='guess'?'guess':'unknown'}
function normalizeState(s){
  s=s||blankState(); s.history=s.history||{}; s.qstats=s.qstats||{};
  for(const [k,h0] of Object.entries(s.history)){
    const h=h0||{}; h.attempts=h.attempts||h.answers||[]; h.official=h.official||((h.answers||[]).length>=10?(h.answers||[]).slice(0,10):[]);
    h.masterGained=h.masterGained||0; delete h.answers; s.history[k]=h;
  }
  return s;
}
function save(){localStorage.setItem(STORAGE,JSON.stringify(state))}
function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function parseDate(k){const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function seededSort(arr,seed){return [...arr].sort((a,b)=>(hash(seed+a.id)%100000)-(hash(seed+b.id)%100000))}
function pct(n,d){return d?Math.round(n/d*100):0}
function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById(id).classList.add('active')}
function todayHist(){return state.history[dateKey()]||{official:[],attempts:[],masterGained:0}}
function ensureToday(){const k=dateKey();if(!state.history[k])state.history[k]={official:[],attempts:[],masterGained:0};return state.history[k]}
function isUnderstood(a){return a.correct&&['confident','perfect'].includes(a.eval)}
function isTrouble(a){return !a.correct||['unsure','guess','unknown'].includes(a.eval)}
function qstat(id){return state.qstats[id]||{attempts:0,correct:0,wrong:0,perfectDates:[],mastered:false}}
function isMastered(id){return !!qstat(id).mastered}
function masteryReady(id){
  const s=qstat(id), dates=[...new Set(s.perfectDates||[])];
  return !s.mastered && dates.length===1 && dates[0]!==dateKey();
}
function allAttempts(){return Object.values(state.history).flatMap(h=>h.attempts||[])}
function completedDay(k){return (state.history[k]?.official||[]).length>=10}
function streakFrom(endKey=dateKey()){
  let n=0,d=parseDate(endKey);
  while(completedDay(dateKey(d))){n++;d.setDate(d.getDate()-1)}
  return n;
}
function bestStreak(){
  const keys=Object.keys(state.history).filter(completedDay).sort(); if(!keys.length)return 0;
  let best=1,cur=1;
  for(let i=1;i<keys.length;i++){const a=parseDate(keys[i-1]),b=parseDate(keys[i]);if((b-a)/86400000===1)cur++;else cur=1;best=Math.max(best,cur)}
  return best;
}
function masteredCount(sub=null){return questions.filter(q=>(!sub||q.subject===sub)&&isMastered(q.id)).length}
function currentStage(){
  const m=masteredCount();
  return STAGES.find(x=>m<x.target)||STAGES[STAGES.length-1];
}
function stageStartTarget(level){return level===1?0:STAGES[level-2].target}
function stageProgress(){const st=currentStage(),m=masteredCount();return {st,m,complete:m>=2000,p:pct(m,st.target)}}

function renderHome(){
  show('homeView'); selectedDate=selectedDate||dateKey();
  const done=completedDay(dateKey());
  document.getElementById('beforeActions').classList.toggle('hidden',done);
  document.getElementById('afterActions').classList.toggle('hidden',!done);
  document.getElementById('heroMessage').textContent=done?'まだまだ、やるよね。':'さぁ、今日も始めよう。';
  document.getElementById('heroSub').textContent=done?'今日の10問は完了。ここからは、自分のペースで。':'毎日10問。今日の一歩を積み重ねる。';

  const trouble=todayTroubleIds().length, ready=questions.filter(q=>masteryReady(q.id)).length;
  document.getElementById('reviewBtn').classList.toggle('disabled',trouble===0);
  document.getElementById('reviewBtn').querySelector('span').textContent=trouble?`今日つまずいた ${trouble}問を確認`:'今日の苦手はありません';
  document.getElementById('masterBtn').classList.toggle('disabled',ready===0);
  document.getElementById('masterBtn').querySelector('span').textContent=ready?`あと一歩の知識 ${ready}問を定着`:'挑戦できる問題はまだありません';

  const st=streakFrom();
  document.getElementById('streak').textContent=`${st} DAY${st===1?'':'S'} STREAK`;
  renderCalendar(); renderDayRecord(selectedDate); renderLifetime();
}
function renderLifetime(){
  const all=allAttempts(), keys=Object.keys(state.history).filter(k=>(state.history[k].attempts||[]).length);
  document.getElementById('totalQuestions').textContent=all.length.toLocaleString();
  document.getElementById('studyDays').textContent=keys.length;
  document.getElementById('currentStreak').textContent=streakFrom();
  document.getElementById('bestStreak').textContent=bestStreak();
  const {st,m:mc,complete,p:mp}=stageProgress();
  document.getElementById('stageLabel').textContent=complete?'ALL MASTERED':`LEVEL ${st.level}`;
  document.getElementById('masterTotal').textContent=`${mc} / ${st.target}`;
  document.getElementById('masterPercent').textContent=complete?'高校入試 COMPLETE':`${mp}%`;
  document.getElementById('masterBar').style.width=Math.min(100,mp)+'%';
  document.getElementById('nextStage').textContent=complete?'2,000問 MASTER — COMPLETE':st.level<4?`NEXT  ${STAGES[st.level].target}  🔒`:'FINAL STAGE — 2,000 MASTER';
  const box=document.getElementById('subjectMaster');box.innerHTML='';
  SUBJECTS.forEach(s=>{
    const total=questions.filter(q=>q.subject===s).length,m=masteredCount(s),p=pct(m,total);
    const row=document.createElement('div');row.className='subject-master-row';
    row.innerHTML=`<b>${s}</b><div class="bar"><i style="width:${p}%"></i></div><span>${m} / ${total}　${p}%</span>`;box.append(row);
  });
}
function heatLevel(n){return n>=50?5:n>=40?4:n>=30?3:n>=20?2:n>=10?1:0}
function heatColor(l){return ['','#7c93ad','#b59b62','#c77945','#b84d3e','#7f2836'][l]}
function renderCalendar(){
  const y=calDate.getFullYear(),m=calDate.getMonth();document.getElementById('monthLabel').textContent=`${y}年${m+1}月`;
  const box=document.getElementById('calendar');box.innerHTML='';const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
  for(let i=0;i<first;i++){const e=document.createElement('div');e.className='day empty';box.append(e)}
  for(let d=1;d<=days;d++){
    const dt=new Date(y,m,d),key=dateKey(dt),h=state.history[key],n=(h?.attempts||[]).length,l=heatLevel(n),el=document.createElement('div');
    el.className='day';if(key===dateKey())el.classList.add('today');if(key===selectedDate)el.classList.add('selected');
    el.innerHTML=`<div class="num">${d}</div>${l?`<i class="flame" style="--heat:${heatColor(l)}" title="${n}問"></i>`:''}`;
    el.onclick=()=>{selectedDate=key;renderCalendar();renderDayRecord(key)};box.append(el);
  }
}
function renderDayRecord(key){
  const h=state.history[key], attempts=h?.attempts||[], official=h?.official||[];
  const isToday=key===dateKey(), d=parseDate(key);
  document.getElementById('recordEyebrow').textContent=isToday?"TODAY'S RECORD":'DAILY RECORD';
  document.getElementById('recordTitle').textContent=isToday?'今日の記録':`${d.getMonth()+1}月${d.getDate()}日の記録`;
  document.getElementById('backTodayBtn').classList.toggle('hidden',isToday);
  document.getElementById('emptyRecord').classList.toggle('hidden',attempts.length>0);
  document.getElementById('recordContent').classList.toggle('hidden',attempts.length===0);
  if(!attempts.length)return;
  const c=pct(official.filter(a=>a.correct).length,official.length),u=pct(official.filter(isUnderstood).length,official.length);
  document.getElementById('dayCorrect').textContent=official.length?c+'%':'--%';
  document.getElementById('dayUnderstand').textContent=official.length?u+'%':'--%';
  document.getElementById('dayTotal').textContent=attempts.length;
  document.getElementById('dayMasterPlus').textContent='+'+(h.masterGained||0);
  const counts={daily:0,more:0,review:0,master:0};attempts.forEach(a=>counts[a.mode||'daily']=(counts[a.mode||'daily']||0)+1);
  document.getElementById('recordBreakdown').textContent=`今日の10問 ${counts.daily}問　｜　おかわり ${counts.more}問　｜　苦手復習 ${counts.review}問　｜　MASTER CHALLENGE ${counts.master}問`;
  document.getElementById('historyTitle').textContent=isToday?'今日の回答履歴':`${d.getMonth()+1}月${d.getDate()}日の回答履歴`;
  document.getElementById('historyCount').textContent=`${attempts.length}問`;
  const box=document.getElementById('answerHistory');box.innerHTML='';
  attempts.forEach((a,idx)=>{
    const q=qmap[a.qid];if(!q)return;const b=document.createElement('button');b.className=`history-item ${a.correct?'correct':'wrong'}`;
    b.innerHTML=`<span class="mark">${a.correct?'○':'×'}</span><span class="sub">${q.subject}</span><span class="qtext">${escapeHtml(q.question)}</span>`;
    b.onclick=()=>openDetail(a,q);box.append(b);
  });
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function openDetail(a,q){
  document.getElementById('detailStatus').textContent=a.correct?'CORRECT':'INCORRECT';
  document.getElementById('detailStatus').className='detail-status '+(a.correct?'correct':'wrong');
  document.getElementById('detailSubject').textContent=q.subject;document.getElementById('detailUnit').textContent=q.unit;
  document.getElementById('detailQuestion').textContent=q.question;
  document.getElementById('detailYourAnswer').textContent=q.choices[a.choice]??'記録なし';
  document.getElementById('detailCorrectAnswer').textContent=q.choices[q.answer];
  document.getElementById('detailExplanation').innerHTML=explanationHtml(q);
  document.getElementById('detailEval').textContent='自己評価：'+evalLabel(a.eval);
  document.getElementById('detailModal').classList.remove('hidden');
}
function evalLabel(e){return ({confident:'自信あった',unsure:'迷った',gotit:'へぇ！',confused:'どういうこと？',perfect:'自信あった',guess:'迷った',understood:'へぇ！',unknown:'どういうこと？'}[e]||'記録なし')}
function cleanExplanation(q){
  let e=(q.explanation||'').trim();
  e=e.replace(/^正解は「[^」]+」です。[。]?/,'').trim();
  if(!e)return `正解は「${q.choices[q.answer]}」。`;
  return e;
}
function explanationHtml(q){
  const parts=[`<p class="explain-main">${escapeHtml(cleanExplanation(q))}</p>`];
  if(Array.isArray(q.choiceNotes)&&q.choiceNotes.length){
    parts.push('<div class="choice-notes">'+q.choiceNotes.map((n,i)=>`<div class="choice-note ${i===q.answer?'answer-note':''}"><b>${i+1}.</b> ${escapeHtml(n)}</div>`).join('')+'</div>');
  }
  if(q.diagram==='alternateAngles')parts.push(`<div class="mini-diagram" aria-label="錯角の図"><svg viewBox="0 0 320 150" role="img"><line x1="20" y1="45" x2="300" y2="45"/><line x1="20" y1="110" x2="300" y2="110"/><line x1="105" y1="10" x2="215" y2="145"/><path class="angle-mark" d="M135 45 A28 28 0 0 1 153 66"/><path class="angle-mark" d="M169 89 A28 28 0 0 1 187 110"/><text x="137" y="76">①</text><text x="176" y="94">②</text></svg><b>①と②が錯角。平行線なら①＝②</b><span>「Z」の形で向かい合う角を探そう。</span></div>`);
  if(q.memoryTip)parts.push(`<div class="memory-tip"><b>覚え方</b> ${escapeHtml(q.memoryTip)}</div>`);
  return parts.join('');
}

function weakness(q){
  const s=qstat(q.id); if(!s.attempts)return 8;
  return Math.max(0,5+(s.wrong||0)*1.6-(s.correct||0)*.5-(s.perfectDates||[]).length*1.4);
}
function dailyQuestions(){
  const key=dateKey(),out=[];
  for(const sub of SUBJECTS){
    const pool=questions.filter(q=>q.subject===sub&&!isMastered(q.id));
    const ranked=seededSort(pool,key+sub).sort((a,b)=>weakness(b)-weakness(a));
    out.push(...ranked.slice(0,2));
  }
  let result=seededSort(out,key+'all').slice(0,10);
  // MASTER済みも忘却防止のため低頻度で復習。日付ハッシュで約3日に1回、1問だけ混ぜる。
  if(hash(key+'master-review')%3===0){
    const mastered=seededSort(questions.filter(q=>isMastered(q.id)),key+'master-review');
    if(mastered.length&&result.length){result[result.length-1]=mastered[0]}
  }
  if(result.length<10){
    const fill=seededSort(questions.filter(q=>!result.some(x=>x.id===q.id)),key+'fill');
    result.push(...fill.slice(0,10-result.length));
  }
  return result;
}
function moreQuestions(){
  const unseen=seededSort(questions.filter(q=>!qstat(q.id).attempts),dateKey()+'new');
  const seen=seededSort(questions.filter(q=>qstat(q.id).attempts&&!isMastered(q.id)),dateKey()+'seen').sort((a,b)=>weakness(b)-weakness(a));
  return [...unseen,...seen].slice(0,10);
}
function todayTroubleIds(){
  const ids=[];for(const a of todayHist().attempts||[]){if(isTrouble(a)&&!ids.includes(a.qid))ids.push(a.qid)}return ids;
}
function reviewQuestions(){return seededSort(todayTroubleIds().map(id=>qmap[id]).filter(Boolean),dateKey()+'review').slice(0,10)}
function masterQuestions(){return seededSort(questions.filter(q=>masteryReady(q.id)),dateKey()+'master').slice(0,10)}

function startSession(mode){
  sessionMode=mode; sessionAnswers=[]; pending=null; qi=0;
  if(mode==='daily'){if(completedDay(dateKey()))return;quiz=dailyQuestions()}
  if(mode==='more')quiz=moreQuestions();
  if(mode==='review')quiz=reviewQuestions();
  if(mode==='master')quiz=masterQuestions();
  if(!quiz.length)return;
  show('quizView');renderQuestion();
}
function modeName(){return ({daily:'TODAY',more:'MORE 10',review:'REVIEW',master:'MASTER CHALLENGE'}[sessionMode])}
function renderQuestion(){
  const q=quiz[qi],total=quiz.length;
  document.getElementById('modeLabel').textContent=modeName();document.getElementById('progressText').textContent=`${qi+1} / ${total}`;
  document.getElementById('progressBar').style.width=`${qi/total*100}%`;
  document.getElementById('subjectBadge').textContent=q.subject;document.getElementById('unitText').textContent=q.unit;document.getElementById('questionText').textContent=q.question;
  const box=document.getElementById('choices');box.innerHTML='';document.getElementById('feedback').classList.add('hidden');document.getElementById('selfEval').classList.add('hidden');
  q.choices.forEach((c,i)=>{const b=document.createElement('button');b.className='choice';b.textContent=`${i+1}. ${c}`;b.onclick=()=>answer(i);box.append(b)});
}
function answer(i){
  if(pending)return;const q=quiz[qi],correct=i===q.answer;
  pending={qid:q.id,subject:q.subject,choice:i,correct,mode:sessionMode,time:Date.now()};
  document.querySelectorAll('.choice').forEach((b,j)=>{b.disabled=true;if(j===q.answer)b.classList.add('correct');if(j===i&&!correct)b.classList.add('wrong')});
  document.getElementById('verdict').textContent=correct?'正解！':'不正解';
  document.getElementById('verdict').className='verdict '+(correct?'correct':'wrong');
  document.getElementById('correctAnswer').textContent=q.choices[q.answer];
  document.getElementById('explanationText').innerHTML=explanationHtml(q);
  document.getElementById('feedback').classList.remove('hidden');
  const evalBox=document.getElementById('evalButtons');evalBox.innerHTML='';
  const opts=correct?[['confident','自信あった'],['unsure','迷った']]:[['gotit','へぇ！'],['confused','どういうこと？']];
  document.getElementById('evalQuestion').textContent=correct?'答えるとき、どうだった？':'解説を読んで、どうだった？';
  opts.forEach(([v,t])=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>evalAnswer(v);evalBox.append(b)});
  document.getElementById('selfEval').classList.remove('hidden');
}
function evalAnswer(ev){
  if(!pending)return;pending.eval=ev;const k=dateKey(),h=ensureToday(),s=qstat(pending.qid),wasMaster=!!s.mastered;
  s.attempts=(s.attempts||0)+1;pending.correct?s.correct=(s.correct||0)+1:s.wrong=(s.wrong||0)+1;
  s.perfectDates=s.perfectDates||[];
  if(pending.correct&&['confident','perfect'].includes(ev)&&!s.perfectDates.includes(k))s.perfectDates.push(k);
  if(new Set(s.perfectDates).size>=2)s.mastered=true;
  state.qstats[pending.qid]=s;
  if(!wasMaster&&s.mastered)h.masterGained=(h.masterGained||0)+1;
  h.attempts.push({...pending});
  if(sessionMode==='daily'&&h.official.length<10)h.official.push({...pending});
  sessionAnswers.push({...pending});save();pending=null;qi++;
  if(qi>=quiz.length)finish();else renderQuestion();
}
function finish(){
  document.getElementById('progressBar').style.width='100%';
  const official=sessionMode==='daily', a=sessionAnswers,c=pct(a.filter(x=>x.correct).length,a.length),u=pct(a.filter(isUnderstood).length,a.length);
  document.getElementById('resultEyebrow').textContent=official?'TODAY COMPLETE':'SESSION COMPLETE';
  document.getElementById('resultTitle').textContent=official?'今日の10問 完了':`${a.length}問 完了`;
  document.getElementById('officialResult').classList.toggle('hidden',!official);
  if(official){document.getElementById('resultCorrect').textContent=c+'%';document.getElementById('resultUnderstand').textContent=u+'%'}
  const gained=a.filter(x=>isMastered(x.qid)).length;
  document.getElementById('resultNote').textContent=official?'今日の公式記録を保存しました。追加学習をしても、この記録は変わりません。':`${a.length}問を学習しました。今日の記録に追加されています。`;
  show('resultView');
}

document.getElementById('startBtn').onclick=()=>startSession('daily');
document.getElementById('moreBtn').onclick=()=>startSession('more');
document.getElementById('reviewBtn').onclick=()=>startSession('review');
document.getElementById('masterBtn').onclick=()=>startSession('master');
document.getElementById('quitBtn').onclick=()=>{pending=null;renderHome()};
document.getElementById('homeBtn').onclick=()=>{selectedDate=dateKey();renderHome()};
document.getElementById('prevMonth').onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()-1,1);renderCalendar()};
document.getElementById('nextMonth').onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()+1,1);renderCalendar()};
document.getElementById('backTodayBtn').onclick=()=>{selectedDate=dateKey();calDate=new Date();renderCalendar();renderDayRecord(selectedDate)};
document.getElementById('closeModal').onclick=()=>document.getElementById('detailModal').classList.add('hidden');
document.getElementById('detailModal').onclick=e=>{if(e.target.id==='detailModal')e.currentTarget.classList.add('hidden')};

fetch('questions.json').then(r=>r.json()).then(q=>{questions=q;qmap=Object.fromEntries(q.map(x=>[x.id,x]));renderHome()}).catch(()=>alert('問題データを読み込めませんでした。Webサーバー経由で開いてください。'));