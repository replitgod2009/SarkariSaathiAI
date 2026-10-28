export class PublicError extends Error{
 constructor(message:string,readonly status=400,readonly code='genericError'){super(message);this.name='PublicError';}
}
