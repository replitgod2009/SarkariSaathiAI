import type {AnalysisResult,Language} from './types';
import {translator} from './i18n';
import {displayDate} from './dates';
// Share an allowlisted summary, never arbitrary AI prose (which may contain a
// name, consumer number, address, bank account, URL, or other personal details).
export function shareSummary(result:AnalysisResult,language:Language):string{
 const t=translator(language),a=result.analysis;
 const type=/electric|विद्युत|बिजली/i.test(a.documentType)?t('electricity'):/scholar|छात्रवृत्ति/i.test(a.documentType)?t('scholarship'):t('report');
 const lines=[`SarkariSaathi AI — ${t('shareType')}: ${type}`];
 a.keyFields.forEach((field,index)=>{if(!/amount|payment|due|राशि|भुगतान|बकाया/i.test(field.label)||!field.value)return;const matched=result.evidenceReport.entries.find(e=>e.path===`keyFields.${index}.evidence`)?.verified;const value=field.value.trim();if(matched&&/^(?:₹|INR\s?|Rs\.?\s?)[\d,]+(?:\.\d{1,2})?$/i.test(value)&&field.evidence?.includes(value))lines.push(`${t('amount')}: ${value}`);});
 if(a.deadline.isoDate)lines.push(`${t('shareDeadline')}: ${displayDate(a.deadline.isoDate,language)}`);
 lines.push(`${t('shareSteps')}: ${t('genericShareStep')}`,t('alwaysVerify'));
 return lines.slice(0,8).join('\n');
}
