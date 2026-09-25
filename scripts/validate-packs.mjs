import fs from 'node:fs';
import path from 'node:path';

const packsDir=path.resolve('packs');
const files=fs.readdirSync(packsDir).filter(name=>name.endsWith('.json')).sort();
const failures=[];
const warnings=[];

function fail(file,message){failures.push(`${file}: ${message}`)}
function warn(file,message){warnings.push(`${file}: ${message}`)}
function isNonEmpty(value){return typeof value==='string'&&value.trim().length>0}
function hasPlaceholder(value){return /\b(todo|tbd|placeholder|lorem ipsum|content goes here|fill this|coming soon)\b/i.test(JSON.stringify(value))}
function productionPack(pack){return pack?.meta?.kind!=='test'&&!String(pack?.meta?.id||'').startsWith('engine-test')}

for(const file of files){
  const full=path.join(packsDir,file);
  let pack;
  try{pack=JSON.parse(fs.readFileSync(full,'utf8'))}
  catch(error){fail(file,`invalid JSON: ${error.message}`);continue}

  if(!pack?.meta?.id)fail(file,'meta.id is required');
  if(!pack?.meta?.name)fail(file,'meta.name is required');
  if(!pack?.meta?.targetLanguage)fail(file,'meta.targetLanguage is required');
  if(!pack?.meta?.version)fail(file,'meta.version is required');
  if(!Array.isArray(pack.days)||pack.days.length===0){fail(file,'days[] must not be empty');continue}
  if(!Array.isArray(pack.phases)||pack.phases.length===0)fail(file,'phases[] must not be empty');
  if(hasPlaceholder(pack))fail(file,'placeholder/TODO content detected');

  const prod=productionPack(pack);
  if(prod&&pack.days.length!==30)fail(file,`production pack must have 30 days; found ${pack.days.length}`);
  if(prod&&pack.phases.length!==6)fail(file,`production pack must have 6 phases; found ${pack.phases.length}`);

  const seen=new Set();
  for(let i=0;i<pack.days.length;i++){
    const day=pack.days[i], label=`day ${day?.day??i+1}`;
    if(!Number.isInteger(day?.day))fail(file,`${label}: integer day is required`);
    else if(seen.has(day.day))fail(file,`${label}: duplicate day number`);
    else seen.add(day.day);

    if(prod&&day.day!==i+1)fail(file,`${label}: expected sequential day ${i+1}`);
    if(!isNonEmpty(day?.title))fail(file,`${label}: title is required`);
    if(!isNonEmpty(day?.goal))fail(file,`${label}: goal is required`);

    if(!Array.isArray(day?.session)||day.session.length===0)fail(file,`${label}: session[] is required`);
    else{
      const minutes=day.session.reduce((sum,item)=>sum+Number(item?.minutes||0),0);
      if(prod&&minutes!==60)fail(file,`${label}: session must total 60 minutes; found ${minutes}`);
      day.session.forEach((item,j)=>{
        if(!isNonEmpty(item?.name)||!isNonEmpty(item?.task)||!Number.isFinite(Number(item?.minutes)))fail(file,`${label}: invalid session item at index ${j}`);
      });
    }

    if(!Array.isArray(day?.engine?.slots)||day.engine.slots.length===0)fail(file,`${label}: engine.slots[] is required`);
    else day.engine.slots.forEach((slot,j)=>{
      if(!isNonEmpty(slot?.id)||!isNonEmpty(slot?.label)||!Array.isArray(slot?.options)||slot.options.length===0)fail(file,`${label}: invalid engine slot at index ${j}`);
    });

    if(!Array.isArray(day?.recall)||day.recall.length===0)fail(file,`${label}: recall[] is required`);
    else{
      if(prod&&day.recall.length<4)fail(file,`${label}: production day needs at least 4 recall items`);
      day.recall.forEach((item,j)=>{if(!isNonEmpty(item?.cue)||!isNonEmpty(item?.target))fail(file,`${label}: invalid recall item at index ${j}`)});
    }

    if(!Array.isArray(day?.listening)||day.listening.length===0)fail(file,`${label}: listening[] is required`);
    else day.listening.forEach((item,j)=>{if(!isNonEmpty(item?.title)||!isNonEmpty(item?.text))fail(file,`${label}: invalid listening item at index ${j}`)});

    if(!Array.isArray(day?.drills)||day.drills.length===0)fail(file,`${label}: drills[] is required`);
    else{
      if(prod&&day.drills.length<2)fail(file,`${label}: production day needs at least 2 mutation drills`);
      day.drills.forEach((item,j)=>{if(!isNonEmpty(item?.rule)||!isNonEmpty(item?.base)||!isNonEmpty(item?.prompt)||!isNonEmpty(item?.answer))fail(file,`${label}: invalid drill at index ${j}`)});
    }

    if(!day?.mission||!isNonEmpty(day.mission.title)||!isNonEmpty(day.mission.prompt))fail(file,`${label}: mission title/prompt is required`);
    else{
      if(!Number.isFinite(Number(day.mission.seconds))||Number(day.mission.seconds)<=0)fail(file,`${label}: mission.seconds must be positive`);
      if(!Array.isArray(day.mission.variants)||day.mission.variants.length===0)fail(file,`${label}: mission.variants[] is required`);
      else if(prod&&day.mission.variants.length<3)fail(file,`${label}: production day needs at least 3 mission variants`);
    }
  }

  if(!prod)warn(file,'test/demo pack: production-only 30-day rules skipped');
}

for(const line of warnings)console.warn('WARN',line);
if(failures.length){
  for(const line of failures)console.error('FAIL',line);
  console.error(`\n${failures.length} validation error(s).`);
  process.exit(1);
}
console.log(`Validated ${files.length} language pack(s) successfully.`);
