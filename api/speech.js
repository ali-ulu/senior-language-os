const json=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data))};

module.exports=async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'POST required'});
  const url=process.env.SPEECH_API_URL, key=process.env.SPEECH_API_KEY;
  if(!url||!key) return json(res,503,{error:'Speech evaluator is not configured',code:'SPEECH_NOT_CONFIGURED'});
  let body=req.body;
  if(typeof body==='string'){try{body=JSON.parse(body)}catch{return json(res,400,{error:'Invalid JSON'})}}
  if(!body?.audioBase64||!body?.mimeType) return json(res,400,{error:'audioBase64 and mimeType are required'});
  try{
    const upstream=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body:JSON.stringify({
        audioBase64:body.audioBase64,
        mimeType:body.mimeType,
        locale:body.locale||'en-US',
        scenario:body.scenario||''
      })
    });
    const raw=await upstream.text();
    if(!upstream.ok) return json(res,502,{error:'Speech upstream failed',status:upstream.status});
    let data;try{data=JSON.parse(raw)}catch{return json(res,502,{error:'Speech upstream returned invalid JSON'})}
    return json(res,200,data);
  }catch{
    return json(res,502,{error:'Speech request failed'});
  }
};
