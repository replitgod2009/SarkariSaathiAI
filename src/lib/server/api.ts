import {z} from 'zod';
import {analyzeInput,chatInput,transcribeInput} from '../types';
import {detectSignals} from '../signals';
import {verifyEvidence} from '../evidence';
import {postProcess} from '../postProcess';
import {todayInKolkata} from '../dates';
import {RateLimiter,rateLimiter} from '../rateLimit';
import {ai,type AIProvider,providerInfo} from './ai';
import {PublicError} from './errors';
import {validateMedia} from './media';
function json(body:unknown,status=200,headers:Record<string,string>={}){return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});}
async function readJSON(request:Request,limit:number):Promise<unknown>{const declared=Number(request.headers.get('content-length'));if(declared>limit)throw new PublicError('Request is too large. Use a smaller file.',413,'inputError');if(!request.headers.get('content-type')?.includes('application/json'))throw new PublicError('Send a JSON request.',415,'inputError');const reader=request.body?.getReader();if(!reader)throw new PublicError('The request body is empty.',400,'inputError');const chunks:Uint8Array[]=[];let total=0;while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();throw new PublicError('Request is too large. Use a smaller file.',413,'inputError');}chunks.push(value);}const buffer=new Uint8Array(total);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}try{return JSON.parse(new TextDecoder().decode(buffer));}catch{throw new PublicError('The request could not be read.',400,'inputError');}}
export function createHandlers(provider:AIProvider=ai,limiter:RateLimiter=rateLimiter){
 async function route(request:Request,run:()=>Promise<Response>){try{
  const origin=request.headers.get('origin');
  // Next may normalize Request.url to localhost internally. The browser's Host
  // still identifies the actual target origin (including its port).
  if(origin){let allowed=false;try{const source=new URL(origin),target=new URL(request.url);const host=request.headers.get('host')||target.host;allowed=['http:','https:'].includes(source.protocol)&&source.host===host;}catch{}if(!allowed)throw new PublicError('Request origin is not allowed.',403,'inputError');}
  // Vercel supplies this IP header. Outside a trusted proxy, all clients share
  // one bucket rather than trusting a freely supplied X-Forwarded-For header.
  const ip=process.env.VERCEL==='1'?(request.headers.get('x-vercel-forwarded-for')||'unknown').split(',')[0].trim():'local';
  const limit=limiter.check(ip);if(!limit.allowed)return json({error:'Too many requests. Please try again after the hourly limit resets.',code:'rateLimited',retryAfter:limit.retryAfter},429,{'Retry-After':String(limit.retryAfter)});
  return await run();
 }catch(error){if(error instanceof PublicError)return json({error:error.message,code:error.code},error.status);if(error instanceof z.ZodError)return json({error:'Please check the input. Text is limited to 15,000 characters; questions to 500 characters.',code:'inputError'},400);return json({error:'We could not complete the request. Please try again.',code:'genericError'},500);}}
 return {
  transcribe:(request:Request)=>route(request,async()=>{const body=transcribeInput.parse(await readJSON(request,4300000));await validateMedia(body.mediaType,body.dataBase64);const result=await provider.transcribe(body,request.signal);return json(result);}),
  analyze:(request:Request)=>route(request,async()=>{const body=analyzeInput.parse(await readJSON(request,100000));const today=todayInKolkata();const signals=detectSignals(body.transcript,body.language);const analysis=await provider.analyze(body.transcript,body.language,signals,today,request.signal);return json(postProcess(analysis,body.transcript,body.language,body.legibility,today));}),
  chat:(request:Request)=>route(request,async()=>{const body=chatInput.parse(await readJSON(request,140000));const answer=await provider.chat(body.transcript,body.language,body.messages,request.signal);return json({...answer,evidenceVerified:verifyEvidence(answer.evidenceQuote,body.transcript)});}),
  health:(request:Request)=>route(request,async()=>json({status:'ok',...providerInfo()}))
 };
}
export const handlers=createHandlers();
