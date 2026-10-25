import { civicTopics, type CivicChoice, type CivicCard } from '../shared/contracts';

export const civicChoices:CivicChoice[]=['yes','no','dont_know'];
export const civicChoiceLabels:Record<CivicChoice,string>={yes:'Yes',no:'No',dont_know:"Don't know"};
export const civicQueryKey=(userId:string,id:string)=>['community-card',userId,id];
export const topicLabel=(id:string|undefined)=>civicTopics.find(t=>t.id===id)?.label??'Community';
export function closingLabel(card:Pick<CivicCard,'closed'|'closesAt'>,now=Date.now()){
  const remaining=Date.parse(card.closesAt)-now;
  if(card.closed)return 'Closed';
  if(!Number.isFinite(remaining))return 'Deadline unavailable';
  if(remaining<=0)return 'Closing · updating results';
  if(remaining<3600000)return `Closes in ${Math.max(1,Math.ceil(remaining/60000))} min`;
  if(remaining<86400000)return `Closes in ${Math.ceil(remaining/3600000)} hr`;
  return `Closes in ${Math.ceil(remaining/86400000)} days`;
}
