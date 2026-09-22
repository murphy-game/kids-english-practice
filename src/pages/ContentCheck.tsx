import { useEffect,useMemo,useState } from 'react'
import { loadAppData } from '../services/dataLoader'
import { checkAssets } from '../utils/assetChecker'
import type { DataLoadResult } from '../types'
function CopyButton({label,text}:{label:string;text:string}){const[d,setD]=useState(false);return <button className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white" onClick={async()=>{await navigator.clipboard.writeText(text);setD(true);setTimeout(()=>setD(false),1500)}}>{d?'Copied ✓':label}</button>}
export default function ContentCheck(){const[data,setData]=useState<DataLoadResult|null>(null);useEffect(()=>{loadAppData().then(setData)},[]);const stats=useMemo(()=>data?{assets:checkAssets(data.content,data.assets),lessons:data.lessons.length,vocab:data.content.filter(x=>x.type==='vocab').length,sentence:data.content.filter(x=>x.type==='sentence').length,phonics:data.content.filter(x=>x.type==='phonics').length}:null,[data]);if(!data||!stats)return <main className="p-6">Loading…</main>;const emojiText=stats.assets.emojiSuggested.map(x=>`${x.image_key} -> ${x.emoji}`).join('
');const missingText=`Missing Vocabulary Images:

${stats.assets.missing.join('
')}

Generation instruction:
Create child-friendly vocabulary illustrations.
One clear object or concept per image.
Simple background.
No text.
Square composition.
Consistent visual style.`;const cards=[['Lessons',stats.lessons],['Vocabulary',stats.vocab],['Sentence',stats.sentence],['Phonics',stats.phonics],['Image keys',stats.assets.requiredKeys.length],['Emoji approved',stats.assets.emojiApproved.length],['Emoji suggested',stats.assets.emojiSuggested.length],['Image ready',stats.assets.imageReady.length],['Missing',stats.assets.missing.length]];return <main className="mx-auto max-w-6xl p-6"><h1 className="text-3xl font-bold">Content Check</h1><p className="mt-1 text-sm text-slate-500">Data Source: {data.source==='google_sheet'?'Google Sheet ✅':'Local fallback ⚠️'} · Last loaded: {new Date(data.loadedAt).toLocaleString()}</p><section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([l,v])=><div key={String(l)} className="rounded-2xl bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{l}</div><div className="mt-1 text-3xl font-bold">{v}</div></div>)}</section><section className="mt-6 grid gap-6 lg:grid-cols-2"><div className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><h2 className="text-xl font-bold">Emoji Suggestions</h2><CopyButton label="Copy Emoji Suggestions" text={emojiText||'No emoji suggestions'}/></div><div className="mt-4 max-h-96 overflow-auto">{stats.assets.emojiSuggested.map(x=><div key={x.image_key} className="flex justify-between border-b py-2"><span>{x.image_key}</span><span className="text-2xl">{x.emoji}</span></div>)}</div></div><div className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><h2 className="text-xl font-bold">Missing Images</h2><CopyButton label="Copy Missing List" text={missingText}/></div><div className="mt-4 max-h-96 overflow-auto">{stats.assets.missing.map(x=><div key={x} className="border-b py-2">{x}</div>)}</div></div></section></main>}
