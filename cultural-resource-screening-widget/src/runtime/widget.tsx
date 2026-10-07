import { React, type AllWidgetProps } from 'jimu-core'
import { Button, Alert, Loading, LoadingType } from 'jimu-ui'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import GraphicsLayer from 'esri/layers/GraphicsLayer'
import FeatureLayer from 'esri/layers/FeatureLayer'
import type Layer from 'esri/layers/Layer'
import Graphic from 'esri/Graphic'
import SketchViewModel from 'esri/widgets/Sketch/SketchViewModel'
import type MapView from 'esri/views/MapView'
import type Geometry from 'esri/geometry/Geometry'
import type { IMConfig } from '../config'

type DrawTool = 'circle' | 'rectangle' | 'polygon'
interface CheckResult { label:string; layerTitle:string; count:number; status:'clear'|'found'|'missing'|'error'; objectIds:Array<string|number> }

const Widget = (props: AllWidgetProps<IMConfig>) => {
  const [jimuMapView,setJimuMapView]=React.useState<JimuMapView>(null)
  const [drawing,setDrawing]=React.useState(false)
  const [checking,setChecking]=React.useState(false)
  const [results,setResults]=React.useState<CheckResult[]>([])
  const [message,setMessage]=React.useState('Draw a review area to screen cultural-resource layers.')
  const [broadbandCount,setBroadbandCount]=React.useState<number|null>(null)
  const graphicsLayerRef=React.useRef<GraphicsLayer>(null)
  const sketchRef=React.useRef<SketchViewModel>(null)
  const highlightHandlesRef=React.useRef<any[]>([])

  const broadbandLayerTitle=props.config?.broadbandLayerTitle || 'MWT Broadband Lines'
  const checkBroadbandPresence=props.config?.checkBroadbandPresence !== false
  const checks=(props.config?.checks || []).filter(c=>c.enabled !== false)
  const getView=()=> (jimuMapView?.view as MapView) || null
  const flattenLayers=(layers:__esri.Collection<Layer>):Layer[]=>{ const out:Layer[]=[]; layers.forEach((layer:any)=>{ out.push(layer); if(layer.layers) out.push(...flattenLayers(layer.layers)) }); return out }
  const findFeatureLayer=(title:string):FeatureLayer|null=>{ const view=getView(); if(!view?.map||!title) return null; const wanted=title.trim().toLowerCase(); const layer=flattenLayers(view.map.layers).find((l:any)=>(l.title||'').trim().toLowerCase()===wanted); return layer&&layer.type==='feature' ? layer as FeatureLayer : null }
  const clearHighlights=()=>{ highlightHandlesRef.current.forEach(h=>{try{h.remove()}catch(_){}}); highlightHandlesRef.current=[] }
  const queryLayer=async(layer:FeatureLayer,geometry:Geometry)=>{ await layer.load(); const q=layer.createQuery(); q.geometry=geometry; q.spatialRelationship='intersects'; q.returnGeometry=true; q.outFields=[layer.objectIdField||'*']; return await layer.queryFeatures(q) }
  const highlightFeatures=async(layer:FeatureLayer,graphics:Graphic[])=>{ const view=getView(); if(!view||!graphics.length) return; try{ const ids=graphics.map(g=>g.attributes?.[layer.objectIdField]).filter(v=>v!==undefined&&v!==null); if(ids.length){ const lv=await view.whenLayerView(layer); highlightHandlesRef.current.push((lv as __esri.FeatureLayerView).highlight(ids)) }}catch(_){} }

  const screenGeometry=async(geometry:Geometry)=>{
    const view=getView(); if(!view) return; setChecking(true); setResults([]); setBroadbandCount(null); clearHighlights(); setMessage('Screening the drawn review area…')
    let broadbandHit:number|null=null
    if(checkBroadbandPresence){ const layer=findFeatureLayer(broadbandLayerTitle); if(layer){ try{ const r=await queryLayer(layer,geometry); broadbandHit=r.features.length; setBroadbandCount(broadbandHit); await highlightFeatures(layer,r.features) }catch(_){ setBroadbandCount(null) } } }
    const output:CheckResult[]=[]
    for(const check of checks){ const layer=findFeatureLayer(check.layerTitle); if(!layer){ output.push({label:check.label,layerTitle:check.layerTitle,count:0,status:'missing',objectIds:[]}); continue } try{ const r=await queryLayer(layer,geometry); const ids=r.features.map(g=>g.attributes?.[layer.objectIdField]).filter(v=>v!==undefined&&v!==null); output.push({label:check.label,layerTitle:check.layerTitle,count:r.features.length,status:r.features.length?'found':'clear',objectIds:ids}); if(r.features.length) await highlightFeatures(layer,r.features) }catch(_){ output.push({label:check.label,layerTitle:check.layerTitle,count:0,status:'error',objectIds:[]}) } }
    setResults(output); const hits=output.filter(r=>r.status==='found').length; const incomplete=output.filter(r=>r.status==='missing'||r.status==='error').length
    if(checkBroadbandPresence && broadbandHit===0) setMessage('Screening complete. The drawn review area does not intersect the configured broadband layer.')
    else if(hits>0) setMessage(`THPO review recommended: ${hits} cultural-resource layer${hits===1?'':'s'} returned features.`)
    else if(incomplete>0) setMessage('No resources found in completed checks, but one or more layers could not be screened.')
    else setMessage('No configured cultural resources were found inside the review area.')
    setChecking(false)
  }

  const ensureSketch=()=>{ const view=getView(); if(!view) return null; if(!graphicsLayerRef.current){ const layer=new GraphicsLayer({title:'Cultural Resource Screening - Review Area',listMode:'hide'}); graphicsLayerRef.current=layer; view.map.add(layer) } if(!sketchRef.current){ sketchRef.current=new SketchViewModel({view,layer:graphicsLayerRef.current,polygonSymbol:{type:'simple-fill',color:[0,0,0,0.06],outline:{color:[0,122,194,1],width:2}} as any}); sketchRef.current.on('create',async(event:__esri.SketchViewModelCreateEvent)=>{ if(event.state==='complete'){ setDrawing(false); if(event.graphic?.geometry) await screenGeometry(event.graphic.geometry) } else if(event.state==='cancel'){ setDrawing(false); setMessage('Drawing cancelled.') } }) } return sketchRef.current }
  const startDrawing=(tool:DrawTool)=>{ const view=getView(); if(!view){setMessage('Connect this widget to a Map widget first.');return} const sketch=ensureSketch(); if(!sketch)return; clearHighlights(); setResults([]); setBroadbandCount(null); setDrawing(true); setMessage(tool==='circle'?'Draw a circle around the broadband area you want to review.':tool==='rectangle'?'Draw a rectangle around the broadband area you want to review.':'Draw a polygon around the broadband area you want to review.'); try{sketch.cancel()}catch(_){} sketch.create(tool) }
  const clearAll=()=>{ try{sketchRef.current?.cancel()}catch(_){} graphicsLayerRef.current?.removeAll(); clearHighlights(); setDrawing(false); setChecking(false); setResults([]); setBroadbandCount(null); setMessage('Draw a review area to screen cultural-resource layers.') }
  const zoomToArea=async()=>{ const view=getView(); const layer=graphicsLayerRef.current; if(view&&layer&&layer.graphics.length){ try{await view.goTo(layer.graphics)}catch(_){} } }
  React.useEffect(()=>()=>{ try{sketchRef.current?.destroy()}catch(_){} clearHighlights(); const view=getView(); if(view&&graphicsLayerRef.current){try{view.map.remove(graphicsLayerRef.current)}catch(_){}} },[])
  const foundCount=results.filter(r=>r.status==='found').length; const incomplete=results.some(r=>r.status==='missing'||r.status==='error')
  return <div className='p-3 w-100'>
    {props.useMapWidgetIds?.[0] && <JimuMapViewComponent useMapWidgetId={props.useMapWidgetIds[0]} onActiveViewChange={(v:JimuMapView)=>setJimuMapView(v)} />}
    <div className='mb-3'><div className='font-weight-bold mb-1'>Cultural Resource Screening Tool</div><div className='small text-secondary'>Draw a review area around part of the broadband route. The tool reports configured cultural resources that intersect the area.</div></div>
    {!props.useMapWidgetIds?.[0] && <Alert open type='warning' text='Open widget settings and connect this widget to the Map widget.' className='mb-3' />}
    <div className='mb-2 font-weight-bold'>Draw review area</div>
    <div className='d-flex flex-wrap mb-3' style={{gap:8}}><Button type='primary' onClick={()=>startDrawing('circle')} disabled={!jimuMapView||checking}>Circle</Button><Button onClick={()=>startDrawing('rectangle')} disabled={!jimuMapView||checking}>Rectangle</Button><Button onClick={()=>startDrawing('polygon')} disabled={!jimuMapView||checking}>Polygon</Button><Button onClick={clearAll}>Clear</Button></div>
    {drawing && <Alert open type='info' text='Drawing mode is active. Complete the shape on the map to run the screening.' className='mb-3' />}
    {checking && <div className='d-flex align-items-center mb-3'><Loading type={LoadingType.Donut} width={20} height={20}/><span className='ml-2'>Running spatial checks…</span></div>}
    <Alert open type={foundCount>0?'warning':(incomplete?'warning':'info')} text={message} className='mb-3' />
    {checkBroadbandPresence && broadbandCount!==null && <div className='border rounded p-2 mb-3'><div className='small text-secondary'>Broadband route</div><div className='font-weight-bold'>{broadbandCount>0?`✓ Review area intersects ${broadbandLayerTitle}`:`⚠ Review area does not intersect ${broadbandLayerTitle}`}</div></div>}
    {results.length>0 && <div><div className='font-weight-bold mb-2'>Screening results</div>{results.map((r,i)=>{const icon=r.status==='found'?'⚠':r.status==='clear'?'✓':r.status==='missing'?'?':'!'; const status=r.status==='found'?`${r.count} found`:r.status==='clear'?'None found':r.status==='missing'?'Layer not found':'Check failed'; return <div key={`${r.layerTitle}-${i}`} className='border-bottom py-2'><div className='d-flex justify-content-between align-items-start'><div className='pr-2'><span>{icon}</span>{' '}<strong>{r.label}</strong><div className='small text-secondary'>{r.layerTitle}</div></div><div className='text-right'>{status}</div></div></div>})}<div className='border rounded p-3 mt-3'><div className='small text-secondary'>Overall screening status</div><div className='font-weight-bold'>{foundCount>0?'⚠ THPO REVIEW RECOMMENDED':incomplete?'⚠ SCREENING INCOMPLETE':'✓ NO CONFIGURED RESOURCES FOUND'}</div></div><div className='d-flex flex-wrap mt-3' style={{gap:8}}><Button onClick={zoomToArea}>Zoom to review area</Button><Button onClick={clearAll}>New screening</Button></div></div>}
    <div className='small text-secondary mt-3'>Screening aid only. Final cultural-resource determinations should follow THPO review procedures.</div>
  </div>
}
export default Widget
