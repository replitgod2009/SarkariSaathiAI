import {z} from 'zod';
export const languageConfig=[{code:'en',label:'English',speech:'en-IN'},{code:'hi',label:'हिन्दी',speech:'hi-IN'}] as const;
export type Language=typeof languageConfig[number]['code'];
export const languageSchema=z.enum(['en','hi']);
export const basisSchema=z.enum(['stated','inferred']);
export const legibilitySchema=z.enum(['good','partial','poor']);
export const riskSchema=z.enum(['no_obvious_warnings','suspicious_details','unable_to_assess']);
export type Risk=z.infer<typeof riskSchema>;
export type Legibility=z.infer<typeof legibilitySchema>;
const text=z.string().max(3000);
const evidence=text.nullable();
export const transcriptionSchema=z.object({transcript:z.string().max(15000),looksLikeOfficialDocument:z.boolean(),legibility:legibilitySchema,notes:z.array(z.string().max(500)).max(10)});
export const analysisSchema=z.object({
 documentType:text,issuingAuthority:z.object({value:text.nullable(),evidence}),documentLanguage:text,
 urgency:z.enum(['urgent','action_required','informational','unclear']),
 keyFields:z.array(z.object({label:text,value:text.nullable(),basis:basisSchema,evidence})).max(20),
 deadline:z.object({isoDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),originalText:text.nullable(),evidence}),
 explanation:text,
 actionPlan:z.array(z.object({step:text,detail:text,basis:basisSchema,evidence})).min(3).max(7),
 documentsNeeded:z.array(z.object({item:text,evidence})).max(20),
 warningSignals:z.array(z.object({signal:text,severity:z.enum(['low','medium','high']),evidence})).max(20),
 riskAssessment:z.object({status:riskSchema,reason:text}),unreadableOrMissing:z.array(text).max(20),
 confidence:z.enum(['high','medium','low']),suggestedQuestions:z.array(z.string().max(500)).length(3)
});
export type Analysis=z.infer<typeof analysisSchema>;
export type Transcription=z.infer<typeof transcriptionSchema>;
export const chatAnswerSchema=z.object({answer:text,evidenceQuote:evidence});
export const mediaTypes=['image/jpeg','image/png','image/webp','image/gif','application/pdf'] as const;
export const transcribeInput=z.object({mediaType:z.enum(mediaTypes),dataBase64:z.string().min(4).max(4194304).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)});
export const analyzeInput=z.object({transcript:z.string().trim().min(1).max(15000),language:languageSchema,legibility:legibilitySchema.optional()});
export const chatInput=z.object({transcript:z.string().trim().min(1).max(15000),language:languageSchema,messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(500)})).min(1).max(10)}).refine(v=>v.messages.at(-1)?.role==='user',{message:'The last message must be a question.'});
export type Signal={id:string;label:string;severity:'low'|'medium'|'high';matchedText:string;explanation:string};
export type EvidenceEntry={path:string;quote:string|null;verified:boolean;basis?:'stated'|'inferred'};
export type EvidenceReport={entries:EvidenceEntry[];verified:number;total:number};
export type RiskResult={status:Risk;contributors:{origin:'automated'|'ai'|'readability';message:string;id?:string}[]};
export type AnalysisResult={analysis:Analysis;signals:Signal[];evidenceReport:EvidenceReport;today:string;daysRemaining:number|null;finalRisk:RiskResult};
export type ChatAnswer=z.infer<typeof chatAnswerSchema>&{evidenceVerified:boolean};
