'use client';
import {Search,CheckCircle2,TriangleAlert} from 'lucide-react';
import {translator} from '@/lib/i18n';
import type {Language} from '@/lib/types';
export function EvidenceLink({quote,verified,language,basis}:{quote:string|null;verified:boolean;language:Language;basis?:'stated'|'inferred'}){const t=translator(language);return <details className={`evidence ${verified?'matched':'unmatched'}`}><summary><Search size={15}/>{t('source')}</summary><div className="evidence-body">{basis==='inferred'&&<p>{t('inferredNote')}</p>}{quote?<><p className="evidence-status">{verified?<CheckCircle2 size={16}/>:<TriangleAlert size={16}/ >}{t(verified?'matched':'unmatched')}</p><blockquote dir="auto">{quote}</blockquote></>:<p>{t('noQuote')}</p>}{verified&&<small>{t('matchedToTranscript')}</small>}</div></details>}
