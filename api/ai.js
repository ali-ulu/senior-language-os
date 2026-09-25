const json=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data))};

function systemPrompt(body){
  const scenario=body.scenario||'Everyday conversation';
  const locale=body.locale||'en-US';
  if(body.action==='evaluate'){
    return [
      'You evaluate a language learner conversation.',
      'Return JSON only with this shape: {"summary":"...","topErrors":[{"said":"...","correct":"...","reason":"..."}],"strengths":["..."]}.',
      'Choose at most 3 high-impact repeated or communication-blocking errors.',
      'Do not rewrite every sentence and do not invent errors not present in the learner messages.',
      'Keep explanations concise.',
      'Target locale: '+locale+'. Scenario: '+scenario+'.'
    ].join(' ');
  }
  return [
    'You are a role-play conversation partner for a language learner.',
    'Stay inside the scenario: '+scenario+'.',
    'Use the target language only. Target locale: '+locale+'.',
    'Ask or say only one thing at a time.',
    'Keep each reply short and natural.',
    'Do not correct the learner during the role play.',
    'Create small realistic complications so the learner must adapt.',
    'Do not explain grammar unless the learner ends the role play.'
  ].join(' ');
}

function transcript(body){
  return (body.history||[]).map(x=>({role:x.role==='assistant'?'assistant':'user',content:String(x.text||'')})).filter(x=>x.content);
}

module.exports=async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'POST required'});
  const url=process.env.AI_API_URL, key=process.env.AI_API_KEY, model=process.env.AI_MODEL;
  if(!url||!key||!model) return json(res,503,{error:'AI backend is not configured',code:'AI_NOT_CONFIGURED'});
  let body=req.body;
  if(typeof body==='string'){try{body=JSON.parse(body)}catch{return json(res,400,{error:'Invalid JSON'})}}
  body=body||{};
  const messages=[{role:'system',content:systemPrompt(body)},...transcript(body)];
  if(body.action==='evaluate') messages.push({role:'user',content:'Evaluate the learner messages in this conversation now.'});
  try{
    const upstream=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body:JSON.stringify({model,messages,temperature:body.action==='evaluate'?0.2:0.7})
    });
    const raw=await upstream.text();
    if(!upstream.ok) return json(res,502,{error:'AI upstream failed',status:upstream.status});
    let data;try{data=JSON.parse(raw)}catch{return json(res,502,{error:'AI upstream returned invalid JSON'})}
    const content=data?.choices?.[0]?.message?.content;
    if(!content) return json(res,502,{error:'AI upstream returned no message'});
    if(body.action==='evaluate'){
      try{return json(res,200,{evaluation:JSON.parse(content)})}
      catch{
        const match=content.match(/\{[\s\S]*\}/);
        if(match){try{return json(res,200,{evaluation:JSON.parse(match[0])})}catch{}}
        return json(res,502,{error:'Evaluation was not valid JSON'});
      }
    }
    return json(res,200,{reply:content});
  }catch(err){
    return json(res,502,{error:'AI request failed'});
  }
};
