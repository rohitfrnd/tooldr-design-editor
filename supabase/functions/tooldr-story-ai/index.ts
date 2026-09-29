import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const GEMINI=Deno.env.get("GEMINI_API_KEY")||"";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey, authorization, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
const schema={type:"object",properties:{title:{type:"string"},characters:{type:"array",items:{type:"object",properties:{name:{type:"string"},description:{type:"string"}},required:["name","description"]}},scenes:{type:"array",items:{type:"object",properties:{scene_order:{type:"integer"},title:{type:"string"},description:{type:"string"},location:{type:"string"},time:{type:"string"},action:{type:"string"},camera:{type:"string"},shot_type:{type:"string"},mood:{type:"string"},prompt:{type:"string"}},required:["scene_order","title","description","location","time","action","camera","shot_type","mood","prompt"]}}},required:["title","characters","scenes"]};
function getText(r:any){if(typeof r?.output_text==="string"&&r.output_text.trim())return r.output_text;if(Array.isArray(r?.steps)){for(let i=r.steps.length-1;i>=0;i--){const c=Array.isArray(r.steps[i]?.content)?r.steps[i].content:[];const t=c.filter((x:any)=>x?.type==="text"&&typeof x.text==="string").map((x:any)=>x.text).join("");if(t.trim())return t}}if(Array.isArray(r?.outputs)){for(let i=r.outputs.length-1;i>=0;i--){if(typeof r.outputs[i]?.text==="string"&&r.outputs[i].text.trim())return r.outputs[i].text}}return "";}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return json({error:"POST required"},405);
 try{
  if(!GEMINI)return json({error:"GEMINI_API_KEY is not configured in Supabase."},503);
  const b=await req.json(),story=String(b.story||"").trim(),sceneCount=Math.min(30,Math.max(1,Number(b.sceneCount)||10)),output=String(b.output||"Cinematic story"),style=String(b.style||"Cinematic Realism"),ratio=String(b.ratio||"16:9");
  if(!story)return json({error:"Story is required."},400);
  const prompt="You are ToolDr Story Studio's AI story-planning engine. Preserve the user's actual characters, locations, chronology, actions, reveals and ending. Do not invent major plot events. Return JSON matching the supplied schema. Create exactly "+sceneCount+" sequential scenes. Each scene needs title, description, location, time, action, camera, shot_type, mood and a complete image-generation prompt. Visual style: "+style+". Output: "+output+". Aspect ratio: "+ratio+". STORY:\n"+story;
  const res=await fetch("https://generativelanguage.googleapis.com/v1beta/interactions",{method:"POST",headers:{"x-goog-api-key":GEMINI,"Content-Type":"application/json"},body:JSON.stringify({model:"gemini-3.1-flash-lite",input:prompt,store:false,response_format:{type:"text",mime_type:"application/json",schema}})});
  const result=await res.json();
  if(!res.ok)throw new Error("Gemini failed ("+res.status+"): "+JSON.stringify(result).slice(0,1400));
  const text=getText(result);
  if(!text)throw new Error("Gemini returned no text output. Status: "+String(result.status||"unknown"));
  let parsed:any;
  try{parsed=JSON.parse(text)}catch{const cleaned=String(text).trim().replace(/^\u0060\u0060\u0060json\s*/i,"").replace(/\s*\u0060\u0060\u0060$/,"").trim();try{parsed=JSON.parse(cleaned)}catch{throw new Error("Gemini returned text, but it was not valid JSON.")}}
  const scenes=Array.isArray(parsed.scenes)?parsed.scenes.slice(0,sceneCount):[];
  if(scenes.length!==sceneCount)throw new Error("Gemini returned "+scenes.length+" scenes; expected "+sceneCount+".");
  return json({ok:true,title:parsed.title||"Untitled Story",characters:Array.isArray(parsed.characters)?parsed.characters:[],scenes});
 }catch(e){return json({ok:false,error:e instanceof Error?e.message:"Unknown error"},500)}
});