import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import sharp from 'sharp';
import {createHandlers} from './api';
import {ai,providerInfo,type AIProvider} from './ai';
import {PublicError} from './errors';
import {RateLimiter} from '../rateLimit';
import {fixture} from '../test-fixtures';
import {sampleText,type SampleId} from '../samples';
const transcript='Fictional Office\nAmount: ₹2,450\nDue: 09/11/2026\nNo late fee is specified in this fictional notice.';
const transcribed={transcript,looksLikeOfficialDocument:true,legibility:'good' as const,notes:[]};
const mockProvider=():AIProvider=>({transcribe:vi.fn(async()=>transcribed),analyze:vi.fn(async()=>fixture()),chat:vi.fn(async()=>({answer:'The document does not say this.',evidenceQuote:null}))});
const request=(path:string,body:unknown,origin='http://localhost:5173')=>new Request('http://localhost:5173/api/'+path,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
const mockFetch=vi.fn<typeof fetch>();
const aiResponse=(value:unknown)=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});
beforeEach(()=>{vi.stubEnv('AI_PROVIDER','gemini');vi.stubEnv('GEMINI_API_KEY','test-only-key');vi.stubEnv('GEMINI_MODEL','gemini-test-model');vi.stubEnv('VERCEL','');mockFetch.mockReset();});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('stateless API pipeline',()=>{
 it('transcribes an uploaded image, analyzes text and verifies chat evidence',async()=>{const p=mockProvider(),handlers=createHandlers(p,new RateLimiter());const image=await sharp({create:{width:20,height:20,channels:3,background:'#fff'}}).png().toBuffer();const read=await handlers.transcribe(request('transcribe',{mediaType:'image/png',dataBase64:image.toString('base64')}));expect(read.status).toBe(200);expect(await read.json()).toEqual(transcribed);const result=await handlers.analyze(request('analyze',{transcript,language:'hi',legibility:'good'}));expect(result.status).toBe(200);const data=await result.json();expect(data.evidenceReport.verified).toBe(3);expect(data.finalRisk.status).toBe('no_obvious_warnings');p.chat=vi.fn(async()=>({answer:'Amount is stated.',evidenceQuote:'Amount: ₹2,450'}));const answer=await handlers.chat(request('chat',{transcript,language:'hi',messages:[{role:'user',content:'Amount?'}]}));expect((await answer.json()).evidenceVerified).toBe(true);expect(p.analyze).toHaveBeenCalledWith(transcript,'hi',expect.any(Array),expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),expect.any(AbortSignal));});
 it.each(['electricity','pressure','scholarship'] as SampleId[])('analyzes %s sample without a vision call',async(id)=>{const p=mockProvider(),h=createHandlers(p,new RateLimiter());const response=await h.analyze(request('analyze',{transcript:sampleText(id),language:'en',legibility:'good'}));expect(response.status).toBe(200);const data=await response.json();expect(data.finalRisk.status).toBe(id==='pressure'?'suspicious_details':'no_obvious_warnings');expect(p.transcribe).not.toHaveBeenCalled();if(id==='pressure')expect(data.signals.some((s:{severity:string})=>s.severity==='high')).toBe(true);});
 it('marks fabricated chat quotes as unmatched',async()=>{const p=mockProvider();p.chat=async()=>({answer:'Unknown.',evidenceQuote:'An invented line'});const r=await createHandlers(p,new RateLimiter()).chat(request('chat',{transcript,language:'en',messages:[{role:'user',content:'Question'}]}));expect((await r.json()).evidenceVerified).toBe(false);});
 it('rejects spoofed file types before calling the provider',async()=>{const p=mockProvider();const r=await createHandlers(p,new RateLimiter()).transcribe(request('transcribe',{mediaType:'image/png',dataBase64:Buffer.from('not a PNG').toString('base64')}));expect(r.status).toBe(400);expect(p.transcribe).not.toHaveBeenCalled();});
 it('rejects malformed base64 and unsupported MIME',async()=>{const h=createHandlers(mockProvider(),new RateLimiter());expect((await h.transcribe(request('transcribe',{mediaType:'image/png',dataBase64:'not-base64!'}))).status).toBe(400);expect((await h.transcribe(request('transcribe',{mediaType:'text/html',dataBase64:'YQ=='}))).status).toBe(400);});
 it('enforces transcript length and chat limits',async()=>{const h=createHandlers(mockProvider(),new RateLimiter());expect((await h.analyze(request('analyze',{transcript:'x'.repeat(15001),language:'en'}))).status).toBe(400);expect((await h.chat(request('chat',{transcript,language:'en',messages:[{role:'user',content:'x'.repeat(501)}]}))).status).toBe(400);expect((await h.chat(request('chat',{transcript,language:'en',messages:Array.from({length:11},()=>({role:'user',content:'Q'}))}))).status).toBe(400);});
 it('uses one rate bucket across all API routes',async()=>{const h=createHandlers(mockProvider(),new RateLimiter(2));await h.health(new Request('http://localhost:5173/api/health'));await h.analyze(request('analyze',{transcript,language:'en'}));const r=await h.chat(request('chat',{transcript,language:'en',messages:[{role:'user',content:'Q'}]}));expect(r.status).toBe(429);expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);});
 it('rejects cross-origin mutations',async()=>{const r=await createHandlers(mockProvider()).analyze(request('analyze',{transcript,language:'en'},'https://other.example'));expect(r.status).toBe(403);});
 it('does not expose unexpected exception contents',async()=>{const p=mockProvider();p.analyze=async()=>{throw new Error('private transcript and api key');};const r=await createHandlers(p,new RateLimiter()).analyze(request('analyze',{transcript,language:'en'}));expect(r.status).toBe(500);expect(await r.text()).not.toContain('private transcript');});
 it('returns actionable configuration errors',async()=>{const p=mockProvider();p.analyze=async()=>{throw new PublicError('AI key is missing.',503,'setup');};const r=await createHandlers(p,new RateLimiter()).analyze(request('analyze',{transcript,language:'en'}));expect(r.status).toBe(503);expect(await r.json()).toEqual({error:'AI key is missing.',code:'setup'});});
});
describe('Gemini transport',()=>{
 it('uses vision only for transcription and original-script output',async()=>{vi.stubGlobal('fetch',mockFetch);mockFetch.mockResolvedValue(aiResponse(transcribed));expect(await ai.transcribe({mediaType:'application/pdf',dataBase64:'ZmljdGlvbmFs'})).toEqual(transcribed);const [url,init]=mockFetch.mock.calls[0];expect(String(url)).not.toContain('test-only-key');expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('test-only-key');const body=JSON.parse(String(init?.body));expect(body.contents[0].parts[0].inlineData.mimeType).toBe('application/pdf');expect(body.systemInstruction.parts[0].text).toContain('Do not translate');expect(body.store).toBe(false);});
 it('sends only text and automated findings to analysis',async()=>{vi.stubGlobal('fetch',mockFetch);mockFetch.mockResolvedValue(aiResponse(fixture()));await ai.analyze(transcript,'hi',[],'2026-10-28');const body=JSON.parse(String(mockFetch.mock.calls[0][1]?.body));expect(body.contents[0].parts).toHaveLength(1);expect(body.contents[0].parts[0].inlineData).toBeUndefined();expect(body.contents[0].parts[0].text).toContain('automatedFindings');expect(body.systemInstruction.parts[0].text).toContain('Reply in Hindi');expect(body.generationConfig.responseMimeType).toBe('application/json');expect(body.systemInstruction.parts[0].text).toContain('required');expect(body.generationConfig.responseFormat).toBeUndefined();});
 it('grounds chat in the transcript and returns structured evidence',async()=>{vi.stubGlobal('fetch',mockFetch);mockFetch.mockResolvedValue(aiResponse({answer:'No fee is stated.',evidenceQuote:'No late fee is specified'}));await ai.chat(transcript,'en',[{role:'user',content:'Any late fee?'}]);const body=JSON.parse(String(mockFetch.mock.calls[0][1]?.body));expect(body.contents[0].parts[0].text).toContain(transcript.replace(/\n/g,'\\n'));expect(body.contents.at(-1).parts[0].text).toBe('Any late fee?');});
 it('rejects malformed model output',async()=>{vi.stubGlobal('fetch',mockFetch);mockFetch.mockResolvedValue(aiResponse({explanation:'Incomplete'}));await expect(ai.analyze(transcript,'en',[],'2026-10-28')).rejects.toThrow('required format');});
 it('fails explicitly on missing configuration',async()=>{vi.stubEnv('GEMINI_API_KEY','');vi.stubGlobal('fetch',mockFetch);await expect(ai.analyze(transcript,'en',[],'2026-10-28')).rejects.toMatchObject({status:503,code:'setup'});expect(mockFetch).not.toHaveBeenCalled();});
 it('handles exhausted quota without exposing provider diagnostics',async()=>{vi.stubGlobal('fetch',mockFetch);mockFetch.mockResolvedValue(Response.json({error:{message:'secret provider details'}},{status:429}));await expect(ai.analyze(transcript,'en',[],'2026-10-28')).rejects.toMatchObject({status:429,code:'rateLimited'});});
 it('ignores internal thought content and rejects truncation',async()=>{vi.stubGlobal('fetch',mockFetch);mockFetch.mockResolvedValue(Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:JSON.stringify(fixture())}]}}]}));await expect(ai.analyze(transcript,'en',[],'2026-10-28')).rejects.toThrow('incomplete');});
 it('exposes provider name but never its key',()=>{expect(providerInfo().providerName).toBe('Google Gemini');expect(JSON.stringify(providerInfo())).not.toContain('test-only-key');});
});

it('accepts the actual host when Next normalizes its internal URL',async()=>{
 const h=createHandlers(mockProvider(),new RateLimiter());
 const r=await h.analyze(new Request('http://localhost:5174/api/analyze',{method:'POST',headers:{host:'127.0.0.1:5174',origin:'http://127.0.0.1:5174','content-type':'application/json'},body:JSON.stringify({transcript,language:'en'})}));
 expect(r.status).toBe(200);
 const rejected=await h.analyze(new Request('http://localhost:5174/api/analyze',{method:'POST',headers:{host:'127.0.0.1:5174',origin:'http://evil.example','content-type':'application/json'},body:JSON.stringify({transcript,language:'en'})}));
 expect(rejected.status).toBe(403);
});

it('uses low-latency thinking for Gemini 3 and budgets for Gemini 2.5',async()=>{
 vi.stubGlobal('fetch',mockFetch);mockFetch.mockImplementation(async()=>aiResponse({answer:'Not stated.',evidenceQuote:null}));
 for(const model of ['gemini-3.8-flash','gemini-2.5-flash','gemini-test-model']){
  vi.stubEnv('GEMINI_MODEL',model);await ai.chat(transcript,'en',[{role:'user',content:'Question?'}]);
  const config=JSON.parse(String(mockFetch.mock.calls.at(-1)?.[1]?.body)).generationConfig;
  expect(config.thinkingConfig).toEqual(model==='gemini-3.8-flash'?{thinkingLevel:'low'}:model==='gemini-2.5-flash'?{thinkingBudget:1024}:undefined);
 }
});
it('reports an overloaded provider without exposing its diagnostics',async()=>{
 vi.stubGlobal('fetch',mockFetch);mockFetch.mockResolvedValue(Response.json({error:{message:'private diagnostic'}},{status:503}));
 await expect(ai.chat(transcript,'en',[{role:'user',content:'Question?'}])).rejects.toMatchObject({status:503,code:'providerBusy'});
});
it('distinguishes timeouts from user cancellations',async()=>{
 const timeoutController=new AbortController();const timeoutMock=vi.spyOn(AbortSignal,'timeout').mockReturnValue(timeoutController.signal);
 vi.stubGlobal('fetch',mockFetch);mockFetch.mockImplementation(async()=>{timeoutController.abort();throw new Error('aborted');});
 try{await expect(ai.chat(transcript,'en',[{role:'user',content:'Question?'}])).rejects.toMatchObject({status:504,code:'providerTimeout'});}finally{timeoutMock.mockRestore();}
 const cancel=new AbortController();cancel.abort();
 await expect(ai.chat(transcript,'en',[{role:'user',content:'Question?'}],cancel.signal)).rejects.toMatchObject({status:499,code:'cancelled'});
});

it('always uses Gemini even if legacy provider variables remain in a deployment',async()=>{
 vi.stubEnv('AI_PROVIDER','claude');vi.stubEnv('ANTHROPIC_API_KEY','unused-legacy-key');
 vi.stubGlobal('fetch',mockFetch);mockFetch.mockResolvedValue(aiResponse({answer:'Not stated.',evidenceQuote:null}));
 expect(providerInfo().provider).toBe('gemini');
 await ai.chat(transcript,'en',[{role:'user',content:'Question?'}]);
 const [url,init]=mockFetch.mock.calls[0];expect(String(url)).toContain('generativelanguage.googleapis.com');expect(JSON.stringify(init)).not.toContain('unused-legacy-key');
});
