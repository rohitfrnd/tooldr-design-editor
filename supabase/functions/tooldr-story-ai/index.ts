import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI = Deno.env.get("GEMINI_API_KEY") || "";
const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey, authorization, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};

function json(data: unknown, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{...CORS,"Content-Type":"application/json"}});
}

const schema = {
  type:"object",
  properties:{
    title:{type:"string"},
    characters:{type:"array",items:{type:"object",properties:{name:{type:"string"},description:{type:"string"}},required:["name","description"]}},
    scenes:{type:"array",items:{type:"object",properties:{
      scene_order:{type:"integer"},title:{type:"string"},description:{type:"string"},location:{type:"string"},time:{type:"string"},
      action:{type:"string"},camera:{type:"string"},shot_type:{type:"string"},mood:{type:"string"},prompt:{type:"string"}
    },required:["scene_order","title","description","location","time","action","camera","shot_type","mood","prompt"]}}
  },
  required:["title","characters","scenes"]
};

Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  if(req.method!=="POST") return json({error:"POST required"},405);
  try{
    if(!GEMINI) return json({error:"GEMINI_API_KEY is not configured in Supabase."},503);
    const body=await req.json();
    const story=String(body.story||"").trim();
    const sceneCount=Math.min(30,Math.max(1,Number(body.sceneCount)||10));
    const output=String(body.output||"Cinematic story");
    const style=String(body.style||"Cinematic Realism");
    const ratio=String(body.ratio||"16:9");
    const consistent=body.consistent!==false;
    if(!story) return json({error:"Story is required."},400);

    const prompt="You are ToolDr Story Studio's AI story-planning engine.\n\n"+
      "Turn the user's story into a production-ready scene plan. Preserve the actual characters, locations, chronology, important actions, reveals and ending. Do not invent major plot events.\n\n"+
      "OUTPUT SETTINGS:\nOutput type: "+output+"\nVisual style: "+style+"\nAspect ratio: "+ratio+
      "\nRequested scenes: exactly "+sceneCount+"\nVisual consistency: "+(consistent?"ON":"OFF")+"\n\n"+
      "Return JSON matching the supplied schema. Extract important recurring characters with visual descriptions. Create exactly "+sceneCount+
      " sequential scenes. Each scene must materially advance or visually represent the story. For every scene provide title, description, location, time, action, camera, shot_type, mood, and a complete image-generation prompt including recurring character appearance when applicable, environment, lighting, action, camera/composition and "+ratio+" framing.\n\nSTORY:\n"+story;

    const response=await fetch("https://generativelanguage.googleapis.com/v1beta/interactions",{
      method:"POST",
      headers:{"x-goog-api-key":GEMINI,"Content-Type":"application/json"},
      body:JSON.stringify({model:"gemini-3.1-flash-lite",input:prompt,response_format:{type:"text",mime_type:"application/json",schema}})
    });
    const result=await response.json();
    if(!response.ok||!result.output_text) throw new Error("Gemini failed ("+response.status+"): "+JSON.stringify(result).slice(0,1400));

    let parsed:any;
    try{parsed=JSON.parse(result.output_text)}
    catch{const cleaned=String(result.output_text).replace(/^\`\`\`json\s*/i,"").replace(/\s*\`\`\`$/,"");parsed=JSON.parse(cleaned)}

    const scenes=Array.isArray(parsed.scenes)?parsed.scenes.slice(0,sceneCount):[];
    if(scenes.length!==sceneCount) throw new Error("Gemini returned "+scenes.length+" scenes; expected "+sceneCount+".");

    return json({ok:true,title:parsed.title||"Untitled Story",characters:Array.isArray(parsed.characters)?parsed.characters:[],scenes});
  }catch(e){return json({ok:false,error:e instanceof Error?e.message:"Unknown error"},500)}
});