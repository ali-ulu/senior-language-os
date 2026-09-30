const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

const ROOT_KEY='senior_language_os_v4';
const OLD_KEY='senior_language_os_v3';
const LEGACY_KEY='senior_language_os_v2';
const DEFAULT_PACK='english-30-day-v1';

const PACKS={
  'english-30-day-v1':{
    path:'packs/english-30-day.json',
    audio:'audio/english-v1.json',
    brand:'ENGLISH',
    fallbackName:'Senior English'
  },
  'german-30-day-v1':{
    path:'packs/german-30-day.json',
    audio:'audio/german-v1.json',
    brand:'DEUTSCH',
    fallbackName:'Senior Deutsch'
  }
};

const STEPS=['listen','build','recall','change','speak'];
const STEP_LABELS=['Dinle','Cümle kur','Hatırla','Değiştir','Konuş'];

const defaults={
  day:1,
  step:0,
  startedDays:[],
  completedDays:[],
  errors:[],
  recallStats:[],
  recallSchedule:{},
  savedSentences:[]
};

function freshState(){return JSON.parse(JSON.stringify(defaults))}

function migrateLegacy(){
  let old=null;
  try{old=JSON.parse(localStorage.getItem(OLD_KEY))}catch{}
  if(!old){try{old=JSON.parse(localStorage.getItem(LEGACY_KEY))}catch{}}
  if(!old)return null;
  const migrated=freshState();
  for(const key of Object.keys(defaults)){
    if(old[key]!==undefined)migrated[key]=old[key];
  }
  return migrated;
}

function loadRoot(){
  try{
    const saved=JSON.parse(localStorage.getItem(ROOT_KEY));
    if(saved?.progress)return {
      activePackId:PACKS[saved.activePackId]?saved.activePackId:DEFAULT_PACK,
      progress:saved.progress||{}
    };
  }catch{}
  const legacy=migrateLegacy();
  return {
    activePackId:DEFAULT_PACK,
    progress:legacy?{[DEFAULT_PACK]:legacy}:{}
  };
}

function loadCourseState(id){
  return {...freshState(),...(root.progress[id]||{})};
}

let root=loadRoot();
let activePackId=root.activePackId;
let state=loadCourseState(activePackId);
let pack=null;
let audioManifest={};
let lessonAudio=null;
let selectedPattern='';
let customEnding='';
let recallIndex=0;
let recallStartedAt=null;
let drillIndex=0;
let recorder=null;
let chunks=[];
let recordingUrl=null;

function save(){
  root.activePackId=activePackId;
  root.progress[activePackId]=state;
  localStorage.setItem(ROOT_KEY,JSON.stringify(root));
}

function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function norm(v=''){return String(v).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s']/gu,'').replace(/\s+/g,' ').trim()}
function pad(n){return String(n).padStart(2,'0')}
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1700)}
function currentDay(){return pack.days.find(x=>x.day===state.day)||pack.days[0]}
function phase(){return pack.phases?.find(x=>x.id===Math.ceil(state.day/5))}
function isDone(){return state.completedDays.includes(state.day)}
function targetName(){return pack?.meta?.targetLanguageTr||pack?.meta?.targetLanguage||'hedef dili'}
function targetPossessive(){
  const name=targetName();
  if(name==='Almanca')return 'Almancasını';
  if(name==='İngilizce')return 'İngilizcesini';
  return name+' karşılığını';
}

async function fetchJson(path){
  const r=await fetch(path);
  if(!r.ok)throw new Error('fetch failed');
  return r.json();
}

async function loadActivePack(){
  const cfg=PACKS[activePackId]||PACKS[DEFAULT_PACK];
  try{pack=await fetchJson(cfg.path)}
  catch{pack=fallbackPack(cfg)}
  try{audioManifest=cfg.audio?await fetchJson(cfg.audio):{}}
  catch{audioManifest={}}
  document.title=(pack.meta?.name||cfg.fallbackName)+' · Senior';
}

async function init(){
  await loadActivePack();
  bind();
  resetDayPractice();
  render();
}

function fallbackPack(cfg){
  const isGerman=activePackId==='german-30-day-v1';
  return {
    meta:{
      id:activePackId,
      name:cfg.fallbackName,
      targetLanguage:isGerman?'German':'English',
      targetLanguageTr:isGerman?'Almanca':'İngilizce',
      locale:isGerman?'de-DE':'en-US',
      version:'offline'
    },
    phases:[{id:1,name:'Başlangıç'}],
    days:[{
      day:1,title:'Kendini tanıt',goal:'Adını ve yaşadığın yeri kısa cümlelerle anlat.',
      recall:isGerman
        ?[{cue:'Ben ...’ım.',target:'Ich bin …'},{cue:'...’da yaşıyorum.',target:'Ich wohne in …'}]
        :[{cue:'Ben ...’ım.',target:'I’m …'},{cue:'...’da yaşıyorum.',target:'I live in …'}],
      listening:[{title:'Tanışma',text:isGerman?'Hallo, ich bin Alex. Ich wohne in Berlin.':"Hi, I’m Alex. I live in Berlin.",hint:'İsim + yaşadığın yer.'}],
      drills:[{rule:'Yeri değiştir',base:isGerman?'Ich wohne in Berlin.':'I live in Berlin.',prompt:'Şehri değiştir.',answer:isGerman?'Ich wohne in Hamburg.':'I live in London.'}],
      mission:{title:'Kendini tanıt',prompt:'Adını ve yaşadığın yeri kısa biçimde anlat.',seconds:60,variants:['Yeni biriyle tanış.']}
    }]
  };
}

function bind(){
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  $$('#coursePicker [data-pack]').forEach(b=>b.addEventListener('click',()=>switchPack(b.dataset.pack)));

  $('#startDay').onclick=()=>{
    if(!state.startedDays.includes(state.day))state.startedDays.push(state.day);
    state.step=0;save();renderToday();
  };
  $$('[data-next]').forEach(b=>b.onclick=nextStep);
  $('#playListen').onclick=playLessonAudio;
  $('#speakSentence').onclick=()=>speak(buildSentence());
  $('#startRecall').onclick=startRecall;
  $('#revealRecall').onclick=revealRecall;
  $('#recallAgain').onclick=()=>rateRecall('again');
  $('#recallGood').onclick=()=>rateRecall('good');
  $('#finishRecall').onclick=nextStep;
  $('#revealDrill').onclick=()=>$('#drillAnswer').classList.toggle('hidden');
  $('#nextDrill').onclick=nextDrill;
  $('#recordBtn').onclick=toggleRecording;
  $('#completeDay').onclick=completeDay;
  $('#nextDay').onclick=()=>{
    if(state.day<30){state.day++;state.step=0;resetDayPractice();save();go('today')}
  };
  $('#errorForm').onsubmit=addError;
  $('#exportState').onclick=exportState;
  $('#resetAll').onclick=resetCurrentCourse;
}

async function switchPack(id){
  if(!PACKS[id]||id===activePackId)return;
  stopLessonAudio();
  if(recorder?.state==='recording')recorder.stop();
  save();
  activePackId=id;
  state=loadCourseState(id);
  await loadActivePack();
  resetDayPractice();
  save();
  render();
  go('today');
  toast((pack.meta?.name||PACKS[id].fallbackName)+' açıldı.');
}

function go(name){
  stopLessonAudio();
  $('#playListen').onclick=playLessonAudio;
  $$('.screen').forEach(x=>x.classList.remove('active'));
  $('#screen-'+name)?.classList.add('active');
  $$('.main-nav [data-go]').forEach(x=>x.classList.toggle('active',x.dataset.go===name));
  if(name==='today')renderToday();
  if(name==='progress')renderProgress();
  if(name==='errors')renderErrors();
  if(name==='settings')renderSettings();
  window.scrollTo({top:0,behavior:'smooth'});
}

function render(){
  renderHeader();
  renderToday();
  renderProgress();
  renderErrors();
  renderSettings();
}

function renderHeader(){
  $('#topDay').textContent='Gün '+state.day+' / 30';
  $('#topProgress').style.width=Math.round(state.completedDays.length/30*100)+'%';
  $('#brandProduct').textContent=PACKS[activePackId]?.brand||targetName().toUpperCase();
}

function resetDayPractice(){
  selectedPattern=currentDay()?.recall?.[0]?.target||'';
  customEnding='';
  recallIndex=0;
  recallStartedAt=null;
  drillIndex=0;
}

function renderToday(){
  renderHeader();
  const d=currentDay();
  $('#phaseName').textContent=phase()?.name||'Başlangıç';
  $('#dayTitle').textContent=d.title;
  $('#dayGoal').textContent=d.goal;
  $('#startDayNumber').textContent=pad(d.day);
  $('#startGoal').textContent=d.goal;

  const started=state.startedDays.includes(state.day);
  $('#startCard').classList.toggle('hidden',started||isDone());
  $('#lesson').classList.toggle('hidden',!started&&!isDone());

  renderStepRail();
  renderListen();
  renderBuild();
  renderRecall();
  renderDrill();
  renderSpeak();

  if(isDone()){
    STEPS.forEach(id=>$('#step-'+id).classList.add('hidden'));
    $('#doneCard').classList.remove('hidden');
    $('#doneTitle').textContent='Gün '+state.day+' tamam.';
    const checkpoint=currentDay().checkpoint||'';
    $('#checkpointNote').textContent=checkpoint;
    $('#checkpointNote').classList.toggle('hidden',!checkpoint);
  }else{
    $('#doneCard').classList.add('hidden');
    showStep(state.step);
  }
}

function renderStepRail(){
  $('#stepRail').innerHTML=STEPS.map((id,i)=>{
    const done=i<state.step;
    const active=i===state.step&&!isDone();
    return '<button data-step="'+i+'" class="'+(done?'done ':'')+(active?'active':'')+'"><span>'+(done?'✓':i+1)+'</span>'+STEP_LABELS[i]+'</button>';
  }).join('');
  $$('#stepRail [data-step]').forEach(b=>b.onclick=()=>{
    const i=Number(b.dataset.step);
    if(i<=state.step){state.step=i;save();showStep(i);renderStepRail()}
  });
}

function showStep(index){
  STEPS.forEach((id,i)=>$('#step-'+id).classList.toggle('hidden',i!==index));
  $('#doneCard').classList.add('hidden');
}

function nextStep(){
  stopLessonAudio();
  $('#playListen').onclick=playLessonAudio;
  if(state.step<STEPS.length-1){
    state.step++;
    save();
    renderToday();
    $('#lesson').scrollIntoView({behavior:'smooth',block:'start'});
  }
}

function renderListen(){
  const x=currentDay().listening?.[0]||{};
  $('#listenHint').textContent=x.hint||'';
  $('#listenText').textContent=x.text||'';
  const entry=audioEntryForDay(state.day);
  const btn=$('#playListen');
  btn.textContent=entry?.src?'▶ Kaydı dinle':'▶ Dinle';
  btn.title=entry?.src?'Doğal ders kaydı':'Ders kaydı henüz eklenmedi; geçici ses kullanılacak';
}

function buildSentence(){
  if(!selectedPattern)return '';
  const ending=customEnding.trim();
  if(!ending)return selectedPattern;
  if(selectedPattern.includes('…'))return selectedPattern.replace('…',ending);
  return selectedPattern+' '+ending;
}

function renderBuild(){
  const patterns=(currentDay().recall||[]).map(x=>x.target).filter(Boolean).slice(0,5);
  if(!selectedPattern||!patterns.includes(selectedPattern))selectedPattern=patterns[0]||'';
  $('#sentenceOutput').textContent=buildSentence();
  $('#slotGroups').innerHTML=
    '<div class="starter-list">'+patterns.map((p,i)=>'<button class="starter '+(p===selectedPattern?'active':'')+'" data-pattern="'+i+'">'+esc(p)+'</button>').join('')+'</div>'+
    '<label class="fill-line">Boşluğu kendi bilginle doldur<input id="customEnding" value="'+esc(customEnding)+'" placeholder="Kendi cevabını yaz"></label>'+
    '<p class="microcopy">Kalıbı seç, boşluğu kendi bilgine göre doldur.</p>';

  $$('#slotGroups [data-pattern]').forEach(b=>b.onclick=()=>{
    selectedPattern=patterns[Number(b.dataset.pattern)]||patterns[0]||'';
    customEnding='';
    renderBuild();
  });
  $('#customEnding').oninput=e=>{
    customEnding=e.target.value;
    $('#sentenceOutput').textContent=buildSentence();
  };
}

function audioEntryForDay(day){
  const list=Array.isArray(audioManifest?.items)?audioManifest.items:[];
  return list.find(x=>Number(x.day)===Number(day))||null;
}

function stopLessonAudio(){
  if(lessonAudio){
    lessonAudio.pause();
    lessonAudio.currentTime=0;
    lessonAudio=null;
  }
}

function fallbackListen(){
  const text=currentDay().listening?.[0]?.text||'';
  if(!text)return;
  toast('Doğal kayıt henüz eklenmedi. Geçici ses kullanılıyor.');
  speak(text);
}

function playLessonAudio(){
  const entry=audioEntryForDay(state.day);
  if(lessonAudio){
    stopLessonAudio();
    $('#playListen').textContent=entry?.src?'▶ Kaydı dinle':'▶ Dinle';
    return;
  }
  if(!entry?.src){fallbackListen();return}
  lessonAudio=new Audio(entry.src);
  lessonAudio.preload='auto';
  lessonAudio.onplay=()=>{$('#playListen').textContent='■ Durdur'};
  lessonAudio.onended=()=>{$('#playListen').textContent='▶ Kaydı dinle';lessonAudio=null};
  lessonAudio.onerror=()=>{$('#playListen').textContent='▶ Dinle';lessonAudio=null;fallbackListen()};
  lessonAudio.play().catch(()=>{lessonAudio=null;fallbackListen()});
}

function speak(text){
  if(!text)return;
  if(!('speechSynthesis' in window)){toast('Bu tarayıcı sesli okumayı desteklemiyor.');return}
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text.replace('…',''));
  u.lang=pack.meta?.locale||'en-US';
  speechSynthesis.speak(u);
}

function recallItems(){return currentDay().recall||[]}

function renderRecall(){
  const items=recallItems();
  if(!items.length){
    $('#recallCue').textContent='Bugün tekrar kartı yok.';
    $('#recallAnswer').textContent='';
    return;
  }
  recallIndex=Math.min(recallIndex,items.length-1);
  const x=items[recallIndex];
  $('#recallCount').textContent=(recallIndex+1)+' / '+items.length;
  $('#recallCue').textContent=x.cue;
  $('#recallAnswer').textContent=x.target;
  $('#recallAnswer').classList.add('hidden');
  $('#recallNote').textContent='';
  $('#startRecall').classList.remove('hidden');
  $('#revealRecall').classList.add('hidden');
  $('#recallAgain').classList.add('hidden');
  $('#recallGood').classList.add('hidden');
  $('#finishRecall').classList.add('hidden');
  recallStartedAt=null;
}

function startRecall(){
  recallStartedAt=performance.now();
  $('#startRecall').classList.add('hidden');
  $('#revealRecall').classList.remove('hidden');
  $('#recallNote').textContent=targetPossessive()+' söyle. Sonra cevabı aç.';
}

function recallKey(index){return (pack.meta?.id||activePackId)+':'+state.day+':'+index}

function revealRecall(){
  if(!recallStartedAt)return;
  const sec=(performance.now()-recallStartedAt)/1000;
  $('#recallAnswer').classList.remove('hidden');
  $('#revealRecall').classList.add('hidden');
  $('#recallAgain').classList.remove('hidden');
  $('#recallGood').classList.remove('hidden');
  $('#recallNote').textContent=sec<=3?'Güzel. Hızlı geldi.':Math.round(sec*10)/10+' sn. Birkaç tekrar sonra hızlanır.';
  state.recallStats.push({day:state.day,index:recallIndex,seconds:sec,at:new Date().toISOString()});
  state.recallStats=state.recallStats.slice(-500);
  state._lastRecallSeconds=sec;
  save();
  recallStartedAt=null;
}

function rateRecall(rating){
  const key=recallKey(recallIndex);
  const sec=state._lastRecallSeconds||null;
  const old=state.recallSchedule[key]||{interval:0,reps:0};
  const interval=rating==='again'?1:sec&&sec<=3?Math.max(3,(old.interval||1)*2):2;
  state.recallSchedule[key]={interval,dueDay:state.day+interval,reps:(old.reps||0)+1,lastSeconds:sec,lastRating:rating};
  delete state._lastRecallSeconds;
  save();

  if(recallIndex<recallItems().length-1){
    recallIndex++;
    renderRecall();
  }else{
    $('#recallAgain').classList.add('hidden');
    $('#recallGood').classList.add('hidden');
    $('#finishRecall').classList.remove('hidden');
    $('#recallNote').textContent='Bu adım tamam.';
  }
}

function renderDrill(){
  const items=currentDay().drills||[];
  if(!items.length)return;
  drillIndex=Math.min(drillIndex,items.length-1);
  const x=items[drillIndex];
  $('#drillCount').textContent=(drillIndex+1)+' / '+items.length;
  $('#drillBase').textContent=x.base;
  $('#drillPrompt').textContent=x.prompt;
  $('#drillAnswer').textContent=x.answer;
  $('#drillAnswer').classList.add('hidden');
}

function nextDrill(){
  const items=currentDay().drills||[];
  if(!items.length)return;
  drillIndex=(drillIndex+1)%items.length;
  renderDrill();
}

function renderSpeak(){
  const m=currentDay().mission||{};
  $('#missionTitle').textContent=m.title||'Konuş';
  $('#missionPrompt').textContent=m.prompt||'Bugünün cümlelerini kullanarak kısa konuş.';
  $('#recordStatus').textContent='İstersen kaydet.';
  $('#recordBtn').textContent='● Ses kaydı';
}

async function toggleRecording(){
  if(recorder?.state==='recording'){
    recorder.stop();
    $('#recordBtn').textContent='● Ses kaydı';
    return;
  }
  if(!navigator.mediaDevices?.getUserMedia){
    toast('Bu tarayıcı mikrofon kaydını desteklemiyor.');
    return;
  }
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    chunks=[];
    recorder=new MediaRecorder(stream);
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    recorder.onstop=()=>{
      const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
      if(recordingUrl)URL.revokeObjectURL(recordingUrl);
      recordingUrl=URL.createObjectURL(blob);
      $('#recordingPlayback').src=recordingUrl;
      $('#recordingPlayback').classList.remove('hidden');
      $('#recordStatus').textContent='Kayıt hazır. Dinleyip ikinci turu yap.';
      stream.getTracks().forEach(t=>t.stop());
    };
    recorder.start();
    $('#recordBtn').textContent='■ Kaydı bitir';
    $('#recordStatus').textContent='Kaydediliyor…';
  }catch{
    toast('Mikrofon izni alınamadı.');
  }
}

function completeDay(){
  if(!state.completedDays.includes(state.day))state.completedDays.push(state.day);
  state.completedDays.sort((a,b)=>a-b);
  state.step=STEPS.length;
  save();
  renderToday();
  renderHeader();
  toast('Bugün tamam.');
}

function renderProgress(){
  $('#dayGrid').innerHTML=Array.from({length:30},(_,i)=>i+1).map(d=>{
    const data=pack.days.find(x=>x.day===d);
    const done=state.completedDays.includes(d);
    const current=d===state.day;
    return '<button class="day-tile '+(done?'done ':'')+(current?'current':'')+'" data-day="'+d+'"><span>'+pad(d)+'</span><strong>'+esc(data?.title||('Gün '+d))+'</strong><small>'+(done?'Tamamlandı':current?'Bugün':'')+'</small></button>';
  }).join('');
  $$('#dayGrid [data-day]').forEach(b=>b.onclick=()=>{
    state.day=Number(b.dataset.day);
    state.step=0;
    resetDayPractice();
    save();
    go('today');
  });
}

function addError(e){
  e.preventDefault();
  const intent=$('#errorIntent').value.trim();
  const said=$('#errorSaid').value.trim();
  const correct=$('#errorCorrect').value.trim();
  const key=norm(correct);
  const found=state.errors.find(x=>!x.resolved&&norm(x.correct)===key);
  if(found){
    found.count=(found.count||1)+1;
    found.intent=intent||found.intent;
    found.said=said||found.said;
  }else{
    state.errors.unshift({id:Date.now(),intent,said,correct,count:1,resolved:false});
  }
  state.errors=state.errors.slice(0,50);
  save();
  e.target.reset();
  renderErrors();
  toast('Kaydedildi.');
}

function renderErrors(){
  const active=state.errors.filter(x=>!x.resolved).sort((a,b)=>(b.count||1)-(a.count||1));
  $('#errorList').innerHTML=active.length?active.slice(0,12).map((x,i)=>
    '<article class="error-item '+(i<3?'priority':'')+'">'+
    '<span>'+(i<3?String(i+1):'')+'</span>'+
    '<div><small>'+esc(x.intent)+'</small><strong>'+esc(x.correct)+'</strong>'+(x.said?'<p>Sen: '+esc(x.said)+'</p>':'')+'</div>'+
    '<button data-resolve="'+x.id+'">✓</button></article>'
  ).join(''):'<div class="empty-state"><strong>Şimdilik temiz.</strong><p>Takıldığın ifadeleri buraya ekle. En çok tekrar eden üç tanesi üstte kalacak.</p></div>';

  $$('[data-resolve]').forEach(b=>b.onclick=()=>{
    const x=state.errors.find(e=>e.id===Number(b.dataset.resolve));
    if(x)x.resolved=true;
    save();renderErrors();
  });
}

function renderSettings(){
  $('#packName').textContent=pack.meta?.name||PACKS[activePackId]?.fallbackName||'Senior';
  $('#packVersion').textContent=pack.meta?.version||'';
  $$('#coursePicker [data-pack]').forEach(b=>b.classList.toggle('active',b.dataset.pack===activePackId));
}

function exportState(){
  const blob=new Blob([JSON.stringify({
    packId:activePackId,
    packName:pack.meta?.name,
    progress:state
  },null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='senior-'+activePackId+'-progress.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
}

function resetCurrentCourse(){
  const name=pack.meta?.name||'bu kurs';
  if(!confirm(name+' ilerlemesi ve hata kayıtları sıfırlansın mı?'))return;
  state=freshState();
  root.progress[activePackId]=state;
  save();
  resetDayPractice();
  render();
  go('today');
}

init();
