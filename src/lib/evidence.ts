import type {Analysis,EvidenceEntry,EvidenceReport} from './types';
export function normalizeEvidence(value:string):string{return value.normalize('NFC').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').replace(/\s+/gu,' ').trim().toLocaleLowerCase('en-IN');}
export function verifyEvidence(quote:string|null|undefined,transcript:string):boolean{if(!quote)return false;const normalized=normalizeEvidence(quote);return normalized.length>0&&normalizeEvidence(transcript).includes(normalized);}
export function evidenceReport(analysis:Analysis,transcript:string):EvidenceReport{
 const entries:EvidenceEntry[]=[];
 function visit(value:unknown,path:string){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach((entry,index)=>visit(entry,`${path}.${index}`));return;}const record=value as Record<string,unknown>;if('evidence'in record){const quote=typeof record.evidence==='string'?record.evidence:null;entries.push({path:path+'.evidence',quote,verified:verifyEvidence(quote,transcript),...(record.basis==='stated'||record.basis==='inferred'?{basis:record.basis}:{})});}for(const [key,entry]of Object.entries(record))if(key!=='evidence')visit(entry,path?`${path}.${key}`:key);}
 visit(analysis,'');return {entries,verified:entries.filter(e=>e.verified).length,total:entries.filter(e=>e.quote!==null).length};
}
