import {verifyEvidence} from './evidence';
import {datesInText,daysRemaining,todayInKolkata,validISO} from './dates';
import {detectSignals} from './signals';
import {evidenceReport} from './evidence';
import {mergeRisk} from './risk';
import type {Analysis,AnalysisResult,Language,Legibility} from './types';
export function postProcess(input:Analysis,transcript:string,language:Language,legibility?:Legibility,today=todayInKolkata()):AnalysisResult{
 const analysis=structuredClone(input);const deadline=analysis.deadline;
 if(deadline.isoDate&&(!validISO(deadline.isoDate)||!verifyEvidence(deadline.evidence,transcript)||!datesInText(deadline.evidence||'').includes(deadline.isoDate))){deadline.isoDate=null;analysis.unreadableOrMissing.push(language==='hi'?'अंतिम तिथि का स्रोत पाठ से स्पष्ट मिलान नहीं हुआ। मूल दस्तावेज़ जाँचें।':'The deadline could not be confirmed from its quoted text. Check the original document.');}
 const signals=detectSignals(transcript,language);
 return {analysis,signals,evidenceReport:evidenceReport(analysis,transcript),today,daysRemaining:daysRemaining(deadline.isoDate,today),finalRisk:mergeRisk(signals,analysis,legibility,transcript,language)};
}
