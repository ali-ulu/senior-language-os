const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const STORAGE_KEY='senior_language_os_v2';
const defaultState={day:1,sessionDone:[],savedSentences:[],errors:[],completedDays:[],activePack:null,missionDone:false,recallStats:[],personalLexicon:[],recallSchedule:{},conversationHistory:[],lastEvaluation:null};
let state=loadState(),pack=null,selected={},drillIndex=0,recallIndex=0,listeningIndex=0,scenarioIndex=0,timerInterval=null,timerRemaining=120,recallStartedAt=null,activeRecallKey=null,mediaRecorder=null,recordedChunks=[],recordingBlob=null,recordingUrl=null;
function loadState(){try{return {...defaultState,...(JSON.parse(localStorage.getItem(STORAGE_KEY))||{})}}catch{return {...defaultState}}}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function pad(n){return String(n).padStart(2,'0')} function phaseForDay(d){return Math.min(6,Math.ceil(d/5))}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
async function init(){bindNav();bindActions();try{pack=state.activePack||await fetch('packs/english-30-day.json').then(r=>r.json())}catch{pack=embeddedPack()}renderAll()}
function embeddedPack(){return {meta:{id:'embedded',name:'Language OS Engine Test',targetLanguage:'English',locale:'en-US',version:'0.2.0',description:'Motor testi. Tam kurs değildir.'},phases:['Survival Engine','Sentence Engine','Time Engine','Conversation Engine','Opinion Engine','Automatic Speech'].map((name,i)=>({id:i+1,days:`${i*5+1}–${i*5+5}`,name})),realLifeMap:['Introduce yourself','Order food','Ask directions','Solve a reservation problem'],days:[demoDay()]}}
function demoDay(){return {day:1,title:'Intent + Access Speed',goal:'Bir ihtiyacı kur, hızlı çağır, duy, dönüştür ve gerçek senaryoda iki kez kullan.',session:[{name:'Ear Training',minutes:10,task:'Dinle-yaz-metni gör-yeniden dinle.'},{name:'Recall Lab',minutes:10,task:'Kalıpları 3 saniyenin altında çağır.'},{name:'Sentence Engine',minutes:15,task:'Parçalardan kişisel cümle üret.'},{name:'Mutation Drill',minutes:10,task:'Tek parçayı değiştirerek yapıyı esnet.'},{name:'Real Life Mission',minutes:10,task:'Aynı görevi iki tur konuş.'},{name:'Error Loop',minutes:5,task:'En önemli hataları yakala.'}],engine:{slots:[{id:'subject',label:'Subject',options:['I','We','They']},{id:'intent',label:'Intent',options:['want to','need to','plan to']},{id:'action',label:'Action',options:['learn','go home','eat','practice','start now']},{id:'tail',label:'Detail',options:['','today','tomorrow','with you']}]},recall:[{cue:'Bir şeyi istemek',target:'I want to…'},{cue:'Bir şeye ihtiyaç duymak',target:'I need to…'},{cue:'Bir şeyi planlamak',target:'I plan to…'}],listening:[{title:'Intent chunk',text:'I need to practice today.',hint:'Bir ihtiyaç + eylem + zaman detayı.'},{title:'Plan chunk',text:'We plan to start tomorrow.',hint:'Plan + eylem + zaman.'}],drills:[{rule:'Eylemi değiştir',base:'I want to learn today.',prompt:'Sadece eylemi “go home” ile değiştir.',answer:'I want to go home today.'},{rule:'Niyeti değiştir',base:'I want to practice today.',prompt:'“want to” yerine “need to” kullan.',answer:'I need to practice today.'}],mission:{title:'Gerçek niyetlerim',prompt:'Bugün gerçekten istediğin, ihtiyaç duyduğun veya planladığın şeyleri anlat.',seconds:120,constraints:['Gerçek hayatından konuş','En az 2 farklı motor kullan','Takılınca tarif et'],variants:['Bir planın değişti. Yeni planını anlat.','Bir arkadaşın senden yardım istedi. Ne yapman gerektiğini anlat.','Bugün yapamayacağın bir şeyi ve nedenini anlat.']}}}
function currentDayData(){return pack.days.find(d=>d.day===state.day)||{...pack.days[0],day:state.day,title:`Day ${state.day} · Engine Practice`,goal:'Bu gün gerçek dil paketi içeriğini bekliyor; çekirdek motor çalışmaya devam eder.'}}
function bindNav(){$$('#nav button').forEach(b=>b.onclick=()=>showView(b.dataset.view))}
function showView(id){$$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${id}`));const t={home:'Bugünün oturumu',engine:'Sentence Engine',recall:'Recall Lab',listening:'Listening Lab',drill:'Mutation Drill',mission:'Speaking Mission',errors:'Error Loop',progress:'30 Günlük Harita',packs:'Dil Paketleri'};$('#viewTitle').textContent=t[id]}
function bindActions(){
 $('#nextDay').onclick=()=>{if(state.day<30){state.completedDays=[...new Set([...state.completedDays,state.day])];state.day++;state.sessionDone=[];state.missionDone=false;state.conversationHistory=[];state.lastEvaluation=null;persist();renderAll();toast(`Gün ${state.day} açıldı`)}};
 $('#resetSession').onclick=()=>{state.sessionDone=[];state.missionDone=false;persist();renderAll();toast('Oturum sıfırlandı')};
 $('#saveSentence').onclick=saveSentence;$('#randomSentence').onclick=randomizeSentence;$('#speakSentence').onclick=()=>speak(buildSentence());
 $('#revealDrill').onclick=()=>$('#drillAnswer').classList.toggle('hidden');$('#nextDrill').onclick=()=>{const a=currentDayData().drills||[];if(a.length){drillIndex=(drillIndex+1)%a.length;renderDrill()}};
 $('#startRecall').onclick=startRecall;$('#revealRecall').onclick=revealRecall;$('#nextRecall').onclick=nextRecallCard;$('#recallRatings button').forEach(b=>b.onclick=()=>rateRecall(b.dataset.rating));
 $('#personalForm').onsubmit=addPersonal;
 $('#playListen').onclick=playListening;$('#showTranscript').onclick=()=>$('#listenTranscript').classList.toggle('hidden');$('#nextListen').onclick=()=>{const a=currentDayData().listening||[];if(a.length){listeningIndex=(listeningIndex+1)%a.length;renderListening()}};$('#checkDictation').onclick=checkDictation;
 $('#toggleTimer').onclick=toggleTimer;$('#resetTimer').onclick=()=>resetTimer(timerRemaining||120);$('.round-switch button').forEach(b=>b.onclick=()=>setRound(Number(b.dataset.minutes),b));$('#nextScenario').onclick=nextScenario;$('#recordBtn').onclick=toggleRecording;
 $('#startConversation').onclick=startConversation;$('#sendConversation').onclick=sendConversation;$('#voiceInput').onclick=startVoiceInput;$('#finishConversation').onclick=finishConversation;$('#conversationInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendConversation()}};$('#speechEvalBtn').onclick=analyzeSpeechRecording;
 $('#missionDone').onchange=e=>{state.missionDone=e.target.checked;if(e.target.checked&&!state.sessionDone.includes('Real Life Mission'))state.sessionDone.push('Real Life Mission');persist();renderProgressBits()};
 $('#errorForm').onsubmit=addError;$('#packInput').onchange=loadPackFile;$('#downloadState').onclick=downloadState;
}
function renderAll(){renderHeader();renderHome();renderEngine();renderRecall();renderListening();renderDrill();renderMission();renderErrors();renderProgress();renderPack()}
function renderHeader(){const ph=pack.phases?.[phaseForDay(state.day)-1];$('#phaseLabel').textContent=`PHASE ${pad(phaseForDay(state.day))} · ${(ph?.name||'ENGINE').toUpperCase()}`;$('#sideDay').textContent=`${state.day} / 30`}
function renderHome(){const d=currentDayData();$('#heroDay').textContent=pad(state.day);$('#lessonTitle').textContent=d.title;$('#lessonGoal').textContent=d.goal;const s=d.session||[];$('#sessionFlow').innerHTML=s.map(x=>`<span class="session-step ${state.sessionDone.includes(x.name)?'done':''}">${esc(x.name)}</span>`).join('');$('#timeline').innerHTML=s.map((x,i)=>`<button class="timeline-item" data-session="${esc(x.name)}"><span>${pad(i+1)} · ${x.minutes} dk</span><strong>${esc(x.name)}</strong><p>${esc(x.task)}</p></button>`).join('');$$('#timeline [data-session]').forEach(b=>b.onclick=()=>toggleSession(b.dataset.session));renderProgressBits();renderMetrics()}
function toggleSession(n){state.sessionDone=state.sessionDone.includes(n)?state.sessionDone.filter(x=>x!==n):[...state.sessionDone,n];persist();renderHome()}
function renderProgressBits(){const total=(currentDayData().session||[]).length||1,p=Math.min(100,Math.round(state.sessionDone.length/total*100));$('#progressPercent').textContent=`${p}%`;$('#progressRing').style.background=`conic-gradient(var(--accent) ${p*3.6}deg,#252a34 0deg)`;$('#missionDone').checked=!!state.missionDone}
function renderMetrics(){const times=state.recallStats.map(x=>x.seconds).filter(Number.isFinite).sort((a,b)=>a-b),med=times.length?times[Math.floor(times.length/2)]:null;$('#metricRecall').textContent=med?`${med.toFixed(1)} sn`:'—';$('#metricErrors').textContent=state.errors.filter(x=>!x.resolved).length;$('#metricPersonal').textContent=state.personalLexicon.length;$('#metricDays').textContent=state.completedDays.length}
function renderEngine(){const slots=currentDayData().engine?.slots||[];selected={};slots.forEach(s=>selected[s.id]=s.options?.[0]??'');$('#slotGroups').innerHTML=slots.map(s=>`<div class="slot-group"><div class="slot-title"><strong>${esc(s.label)}</strong><span>${esc(s.id)}</span></div><div class="tokens">${(s.options||[]).map((o,i)=>`<button class="token ${i===0?'active':''}" data-slot="${esc(s.id)}" data-value="${esc(o)}">${esc(o||'∅')}</button>`).join('')}</div></div>`).join('');$$('#slotGroups .token').forEach(b=>b.onclick=()=>{selected[b.dataset.slot]=b.dataset.value;$$(`[data-slot="${CSS.escape(b.dataset.slot)}"]`).forEach(x=>x.classList.remove('active'));b.classList.add('active');updateSentence()});updateSentence();renderSaved()}
function buildSentence(){let s=Object.values(selected).filter(Boolean).join(' ').replace(/\s+/g,' ').trim();if(!s)return 'Choose chunks to build a sentence.';return s[0].toUpperCase()+s.slice(1)+(/[.!?]$/.test(s)?'':'.')}
function updateSentence(){$('#sentenceOutput').textContent=buildSentence()}
function randomizeSentence(){(currentDayData().engine?.slots||[]).forEach(s=>{const a=s.options||[];selected[s.id]=a[Math.floor(Math.random()*a.length)]??''});$$('#slotGroups .token').forEach(b=>b.classList.toggle('active',selected[b.dataset.slot]===b.dataset.value));updateSentence()}
function saveSentence(){const s=buildSentence();if(!state.savedSentences.includes(s))state.savedSentences.unshift(s);state.savedSentences=state.savedSentences.slice(0,20);persist();renderSaved();toast('Cümle kaydedildi')}
function renderSaved(){$('#savedSentences').innerHTML=state.savedSentences.length?state.savedSentences.map(s=>`<div class="saved-item"><strong>${esc(s)}</strong></div>`).join(''):'<div class="empty">Henüz kişisel cümle yok.</div>'}
function speak(text){if(!('speechSynthesis'in window)){toast('Bu tarayıcıda ses motoru yok');return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);if(pack.meta?.locale)u.lang=pack.meta.locale;speechSynthesis.speak(u)}
function recallKey(day,index,item){return `${pack.meta?.id||'pack'}:${day}:${index}:${norm(item.cue)}`}
function allRecallItems(){
 const items=[];
 (pack.days||[]).filter(d=>d.day<=state.day).forEach(d=>(d.recall||[]).forEach((item,index)=>items.push({...item,key:recallKey(d.day,index,item),introducedDay:d.day,sourceDay:d.day,personal:false})));
 state.personalLexicon.forEach(item=>items.push({cue:item.cue,target:item.target,key:`personal:${item.id}`,introducedDay:item.introducedDay||1,sourceDay:item.introducedDay||1,personal:true}));
 return items;
}
function scheduleFor(item){
 const saved=state.recallSchedule[item.key];
 return saved||{dueDay:item.introducedDay,interval:0,reps:0,lapses:0,ease:2.2,lastSeconds:null,lastRating:null};
}
function recallItems(){
 return allRecallItems().filter(item=>scheduleFor(item).dueDay<=state.day).sort((a,b)=>{
   const sa=scheduleFor(a),sb=scheduleFor(b);
   const slowA=sa.lastSeconds>3?1:0,slowB=sb.lastSeconds>3?1:0;
   return (sa.dueDay-sb.dueDay)||(slowB-slowA)||(sb.lapses-sa.lapses)||(a.introducedDay-b.introducedDay)||a.key.localeCompare(b.key);
 });
}
function nextRecallCard(){const a=recallItems();if(!a.length)return renderRecall();recallIndex=(recallIndex+1)%a.length;renderRecall()}
function renderRecall(){
 const a=recallItems();renderReviewQueue(a);renderPersonal();recallStartedAt=null;activeRecallKey=null;
 $('#recallAnswer').classList.add('hidden');$('#revealRecall').classList.add('hidden');$('#recallRatings').classList.add('hidden');$('#recallClock').textContent='hazır';
 if(!a.length){
   recallIndex=0;$('#recallIndex').textContent='0 / 0';$('#recallCue').textContent='Bugünkü tekrar kuyruğu tamamlandı.';$('#recallAnswer').textContent='Bir sonraki program gününde zamanı gelen kalıplar otomatik dönecek.';$('#recallAnswer').classList.remove('hidden');$('#startRecall').disabled=true;$('#nextRecall').disabled=true;return;
 }
 $('#startRecall').disabled=false;$('#nextRecall').disabled=false;recallIndex=Math.min(recallIndex,a.length-1);const x=a[recallIndex],sc=scheduleFor(x);
 $('#recallIndex').textContent=`${recallIndex+1} / ${a.length}`;$('#recallCue').textContent=x.cue;$('#recallAnswer').textContent=x.target;
 $('#recallClock').textContent=sc.lastSeconds==null?'yeni':`son: ${sc.lastSeconds.toFixed(1)} sn · ${sc.lastSeconds<=3?'otomatikleşiyor':'yavaş'}`;
}
function startRecall(){const x=recallItems()[recallIndex];if(!x)return;activeRecallKey=x.key;recallStartedAt=performance.now();$('#revealRecall').classList.remove('hidden');$('#recallClock').textContent='çağır…'}
function revealRecall(){
 if(!recallStartedAt||!activeRecallKey)return;const x=allRecallItems().find(i=>i.key===activeRecallKey);if(!x)return;
 const sec=(performance.now()-recallStartedAt)/1000;$('#recallClock').textContent=`${sec.toFixed(1)} sn ${sec<=3?'✓':'→ hedef <3'}`;$('#recallAnswer').classList.remove('hidden');$('#recallRatings').classList.remove('hidden');
 state.recallStats.push({day:state.day,itemKey:x.key,cue:x.cue,seconds:sec,at:new Date().toISOString()});state.recallStats=state.recallStats.slice(-500);persist();renderMetrics();recallStartedAt=null;
}
function rateRecall(r){
 const last=state.recallStats[state.recallStats.length-1];if(!last||!activeRecallKey)return;
 last.rating=r;const item=allRecallItems().find(i=>i.key===activeRecallKey);if(!item)return;
 const prev=scheduleFor(item),sec=last.seconds;let interval,ease=prev.ease||2.2,lapses=prev.lapses||0;
 if(r==='again'||sec>6){interval=1;ease=Math.max(1.3,ease-.2);lapses++}
 else if(r==='hard'||sec>3){interval=Math.max(1,Math.round((prev.interval||1)*1.4));ease=Math.max(1.3,ease-.1)}
 else if(r==='easy'){interval=prev.interval?Math.max(3,Math.round(prev.interval*(ease+.6))):4;ease=Math.min(3.2,ease+.1)}
 else {interval=prev.interval?Math.max(2,Math.round(prev.interval*ease)):2}
 interval=Math.min(30,interval);
 state.recallSchedule[item.key]={dueDay:state.day+interval,interval,reps:(prev.reps||0)+1,lapses,ease,lastSeconds:sec,lastRating:r,lastReviewedDay:state.day};
 persist();recallIndex=0;activeRecallKey=null;renderRecall();renderMetrics();
}
function addPersonal(e){e.preventDefault();const cue=$('#personalCue').value.trim(),target=$('#personalTarget').value.trim();state.personalLexicon.unshift({id:Date.now(),cue,target,introducedDay:state.day});state.personalLexicon=state.personalLexicon.slice(0,100);persist();e.target.reset();recallIndex=0;renderRecall();toast('Kişisel ifadeye eklendi')}
function renderReviewQueue(queue=recallItems()){
 const all=allRecallItems(),due=queue.length,slow=all.filter(x=>{const sc=scheduleFor(x);return sc.dueDay<=state.day&&sc.lastSeconds>3}).length,next=all.map(x=>scheduleFor(x).dueDay).filter(d=>d>state.day).sort((a,b)=>a-b)[0];
 $('#queueSummary').textContent=due+' bugün · '+slow+' yavaş · '+(next?'sonraki Gün '+next:'yeni sıra yok');
 $('#reviewQueue').innerHTML=queue.slice(0,8).map(x=>{const sc=scheduleFor(x);const source=x.personal?'kişisel':'Gün '+x.sourceDay;const reps=sc.reps?sc.reps+' tekrar':'yeni';const speed=sc.lastSeconds==null?'NEW':sc.lastSeconds.toFixed(1)+'s';return `<div class="queue-item"><div><strong>${esc(x.cue)}</strong><span>${source} · ${reps}</span></div><b class="${sc.lastSeconds>3?'slow':'fast'}">${speed}</b></div>`}).join('')||'<div class="empty">Bugün için bekleyen tekrar yok.</div>';
}
function renderPersonal(){$('#personalList').innerHTML=state.personalLexicon.slice(0,8).map(x=>`<div class="saved-item"><strong>${esc(x.target)}</strong><span>${esc(x.cue)}</span></div>`).join('')||'<div class="empty">Söyleyemediğin ifadeleri buraya ekle.</div>'}
function currentListen(){const a=currentDayData().listening||[];return a[listeningIndex]||{title:'Listening içeriği yok',text:'',hint:'Dil paketine listening[] ekle.'}}
function renderListening(){const x=currentListen();$('#listenTitle').textContent=x.title;$('#listenHint').textContent=x.hint||'';$('#listenTranscript').textContent=x.text;$('#listenTranscript').classList.add('hidden');$('#dictationInput').value='';$('#dictationScore').textContent=''}
function playListening(){const x=currentListen();if(x.text)speak(x.text)}
function norm(s){return s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s']/gu,'').replace(/\s+/g,' ').trim()}
function checkDictation(){const target=norm(currentListen().text),typed=norm($('#dictationInput').value);if(!target){return}const tw=target.split(' '),uw=typed.split(' '),hit=tw.filter((w,i)=>uw[i]===w).length,p=Math.round(hit/tw.length*100);$('#dictationScore').textContent=`Kelime-konum eşleşmesi: %${p}. Şimdi metni aç, farkı gör, kapat ve tekrar dinle.`}
function renderDrill(){const a=currentDayData().drills||[];if(!a.length)return;drillIndex=Math.min(drillIndex,a.length-1);const d=a[drillIndex];$('#drillIndex').textContent=`${drillIndex+1} / ${a.length}`;$('#drillRule').textContent=d.rule;$('#drillBase').textContent=d.base;$('#drillPrompt').textContent=d.prompt;$('#drillAnswer').textContent=d.answer;$('#drillAnswer').classList.add('hidden')}
function renderMission(){const m=currentDayData().mission||{};$('#missionTitle').textContent=m.title||'Mission';$('#missionPrompt').textContent=(m.variants?.[scenarioIndex]||m.prompt||'');$('#missionConstraints').innerHTML=(m.constraints||[]).map(c=>`<span class="constraint">${esc(c)}</span>`).join('');$('#scenarioIndex').textContent=`Senaryo ${scenarioIndex+1}`;resetTimer(m.seconds||120);$('#missionDone').checked=!!state.missionDone;renderConversation()}
function nextScenario(){const v=currentDayData().mission?.variants||[];if(v.length){scenarioIndex=(scenarioIndex+1)%v.length;state.conversationHistory=[];state.lastEvaluation=null;persist();renderMission()}}
function setRound(min,b){$$('.round-switch button').forEach(x=>x.classList.remove('active'));b.classList.add('active');resetTimer(min*60)}
function resetTimer(sec){clearInterval(timerInterval);timerInterval=null;timerRemaining=sec;$('#toggleTimer').textContent='Başlat';drawTimer()}
function drawTimer(){const m=Math.floor(timerRemaining/60),s=timerRemaining%60;$('#timer').textContent=`${pad(m)}:${pad(s)}`}
function toggleTimer(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;$('#toggleTimer').textContent='Devam et';return}$('#toggleTimer').textContent='Duraklat';timerInterval=setInterval(()=>{timerRemaining--;drawTimer();if(timerRemaining<=0){clearInterval(timerInterval);timerInterval=null;$('#toggleTimer').textContent='Tur tamamlandı';toast('Tur tamamlandı. Aynı görevi yeniden yap.') }},1000)}
async function toggleRecording(){const b=$('#recordBtn');if(mediaRecorder?.state==='recording'){mediaRecorder.stop();b.textContent='● Ses kaydı';return}if(!navigator.mediaDevices?.getUserMedia){toast('Mikrofon kaydı desteklenmiyor');return}try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});recordedChunks=[];recordingBlob=null;$('#speechFeedback').classList.add('hidden');mediaRecorder=new MediaRecorder(stream);mediaRecorder.ondataavailable=e=>{if(e.data.size)recordedChunks.push(e.data)};mediaRecorder.onstop=()=>{recordingBlob=new Blob(recordedChunks,{type:mediaRecorder.mimeType||'audio/webm'});if(recordingUrl)URL.revokeObjectURL(recordingUrl);recordingUrl=URL.createObjectURL(recordingBlob);const a=$('#recordingPlayback');a.src=recordingUrl;a.classList.remove('hidden');stream.getTracks().forEach(t=>t.stop());toast('Ses kaydı hazır')};mediaRecorder.start();b.textContent='■ Kaydı bitir'}catch{toast('Mikrofon izni alınamadı')}}
function blobToBase64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=reject;r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.readAsDataURL(blob)})}
async function analyzeSpeechRecording(){
 if(!recordingBlob){toast('Önce bir konuşma kaydı al.');return}
 const box=$('#speechFeedback'),btn=$('#speechEvalBtn');btn.disabled=true;btn.textContent='Analiz ediliyor…';
 try{
   const audioBase64=await blobToBase64(recordingBlob);
   const res=await fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audioBase64,mimeType:recordingBlob.type||'audio/webm',locale:pack.meta?.locale||'en-US',scenario:conversationScenario()})});
   if(!res.ok)throw new Error('speech unavailable');const data=await res.json();
   box.classList.remove('hidden');box.innerHTML=`<p class="eyebrow">SPEECH FEEDBACK</p>${data.transcript?`<p><strong>Transcript:</strong> ${esc(data.transcript)}</p>`:''}<div class="speech-scores"><div><span>Pronunciation</span><strong>${esc(data.pronunciation?.score??'—')}</strong><small>${esc(data.pronunciation?.notes||'')}</small></div><div><span>Fluency</span><strong>${esc(data.fluency?.score??'—')}</strong><small>${esc(data.fluency?.notes||'')}</small></div></div>`;
 }catch{box.classList.remove('hidden');box.innerHTML='<p>Ses değerlendirme servisi bağlı değil. Kayıt alınabiliyor; gerçek pronunciation/fluency skoru yalnızca yapılandırılmış speech endpoint ile gösterilir.</p>'}
 finally{btn.disabled=false;btn.textContent='Ses analizi'}
}
function conversationScenario(){const m=currentDayData().mission||{};return m.variants?.[scenarioIndex]||m.prompt||m.title||'Everyday conversation'}
function setAIStatus(text,kind=''){$('#aiStatus').textContent=text;$('#aiStatus').className='ai-status '+kind}
function renderConversation(){
 const log=$('#conversationLog');if(!log)return;
 const history=state.conversationHistory||[];
 log.innerHTML=history.length?history.map(x=>`<div class="chat-row ${x.role}"><span>${x.role==='assistant'?'PARTNER':'YOU'}</span><p>${esc(x.text)}</p></div>`).join(''):'<div class="conversation-empty">Senaryoyu başlat. Partner tek seferde tek soru soracak; konuşma bitene kadar düzeltme yapmayacak.</div>';
 log.scrollTop=log.scrollHeight;
 if(state.lastEvaluation)renderEvaluation(state.lastEvaluation);else $('#evaluationBox').classList.add('hidden');
}
async function aiRequest(action){
 try{
   const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,locale:pack.meta?.locale||'en-US',scenario:conversationScenario(),history:state.conversationHistory||[]})});
   if(!res.ok)throw new Error('AI endpoint unavailable');const data=await res.json();setAIStatus('AI connected','online');return data;
 }catch{setAIStatus('local simulator','local');return null}
}
function localConversationReply(opening=false){
 const locale=(pack.meta?.locale||'').toLowerCase();if(!locale.startsWith('en'))return 'AI endpoint required for live role-play in this language pack.';
 const day=state.day,turns=(state.conversationHistory||[]).filter(x=>x.role==='user').length;
 if(opening){if(day===4)return 'Hi. What would you like to order?';if(day===5)return 'Hi. Where are you trying to go?';if(day===20)return 'Welcome. What name is the reservation under?';if(day===23)return 'Hello. Where are you travelling today?';if(day===24)return 'Hi. Tell me what problem you are having.';return 'Hi. Let’s start. What would you like to say first?'}
 const prompts=['Could you tell me a little more?','Why is that important to you?','What happened next?','What would you like to do now?','Can you give me an example?'];
 return prompts[Math.min(turns-1,prompts.length-1)];
}
async function startConversation(){
 state.conversationHistory=[];state.lastEvaluation=null;setAIStatus('connecting…');renderConversation();
 const data=await aiRequest('reply');const reply=data?.reply||localConversationReply(true);state.conversationHistory=[{role:'assistant',text:reply}];persist();renderConversation();speak(reply);
}
async function sendConversation(){
 const input=$('#conversationInput'),text=input.value.trim();if(!text)return;
 if(!(state.conversationHistory||[]).length)await startConversation();
 state.conversationHistory.push({role:'user',text});input.value='';persist();renderConversation();setAIStatus('thinking…');
 const data=await aiRequest('reply');const reply=data?.reply||localConversationReply(false);state.conversationHistory.push({role:'assistant',text:reply});persist();renderConversation();speak(reply);
}
function startVoiceInput(){
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){toast('Bu tarayıcıda konuşmayı yazıya çevirme yok; metin alanını kullan.');return}
 const rec=new Recognition();rec.lang=pack.meta?.locale||'en-US';rec.interimResults=false;rec.maxAlternatives=1;
 rec.onstart=()=>setAIStatus('listening…','listening');rec.onerror=()=>setAIStatus('microphone error','');rec.onend=()=>{if($('#aiStatus').textContent==='listening…')setAIStatus('ready')};
 rec.onresult=e=>{const text=e.results?.[0]?.[0]?.transcript||'';$('#conversationInput').value=text;setAIStatus('speech captured','online')};rec.start();
}
async function finishConversation(){
 const learnerTurns=(state.conversationHistory||[]).filter(x=>x.role==='user');if(!learnerTurns.length){toast('Önce en az bir cevap ver.');return}
 setAIStatus('evaluating…');const data=await aiRequest('evaluate');
 if(!data?.evaluation){state.lastEvaluation={unavailable:true,summary:'AI değerlendirme endpoint’i bağlı değil. Konuşma akışı yerel simülatörle çalışmaya devam ediyor.'};persist();renderEvaluation(state.lastEvaluation);return}
 state.lastEvaluation=data.evaluation;persist();renderEvaluation(state.lastEvaluation);
}
function renderEvaluation(ev){
 const box=$('#evaluationBox');if(!box)return;box.classList.remove('hidden');
 if(ev.unavailable){box.innerHTML=`<p>${esc(ev.summary)}</p>`;return}
 const errors=(ev.topErrors||[]).slice(0,3);box.innerHTML=`<p class="eyebrow">SESSION REVIEW</p><h4>${esc(ev.summary||'Konuşma değerlendirmesi')}</h4>${errors.map((x,i)=>`<div class="eval-error"><span>${i+1}</span><div><del>${esc(x.said||'')}</del><strong>${esc(x.correct||'')}</strong><small>${esc(x.reason||'')}</small></div></div>`).join('')}${(ev.strengths||[]).length?`<p class="eval-strengths">Güçlü taraflar: ${(ev.strengths||[]).map(esc).join(' · ')}</p>`:''}${errors.length?'<button class="ghost" id="saveEvalErrors">Top 3 hatayı Error Loop’a aktar</button>':''}`;
 const b=$('#saveEvalErrors');if(b)b.onclick=()=>saveEvaluationErrors(errors);
}
function saveEvaluationErrors(errors){
 errors.forEach(x=>{if(!x.correct)return;const key=norm(x.correct),found=state.errors.find(e=>!e.resolved&&norm(e.correct)===key);if(found){found.count=(found.count||1)+1;found.said=x.said||found.said}else state.errors.unshift({id:Date.now()+Math.random(),intent:'AI conversation review',said:x.said||'',correct:x.correct,count:1,resolved:false,created:new Date().toISOString()})});
 state.errors=state.errors.slice(0,80);persist();renderErrors();renderMetrics();toast('Top 3 hata Error Loop’a aktarıldı');
}
function addError(e){e.preventDefault();const intent=$('#errorIntent').value.trim(),said=$('#errorSaid').value.trim(),correct=$('#errorCorrect').value.trim(),key=norm(correct);const found=state.errors.find(x=>!x.resolved&&norm(x.correct)===key);if(found){found.count=(found.count||1)+1;found.intent=intent||found.intent;found.said=said||found.said;found.lastSeen=new Date().toISOString()}else state.errors.unshift({id:Date.now(),intent,said,correct,count:1,resolved:false,created:new Date().toISOString()});state.errors=state.errors.slice(0,80);persist();e.target.reset();renderErrors();renderMetrics();toast('Hata döngüsüne eklendi')}
function renderErrors(){const active=state.errors.filter(x=>!x.resolved).sort((a,b)=>(b.count||1)-(a.count||1));$('#priorityErrors').innerHTML=active.slice(0,3).map((x,i)=>`<article><span>ODAK ${i+1}</span><strong>${esc(x.correct)}</strong><small>${x.count||1} kez tekrar etti</small></article>`).join('')||'<div class="empty">Henüz öncelikli hata yok.</div>';$('#errorList').innerHTML=state.errors.length?state.errors.map(x=>`<div class="error-card ${x.resolved?'resolved':''}"><strong>${esc(x.intent)}</strong>${x.said?`<p>Dedim: ${esc(x.said)}</p>`:''}<p>Doğal ifade: ${esc(x.correct)}</p><p>Tekrar: ${x.count||1}</p><div class="error-actions"><button class="ghost" data-resolve="${x.id}">${x.resolved?'Geri aç':'Çözüldü'}</button><button class="ghost" data-delete="${x.id}">Sil</button></div></div>`).join(''):'<div class="empty">Hata defteri boş.</div>';$$('[data-resolve]').forEach(b=>b.onclick=()=>{const x=state.errors.find(e=>e.id===Number(b.dataset.resolve));if(x)x.resolved=!x.resolved;persist();renderErrors();renderMetrics()});$$('[data-delete]').forEach(b=>b.onclick=()=>{state.errors=state.errors.filter(e=>e.id!==Number(b.dataset.delete));persist();renderErrors();renderMetrics()})}
function renderProgress(){$('#phases').innerHTML=(pack.phases||[]).map(p=>`<div class="phase ${phaseForDay(state.day)===p.id?'active':''}"><span>${esc(p.days)}</span><strong>${esc(p.name)}</strong></div>`).join('');$('#dayGrid').innerHTML=Array.from({length:30},(_,i)=>i+1).map(d=>`<button class="day ${d===state.day?'current':''} ${state.completedDays.includes(d)?'complete':''}" data-day="${d}">${pad(d)}</button>`).join('');$('#dayGrid [data-day]').forEach(b=>b.onclick=()=>{state.day=Number(b.dataset.day);state.sessionDone=[];state.missionDone=false;state.conversationHistory=[];state.lastEvaluation=null;persist();renderAll();showView('home')})}
function renderPack(){$('#packName').textContent=pack.meta?.name||'Unnamed pack';$('#packMeta').textContent=`${pack.meta?.targetLanguage||'Unknown'} · v${pack.meta?.version||'0'} · ${pack.meta?.description||''}`}
async function loadPackFile(e){const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());validatePack(data);pack=data;state.activePack=data;state.day=1;state.sessionDone=[];state.completedDays=[];state.recallSchedule={};state.conversationHistory=[];state.lastEvaluation=null;persist();drillIndex=recallIndex=listeningIndex=scenarioIndex=0;renderAll();toast(`${data.meta.name} yüklendi`)}catch(err){toast(`Paket açılamadı: ${err.message}`)}finally{e.target.value=''}}
function validatePack(p){if(!p?.meta?.id||!p?.meta?.name||!Array.isArray(p.days)||!p.days.length)throw new Error('meta.id, meta.name ve days[] gerekli');const d=p.days[0];if(!d.engine||!Array.isArray(d.drills)||!d.mission)throw new Error('Günlerde engine, drills ve mission gerekli')}
function downloadState(){const safe={...state,activePack:state.activePack?.meta?{meta:state.activePack.meta}:null};const blob=new Blob([JSON.stringify(safe,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='senior-language-os-state.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
init();
