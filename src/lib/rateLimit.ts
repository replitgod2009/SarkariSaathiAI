// Best-effort per-process protection on serverless. Instances do not share state.
// Production should use a shared TTL store such as Redis and a trusted proxy IP.
export class RateLimiter{
 private entries=new Map<string,{count:number;reset:number}>();
 constructor(private limit=20,private windowMs=3600000){}
 check(ip:string,now=Date.now()):{allowed:boolean;retryAfter:number}{for(const [key,value]of this.entries)if(value.reset<=now)this.entries.delete(key);let entry=this.entries.get(ip);if(!entry){if(this.entries.size>=10000)return {allowed:false,retryAfter:60};entry={count:0,reset:now+this.windowMs};this.entries.set(ip,entry);}if(entry.count>=this.limit)return {allowed:false,retryAfter:Math.ceil((entry.reset-now)/1000)};entry.count++;return {allowed:true,retryAfter:0};}
}
export const rateLimiter=new RateLimiter();
