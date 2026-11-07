/** Stage00 adapter contract. UI frameworks are deliberately absent from the shared business layer. */
export type AppKind='web'|'resident'|'merchant'|'staff'
export type EntityTable='orgs'|'accounts'|'roles'|'communities'|'estates'|'buildings'|'units'|'houses'|'residents'|'applications'|'relations'|'missing'|'statistics'|'vehicles'|'facilities'|'parking'|'personnel'|'files'|'messages'
export interface DemoContext{app:AppKind;account:string;role?:string;community?:string;estate?:string;identityVersion?:number}
export interface DemoRecord{_id:string;_rev:number;_labels?:Record<string,string>;[field:string]:any}
export interface DemoActor extends DemoRecord{role:string;name:string;org:string;orgName:string;roleName:string;scopeLabel:string;permissions:string[];sensitive:string[];menus:string[];resident?:string}
export interface DemoInfo{session:string;version:string;generation:number;actor:DemoActor;counts:Record<string,number|null>;accounts:Array<{id:string;name:string;roles:Array<{id:string;name:string}>}>}
export type BusinessCommand='save'|'apply'|'withdraw'|'review'|'profile'|'status'|'verifyVehicle'|'fileVersion'|'messageRead'|'messageSend'|'remind'
export interface CommandResult{id:string;message:string}
export interface Stage00Service{
 stage01:Stage01Service;
 service:ServicePrototypeService;
 app:string;session:string;context():DemoContext;onChange(listener:()=>void):()=>void
 start():Promise<DemoInfo>;info():Promise<DemoInfo>;identity(account:string,role:string):Promise<DemoInfo>
 query(table:string,filters?:Record<string,any>):Promise<DemoRecord[]>;record(table:string,id:string):Promise<DemoRecord>
 history(table:string,id:string):Promise<Record<string,any>[]>;labels(table:string,rows:DemoRecord[]):Promise<DemoRecord[]>
 options(table:string,field:string,data?:Record<string,any>):Promise<Array<{value:string;label:string}>>
 label(table:string,field:string,value:any):Promise<string>
 command(command:BusinessCommand,parameters?:Record<string,any>):Promise<CommandResult>
 draft(key:string,data?:Record<string,any>|null):Promise<Record<string,any>|null>
 scopes():Promise<{communities:Array<{value:string;label:string}>;estates:Array<{value:string;label:string}>}>
 scope(community:string,estate?:string):Promise<void>;reset():Promise<void>;sample?(name:string):Promise<void>
 summary(id:string):Promise<{counts:Record<string,number>;sources:DemoRecord[]}>
 upload(file:any,options?:{fail?:boolean}):Promise<{id:string;name:string;size:number;type?:string}>
 /** H5 returns a local Blob; WeChat returns a saved sandbox file path. Never a production URL. */
 ownedAttachment(id:string):Promise<any>;attachment(parameters:Record<string,any>):Promise<any>
 versions(id:string):Promise<Record<string,any>[]>
}

export interface Stage01Service { query(table:string,filters?:Record<string,any>):Promise<DemoRecord[]>; record(table:string,id:string):Promise<any>; options():Promise<any>; overview():Promise<any>; command(name:string,p?:Record<string,any>):Promise<CommandResult>; auxiliary(name:string,p?:Record<string,any>):Promise<any>; importPreview(p:Record<string,any>):Promise<any>; reset():Promise<void>; upload(file:any,options?:{fail?:boolean}):Promise<any>; attachment(p:Record<string,any>):Promise<any>; accounts():Promise<any[]> }

/** Stage02 isolated frontend service; no real payment or production API. */
export interface ServicePrototypeService { query(table:string,filters?:Record<string,any>):Promise<DemoRecord[]>; record(table:string,id:string):Promise<any>; options():Promise<any>; overview(filters?:Record<string,any>):Promise<any>; command(name:string,p?:Record<string,any>):Promise<any>; auxiliary(name:string,p?:Record<string,any>):Promise<any>; reset():Promise<void>; draft(key:string,data?:Record<string,any>|null):Promise<any>; upload(file:any,options?:Record<string,any>):Promise<any>; attachment(p:Record<string,any>):Promise<any>; accounts():Promise<any[]> }
