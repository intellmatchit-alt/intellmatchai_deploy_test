"use strict";(()=>{var e={};e.id=4823,e.ids=[4823],e.modules={20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},94301:(e,t,n)=>{n.r(t),n.d(t,{originalPathname:()=>k,patchFetch:()=>$,requestAsyncStorage:()=>y,routeModule:()=>h,serverHooks:()=>g,staticGenerationAsyncStorage:()=>f});var o={};n.r(o),n.d(o,{POST:()=>p});var r=n(49303),a=n(88716),i=n(60670),s=n(87070),c=n(1473),l=n(47572);async function p(e){try{let t=await (0,c.Z)(e);if(t instanceof s.NextResponse)return t;let n=await e.json();if(!n.name)return s.NextResponse.json({error:"Name is required"},{status:400});if(n.scrapInData)return await u(n);let o=process.env.OPENAI_API_KEY;if(!o)return s.NextResponse.json({error:"No API keys configured"},{status:500});return await m(n,o)}catch(e){return console.error("Explorer API error:",e),s.NextResponse.json({error:e.message||"Internal server error"},{status:500})}}async function u(e){let t;let n=e.scrapInData,o=(n.positions||[]).map(e=>{let t=[e.startDate,e.isCurrent?"Present":e.endDate].filter(Boolean).join(" - ");return`${e.title||"Unknown Role"} at ${e.company||"Unknown Company"} (${t})${e.description?": "+e.description:""}`}),r=(n.education||[]).map(e=>`${e.degree||""} ${e.field?`in ${e.field}`:""} at ${e.school||"Unknown"}`.trim()),a=[...o,r.length>0?`Education: ${r.join("; ")}`:""].filter(Boolean).join(". "),i=function(e){let t=new Set,n=[e.headline||"",e.summary||"",...(e.positions||[]).map(e=>`${e.title||""} ${e.company||""} ${e.description||""}`),...e.skills||[]].join(" ").toLowerCase();for(let[e,o]of Object.entries({Technology:["software","developer","engineer","tech","programming","coding","IT","devops","cloud","saas"],Finance:["finance","banking","investment","fintech","accounting","financial"],Healthcare:["health","medical","pharma","biotech","clinical","hospital"],Education:["education","university","teaching","academic","professor","school"],Marketing:["marketing","advertising","brand","digital marketing","seo","content"],Consulting:["consulting","advisory","consultant","strategy"],Entrepreneurship:["founder","co-founder","startup","entrepreneur","ceo","cto"],"E-commerce":["ecommerce","e-commerce","retail","marketplace"],"AI & Data":["artificial intelligence","machine learning","data science","ai","ml","deep learning"],Design:["design","ux","ui","creative","graphic"]}))o.some(e=>n.includes(e))&&t.add(e);return t.size>0?Array.from(t).slice(0,4):["Professional Services"]}(n),c=[];n.linkedInUrl&&c.push({platform:"LinkedIn",url:n.linkedInUrl});let p=[];if(n.linkedInUrl)try{(p=(await (0,l.sG)(n.linkedInUrl)).slice(0,10).map(e=>({text:e.text,reactionsCount:e.reactionsCount,commentsCount:e.commentsCount,activityDate:e.activityDate,activityUrl:e.activityUrl||e.shareUrl}))).length>0&&p[0].activityDate&&(t=p[0].activityDate)}catch(e){console.error("[Explorer] Failed to fetch posts:",e)}let u={name:e.name,summary:n.summary||n.headline||`${n.jobTitle||"Professional"} at ${n.company||"their company"}`,professionalBackground:a,sectors:i,skills:n.skills||[],interests:[],iceBreakers:[],commonGround:[],approachTips:"",socialMedia:c,company:n.company,jobTitle:n.jobTitle,location:n.location,photoUrl:n.photoUrl,positions:n.positions,posts:p.length>0?p:void 0,latestPostDate:t},m=process.env.OPENAI_API_KEY;if(m)try{let t=await d(e.name,n,m,p);t&&(u.iceBreakers=t.iceBreakers||[],u.commonGround=t.commonGround||[],u.approachTips=t.approachTips||"",u.interests=t.interests||[],t.latestActivity&&(u.latestActivity=t.latestActivity),t.summary&&(!n.summary||n.summary.length<50)&&(u.summary=t.summary))}catch(e){console.error("[Explorer] GPT enhancement failed, using ScrapIn data only:",e)}return 0===u.iceBreakers.length&&(u.iceBreakers=function(e){let t=[];if(e.jobTitle&&e.company&&t.push(`I see you're working as ${e.jobTitle} at ${e.company} — how's that going?`),e.positions&&e.positions.length>1){let n=e.positions[1];n.company&&n.company!==e.company&&t.push(`Interesting career path from ${n.company} to ${e.company} — what motivated the move?`)}return e.headline&&t.push(`Your headline "${e.headline}" caught my attention — I'd love to learn more about what you do.`),e.skills&&e.skills.length>0&&t.push(`I noticed your expertise in ${e.skills.slice(0,3).join(", ")} — would love to connect on that.`),e.education&&e.education.length>0&&e.education[0].school&&t.push(`Fellow ${e.education[0].field||"graduate"} from ${e.education[0].school} — great to connect!`),t.length>0?t:["Would love to connect and learn more about your work!"]}(n)),s.NextResponse.json({profileData:u,searchEngine:"scrapin"})}async function d(e,t,n,o=[]){let r=(t.positions||[]).slice(0,5).map(e=>{let t=[e.startDate,e.isCurrent?"Present":e.endDate].filter(Boolean).join(" - ");return`${e.title||"?"} at ${e.company||"?"} (${t})`}).join("\n"),a=o.slice(0,5),i=a[0]?.activityDate?new Date(a[0].activityDate).toLocaleDateString():null,s=a.length>0?`

=== RECENT LINKEDIN POSTS (MOST IMPORTANT FOR ICE BREAKERS) ===
Latest post was on: ${i||"Unknown"}
${a.map((e,t)=>{let n=e.activityDate?new Date(e.activityDate).toLocaleDateString():"?",o=[e.reactionsCount?`${e.reactionsCount} reactions`:"",e.commentsCount?`${e.commentsCount} comments`:""].filter(Boolean).join(", "),r=(e.text||"").slice(0,400);return`POST ${t+1} [${n}]${o?` - ${o}`:""}:
"${r}"`}).join("\n\n")}`:"",c=`Based on this LinkedIn profile data, generate networking insights.

Name: ${e}
Headline: ${t.headline||"N/A"}
Current: ${t.jobTitle||"?"} at ${t.company||"?"}
Location: ${t.location||"N/A"}
Bio: ${t.summary||"N/A"}
Work History:
${r||"N/A"}
Skills: ${(t.skills||[]).slice(0,15).join(", ")||"N/A"}
Education: ${(t.education||[]).map(e=>`${e.degree||""} ${e.field?"in "+e.field:""} at ${e.school||"?"}`).join(", ")||"N/A"}${s}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence professional summary",
  "iceBreakers": ["5 specific conversation starters${a.length>0?" — AT LEAST 3 MUST reference their recent LinkedIn posts with specific details from the post content":""}, referencing their current role, career transitions, skills, or achievements"],
  "commonGround": ["4-5 potential networking topics${a.length>0?" derived from their posts and profile":""}"],
  "interests": ["3-5 likely interests based on their career${a.length>0?" and the topics they post about":""}"],
  "approachTips": "2-3 sentences on the best way to approach this person${a.length>0?". Start by mentioning their most recent post (from "+i+") as a natural conversation opener":""}",
  "latestActivity": "${a.length>0?"Describe what they recently posted about on LinkedIn (include specific topics, events, or ideas from their posts). Mention the date of their latest post.":"Brief note about their most recent career move or position change based on the data"}"
}

Make ice breakers SPECIFIC to this person — reference their actual company, role, career path, or skills.${a.length>0?`

CRITICAL: You have access to their ACTUAL LinkedIn posts above. Use them!
- Their latest post was on ${i}
- Reference SPECIFIC content from their posts (events they attended, topics they discussed, opinions they shared)
- Example: "I saw your post about the Global Labor Market Conference in Riyadh — what were your key takeaways?"
- This shows you've done your research and creates an authentic, personalized connection.`:""} Not generic.`,l=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${n}`},body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"user",content:c}],temperature:.4,max_tokens:1500})});if(!l.ok)throw Error(`OpenAI API error: ${l.status}`);let p=await l.json(),u=p.choices[0]?.message?.content;if(!u)return null;let d=u.match(/\{[\s\S]*\}/);return d?JSON.parse(d[0]):null}async function m(e,t){let n;let o=`You are a professional networking assistant. Based on the information provided, create a helpful profile analysis.

OUTPUT FORMAT: Return ONLY a valid JSON object:
{
  "name": "Full name",
  "summary": "2-3 sentence summary",
  "professionalBackground": "Likely professional background based on context",
  "sectors": ["Array of likely industries"],
  "skills": ["Array of likely skills"],
  "interests": ["Array of possible interests"],
  "iceBreakers": ["Array of 4-5 conversation starters"],
  "commonGround": ["Array of connection topics"],
  "approachTips": "General tips for approaching this person",
  "socialMedia": []
}

Note: You don't have internet access, so make educated inferences based on the provided information.`,r=`Create a profile analysis for:

**Name:** ${e.name}
${e.linkedIn?`**LinkedIn:** ${e.linkedIn}`:""}
${e.twitter?`**Twitter/X:** ${e.twitter}`:""}
${e.website?`**Website:** ${e.website}`:""}
${e.additionalInfo?`**Additional Context:** ${e.additionalInfo}`:""}

Return the JSON profile based on what you can infer.`,a=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:o},{role:"user",content:r}],temperature:.3,max_tokens:2e3})});if(!a.ok)throw Error("OpenAI API request failed");let i=await a.json(),c=i.choices[0]?.message?.content;if(!c)throw Error("No response from AI");try{let e=c.match(/\{[\s\S]*\}/);if(e)n=JSON.parse(e[0]);else throw Error("No JSON found")}catch(e){return s.NextResponse.json({content:c,profileData:null,searchEngine:"openai",warning:"Could not parse AI response"})}return s.NextResponse.json({profileData:n,searchEngine:"openai",warning:"No LinkedIn profile selected. Results based on AI inference only."})}let h=new r.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/explorer/route",pathname:"/api/explorer",filename:"route",bundlePath:"app/api/explorer/route"},resolvedPagePath:"C:\\Users\\user\\Desktop\\Ammars_Work\\pressure_project\\p2p-app\\frontend\\src\\app\\api\\explorer\\route.ts",nextConfigOutput:"standalone",userland:o}),{requestAsyncStorage:y,staticGenerationAsyncStorage:f,serverHooks:g}=h,k="/api/explorer/route";function $(){return(0,i.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:f})}}};var t=require("../../../webpack-runtime.js");t.C(e);var n=e=>t(t.s=e),o=t.X(0,[9276,5972,2959],()=>n(94301));module.exports=o})();