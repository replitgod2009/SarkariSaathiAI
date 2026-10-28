import type {Analysis,Legibility,Signal,RiskResult,Language} from './types';
export function mergeRisk(signals:Signal[],analysis:Analysis,legibility:Legibility|undefined,transcript:string,language:Language='en'):RiskResult{
 const high=signals.some(s=>s.severity==='high'),medium=signals.filter(s=>s.severity==='medium').length;
 const orange=high||medium>=2||analysis.riskAssessment.status==='suspicious_details';
 const grey=analysis.riskAssessment.status==='unable_to_assess'||analysis.confidence==='low'||legibility==='poor'||transcript.trim().length<40;
 const contributors:RiskResult['contributors']=signals.map(s=>({origin:'automated',message:s.label,id:s.id}));
 contributors.push({origin:'ai',message:analysis.riskAssessment.reason});
 if(grey)contributors.push({origin:'readability',message:language==='hi'?'पढ़ने योग्य जानकारी या मॉडल का विश्वास पर्याप्त नहीं है।':'Readable information or model confidence is insufficient.'});
 return {status:orange?'suspicious_details':grey?'unable_to_assess':'no_obvious_warnings',contributors};
}
