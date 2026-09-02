const STORAGE='kokoQuizV01';
const SUBJECTS=['国語','数学','英語','理科','社会'];
let questions=[];
let state=loadState();
let quiz=[], qi=0, pending=null;
let calDate=new Date();

function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE))||{history:{},qstats:{}}}catch{return {history:{},qstats:{}}}}
function save(){localStorage.setItem(STORAGE,JSON.stringify(state))}
function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function seededSort(arr,seed){return [...arr].sort((a,b)=>(hash(seed+a.id)%100000)-(hash(seed+b.id)%100000))}
function weakness(q){const s=state.qstats[q.id];if(!s)return 5; return Math.max(0, 4-(s.known||0)*.8+(s.guess||0)*1.2+(s.unknown||0)*1.8+(s.wrong||0)*1.5)}
function dailyQuestions(){
  const key=dateKey(); const out=[];
  for(const sub of SUBJECTS){
    const pool=questions.filter(q=>q.subject===sub);
    const ranked=seededSort(pool,key+sub).sort((a,b)=>weakness(b)-weakness(a));
    out.push(...ranked.slice(0,2));
  }
  return seededSort(out,key+'all');
}
function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById(id).classList.add('active')}
function pct(n,d){return d?Math.round(n/d*100):0}
function allAttempts(){return Object.values(state.history).flatMap(d=>d.answers||[])}
function renderHome(){
  show('homeView'); const today=state.history[dateKey()];
  document.getElementById('todayDone').textContent=`${today?.answers?.length||0}/10`;
  const all=allAttempts(), corr=all.filter(a=>a.correct).length, known=all.filter(a=>a.eval==='known').length;
  document.getElementById('overallCorrect').textContent=all.length?`${pct(corr,all.length)}%`:'--%';
  document.getElementById('overallUnderstand').textContent=all.length?`${pct(known,all.length)}%`:'--%';
  document.getElementById('streak').textContent=`🔥 ${streak()}日`;
  document.getElementById('startBtn').textContent=today?.answers?.length===10?'今日の10問をもう一度見る':'今日の10問をはじめる';
  renderCalendar(); renderSubjectStats();
}
function streak(){let n=0,d=new Date();while(true){let h=state.history[dateKey(d)];if(h?.answers?.length===10){n++;d.setDate(d.getDate()-1)}else break}return n}
function renderSubjectStats(){
  const box=document.getElementById('subjectStats'); box.innerHTML='';
  for(const s of SUBJECTS){const a=allAttempts().filter(x=>x.subject===s), known=a.filter(x=>x.eval==='known').length; const p=pct(known,a.length); const row=document.createElement('div');row.className='subject-row';row.innerHTML=`<b>${s}</b><div class="bar"><i style="width:${p}%"></i></div><span>${a.length?p+'%':'--'}</span>`;box.append(row)}
}
function renderCalendar(){
  const y=calDate.getFullYear(),m=calDate.getMonth(); document.getElementById('monthLabel').textContent=`${y}年${m+1}月`;
  const box=document.getElementById('calendar');box.innerHTML=''; const first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate();
  for(let i=0;i<first;i++){let e=document.createElement('div');e.className='day empty';box.append(e)}
  for(let d=1;d<=days;d++){const dt=new Date(y,m,d),key=dateKey(dt),hist=state.history[key],el=document.createElement('div');el.className='day';if(key===dateKey())el.classList.add('today');let sc='';if(hist?.answers?.length){let k=hist.answers.filter(a=>a.eval==='known').length,p=pct(k,hist.answers.length),c=pct(hist.answers.filter(a=>a.correct).length,hist.answers.length);el.classList.add('lv'+(p>=90?4:p>=70?3:p>=50?2:1));sc=`<div class="score">正${c}<br>理${p}</div>`}el.innerHTML=`<div class="num">${d}</div>${sc}`;box.append(el)}
}
function startQuiz(){quiz=dailyQuestions(); qi=0; pending=null; state.history[dateKey()]={answers:[]}; save(); show('quizView'); renderQuestion()}
function renderQuestion(){
  const q=quiz[qi]; document.getElementById('progressText').textContent=`${qi+1} / 10`;document.getElementById('progressBar').style.width=`${qi*10}%`;document.getElementById('subjectBadge').textContent=q.subject;document.getElementById('unitText').textContent=q.unit;document.getElementById('questionText').textContent=q.question;
  const box=document.getElementById('choices');box.innerHTML='';document.getElementById('feedback').classList.add('hidden');document.getElementById('selfEval').classList.add('hidden');
  q.choices.forEach((c,i)=>{let b=document.createElement('button');b.className='choice';b.textContent=`${i+1}. ${c}`;b.onclick=()=>answer(i,b);box.append(b)})
}
function answer(i,btn){
  if(pending)return; const q=quiz[qi],correct=i===q.answer; pending={qid:q.id,subject:q.subject,correct};
  document.querySelectorAll('.choice').forEach((b,j)=>{b.disabled=true;if(j===q.answer)b.classList.add('correct');if(j===i&&!correct)b.classList.add('wrong')});
  const f=document.getElementById('feedback');f.innerHTML=`<strong>${correct?'○ 正解！':'× 不正解'}</strong>${q.explanation}`;f.classList.remove('hidden');document.getElementById('selfEval').classList.remove('hidden');
}
function evalAnswer(ev){
  if(!pending)return; pending.eval=ev; const qid=pending.qid; const s=state.qstats[qid]||{attempts:0,correct:0,wrong:0,known:0,guess:0,unknown:0}; s.attempts++;pending.correct?s.correct++:s.wrong++;s[ev]++;state.qstats[qid]=s;state.history[dateKey()].answers.push(pending);save();pending=null;qi++;if(qi>=10)finish();else renderQuestion();
}
function finish(){document.getElementById('progressBar').style.width='100%';const a=state.history[dateKey()].answers,c=pct(a.filter(x=>x.correct).length,a.length),u=pct(a.filter(x=>x.eval==='known').length,a.length);document.getElementById('resultCorrect').textContent=c+'%';document.getElementById('resultUnderstand').textContent=u+'%';let note=u>=80?'かなり定着しています。明日も10問。':u>=60?'いいペース。あやふやな問題を少しずつ減らそう。':'「当てずっぽ・わからない」が次回優先的に出題されます。';document.getElementById('resultNote').textContent=note;show('resultView')}

document.getElementById('startBtn').onclick=startQuiz;document.getElementById('quitBtn').onclick=renderHome;document.getElementById('homeBtn').onclick=renderHome;
document.querySelectorAll('#selfEval button').forEach(b=>b.onclick=()=>evalAnswer(b.dataset.eval));
document.getElementById('prevMonth').onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()-1,1);renderCalendar()};
document.getElementById('nextMonth').onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()+1,1);renderCalendar()};

fetch('questions.json').then(r=>r.json()).then(q=>{questions=q;renderHome()}).catch(()=>{alert('問題データを読み込めませんでした。Webサーバー経由で開いてください。')});
