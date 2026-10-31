import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build } from 'vite'
const repo=process.cwd()
const baseline='5119d1a863d89cf1201358d2e4a8addfc6b8e841'
const archive=await mkdtemp(path.join(tmpdir(),'clock-v5-audit-'))
await symlink(path.join(repo,'node_modules'),path.join(archive,'node_modules'),'dir')
execFileSync('tar',['-x','-C',archive],{input:execFileSync('git',['archive',baseline,'src'],{cwd:repo})})
async function load(source,label){
 const entry=path.join(archive,`${label}.ts`)
 await writeFile(entry,`export { createSnapshot, encodeSnapshot, decodeSnapshot } from '${source}/src/logic/snapshot';\nexport { SnapshotStore } from '${source}/src/adapters/storage';\nexport { applyAction } from '${source}/src/logic/app';\nexport { spec } from '${source}/src/data/spec';\n`)
 const result=await build({configFile:false,root:archive,logLevel:'silent',build:{write:false,minify:false,lib:{entry,formats:['es']},target:'esnext'}})
 const chunk=(Array.isArray(result)?result[0]:result).output.find(x=>x.type==='chunk')
 return import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`)
}
const old=await load(archive,'old');const current=await load(repo,'current')
assert.equal(old.createSnapshot(old.spec).version,5);assert.equal(current.createSnapshot(current.spec).version,6)
const data=new Map();const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}
const lock={run:async task=>task()};const key='audit';const now=Date.UTC(2026,9,31,9)
const options=(spec,writerId)=>({key,storage,lock,spec,writerId,now:()=>now,timeZone:()=> 'UTC'})
const v5=new old.SnapshotStore(options(old.spec,'v5'))
await v5.transact(latest=>{const r=old.applyAction(latest,{type:'start',sessionId:'legacy-active',timeZone:'UTC'},{now,dateKeyOf:()=> '2026-10-31'},old.spec);return{snapshot:r.snapshot,changed:r.changed,value:null}})
const oldTimer=structuredClone(v5.snapshot.timer);const missedEvent=new old.SnapshotStore(options(old.spec,'v5-missed-event'))
const upgraded=new current.SnapshotStore(options(current.spec,'v6'))
await upgraded.transact(latest=>{const r=current.applyAction(latest,{type:'reconcile'},{now,dateKeyOf:()=> '2026-10-31'},current.spec);return{snapshot:r.snapshot,changed:r.changed,value:null}})
assert.equal(upgraded.snapshot.version,6);assert.deepEqual(upgraded.snapshot.timer,oldTimer)
const v6text=data.get(key);assert.equal(JSON.parse(v6text).version,6)
assert.deepEqual(old.decodeSnapshot(v6text,old.spec,{timeZone:'UTC'}),{kind:'newer',version:6})
v5.receive(v6text);assert.equal(v5.status.persistence,'read-only')
const tryEnd=client=>client.transact(latest=>{const r=old.applyAction(latest,{type:'end',sessionId:'legacy-active'},{now:now+1000,dateKeyOf:()=> '2026-10-31'},old.spec);return{snapshot:r.snapshot,changed:r.changed,value:null}})
assert.equal((await tryEnd(v5)).saved,false);assert.equal(data.get(key),v6text)
assert.equal((await tryEnd(missedEvent)).saved,false);assert.equal(missedEvent.status.persistence,'read-only');assert.equal(data.get(key),v6text)
const cold=new old.SnapshotStore(options(old.spec,'v5-cold'));assert.equal(cold.status.persistence,'read-only');assert.equal(data.get(key),v6text)
console.log(JSON.stringify({archivedCommit:execFileSync('git',['rev-parse',baseline],{cwd:repo,encoding:'utf8'}).trim(),checks:['v5 active timer and assignment preserved','v6 migration committed','real v5 decoder rejects v6','received update blocks old writer','missed storage event still blocks old writer under transaction','cold v5 load read-only'],result:'pass'}))
