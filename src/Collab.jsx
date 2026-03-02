import { useState, useEffect, useRef } from 'react'
import { rtdb } from './firebase.js'
import { ref, set, get, onValue, push, update, remove } from 'firebase/database'
import { uid } from './utils.js'
import { ARCHETYPES, AFFINITIES, SPECIAL_AFFs, ALL_ELEMENTS, GRADES, ROLES, AFF_CLR, GRADE_CLR, calcStats, getTierName } from './constants.js'

// ── UTILS ───────────────────────────────────────────────────────────────────
function genCode() { return 'EVO-'+Math.random().toString(36).substring(2,5).toUpperCase() }
function getUserProfile() { try { const p=localStorage.getItem('evo_user_profile'); return p?JSON.parse(p):null } catch { return null } }
function saveUserProfile(p) { localStorage.setItem('evo_user_profile',JSON.stringify(p)) }
function objToArr(obj) {
  if (!obj||typeof obj!=='object'||Array.isArray(obj)) return obj||[]
  return Object.entries(obj).map(([id,v])=>({id,...v}))
}

// ── SHARED UI ───────────────────────────────────────────────────────────────
function BackBtn({ onClick, label='← Back' }) {
  return <button onClick={onClick} style={{ background:'rgba(201,168,76,0.1)',border:'1px solid rgba(201,168,76,0.25)',borderRadius:20,padding:'6px 16px',color:'var(--gold2)',fontFamily:'Cinzel,serif',fontSize:11,cursor:'pointer',flexShrink:0,letterSpacing:1 }}>{label}</button>
}

function HeaderBar({ left, center, right }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'rgba(13,10,26,0.97)',borderBottom:'1px solid var(--border)',flexShrink:0,backdropFilter:'blur(12px)' }}>
      {left}
      <div style={{ flex:1,overflow:'hidden',minWidth:0 }}>{center}</div>
      {right&&<div style={{ display:'flex',gap:6,alignItems:'center',flexShrink:0 }}>{right}</div>}
    </div>
  )
}

function Overlay({ zIndex=200, children }) {
  return <div style={{ position:'absolute',inset:0,zIndex,background:'var(--bg)',display:'flex',flexDirection:'column',overflow:'hidden' }}>{children}</div>
}

function MBtn({ children, className, onClick, disabled, style }) {
  const r=useRef(null)
  const hm=(e)=>{ if(!r.current||disabled)return; const rect=r.current.getBoundingClientRect(); r.current.style.transform='translate('+(e.clientX-rect.left-rect.width/2)*0.3+'px,'+(e.clientY-rect.top-rect.height/2)*0.3+'px)' }
  const hl=()=>{ if(!r.current)return; r.current.style.transition='transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)'; r.current.style.transform='translate(0,0)'; setTimeout(()=>{ if(r.current)r.current.style.transition='' },500) }
  return <button ref={r} className={'magnet-btn '+(className||'')} onClick={onClick} disabled={disabled} style={style} onMouseMove={hm} onMouseLeave={hl}>{children}</button>
}

function IBtn({ children, onClick, title, color='var(--gold2)', bg='rgba(201,168,76,0.1)', border='rgba(201,168,76,0.25)' }) {
  return <button onClick={onClick} title={title} style={{ background:bg,border:'1px solid '+border,borderRadius:8,padding:'4px 8px',color,cursor:'pointer',fontSize:11,fontFamily:'Cinzel,serif',flexShrink:0 }}>{children}</button>
}

function ToolBtn({ icon, label, onClick, color='var(--text2)' }) {
  return (
    <button onClick={onClick} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'8px 4px',background:'none',border:'none',borderRight:'1px solid var(--border)',cursor:'pointer',color,transition:'background .2s' }}
      onMouseEnter={e=>e.currentTarget.style.background='rgba(201,168,76,0.06)'}
      onMouseLeave={e=>e.currentTarget.style.background='none'}>
      <span style={{ fontSize:16 }}>{icon}</span>
      <span style={{ fontSize:8,fontFamily:'Cinzel,serif',letterSpacing:0.5,whiteSpace:'nowrap' }}>{label}</span>
    </button>
  )
}

// ── SETUP MODAL ─────────────────────────────────────────────────────────────
function SetupProfileModal({ onDone }) {
  const [name,setName]=useState('')
  const save=()=>{ if(!name.trim())return; const p={name:name.trim(),id:'USR-'+Math.random().toString(36).substring(2,8).toUpperCase(),createdAt:Date.now()}; saveUserProfile(p); onDone(p) }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-drag"/>
        <div className="modal-title">✦ Writer Identity</div>
        <p style={{ fontSize:13,color:'var(--text2)',marginBottom:16,lineHeight:1.6 }}>Choose your writer name. This identifies you in collaborative stories.</p>
        <div className="form-group">
          <label className="form-label">Your Writer Name</label>
          <input className="form-input" placeholder="e.g. DarkScribe..." value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} autoFocus/>
        </div>
        <MBtn className="btn btn-gold btn-full" onClick={save} disabled={!name.trim()}>Begin Your Legend ✦</MBtn>
      </div>
    </div>
  )
}

// ── CHAT PANEL ───────────────────────────────────────────────────────────────
function ChatPanel({ sessionId, user, members, onClose }) {
  const [messages,setMessages]=useState([])
  const [text,setText]=useState('')
  const [replyTo,setReplyTo]=useState(null)
  const bottomRef=useRef(null)

  useEffect(()=>{
    if(!rtdb||!sessionId)return
    const r=ref(rtdb,'collab_sessions/'+sessionId+'/chat')
    const unsub=onValue(r,snap=>{ const val=snap.val(); setMessages(val?objToArr(val).sort((a,b)=>a.ts-b.ts):[]) })
    return ()=>unsub()
  },[sessionId])

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[messages])

  const send=async()=>{
    if(!text.trim()||!rtdb)return
    const msg={text:text.trim(),userId:user.id,userName:user.name,ts:Date.now()}
    if(replyTo) msg.replyTo={id:replyTo.id,text:replyTo.text.substring(0,80),userName:replyTo.userName}
    await push(ref(rtdb,'collab_sessions/'+sessionId+'/chat'),msg)
    setText(''); setReplyTo(null)
  }

  return (
    <Overlay zIndex={300}>
      <HeaderBar
        left={<BackBtn onClick={onClose}/>}
        center={<div style={{ fontFamily:'Cinzel,serif',fontSize:12,color:'var(--gold2)',letterSpacing:2 }}>⚡ COLLAB CHAT</div>}
      />

      {/* Online members row */}
      <div style={{ padding:'6px 14px',borderBottom:'1px solid var(--border)',display:'flex',flexWrap:'wrap',gap:5 }}>
        {Object.values(members||{}).map(m=>(
          <div key={m.id} style={{ display:'flex',alignItems:'center',gap:4,fontSize:9,fontFamily:'Cinzel,serif',color:m.online?'#4caf50':'var(--text3)',padding:'2px 8px',borderRadius:20,border:'1px solid '+(m.online?'rgba(76,175,80,0.3)':'var(--border)') }}>
            <div style={{ width:5,height:5,borderRadius:'50%',background:m.online?'#4caf50':'var(--text3)' }}/>{m.name}
          </div>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8 }}>
        {messages.length===0&&<div style={{ textAlign:'center',color:'var(--text3)',fontSize:13,marginTop:30 }}>No messages yet. Start the conversation!</div>}
        {messages.map(m=>{
          const isMe=m.userId===user.id
          return (
            <div key={m.id} style={{ display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start' }}>
              <div style={{ fontSize:9,fontFamily:'Cinzel,serif',color:'var(--text3)',marginBottom:2 }}>{isMe?'You':m.userName}</div>

              {/* Reply quote */}
              {m.replyTo&&(
                <div style={{ maxWidth:'78%',padding:'4px 10px',marginBottom:3,borderLeft:'2px solid var(--gold)',background:'rgba(201,168,76,0.06)',borderRadius:4,fontSize:11,color:'var(--text3)',fontStyle:'italic' }}>
                  <span style={{ color:'var(--gold)',fontFamily:'Cinzel,serif',fontSize:9 }}>{m.replyTo.userName}: </span>
                  {m.replyTo.text}
                </div>
              )}

              <div style={{ display:'flex',alignItems:'flex-end',gap:6,flexDirection:isMe?'row-reverse':'row' }}>
                <div style={{ maxWidth:'75%',padding:'10px 13px',borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',background:isMe?'rgba(201,168,76,0.15)':'var(--panel)',border:'1px solid '+(isMe?'rgba(201,168,76,0.3)':'var(--border)'),fontSize:13,color:'var(--text)',lineHeight:1.5 }}>
                  {m.text}
                </div>
                {/* Reply button */}
                <button onClick={()=>setReplyTo(m)} style={{ background:'rgba(201,168,76,0.1)',border:'1px solid rgba(201,168,76,0.25)',borderRadius:8,color:'var(--gold2)',cursor:'pointer',fontSize:11,padding:'3px 7px',fontFamily:'Cinzel,serif',flexShrink:0 }} title="Reply">↩ Reply</button>
              </div>
              <div style={{ fontSize:8,color:'var(--text3)',marginTop:2 }}>{new Date(m.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          )
        })}
        <div ref={bottomRef}/>
      </div>

      {/* Reply preview */}
      {replyTo&&(
        <div style={{ padding:'6px 14px',background:'rgba(201,168,76,0.06)',borderTop:'1px solid rgba(201,168,76,0.2)',display:'flex',alignItems:'center',gap:8 }}>
          <div style={{ flex:1,fontSize:11,color:'var(--text2)',fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
            <span style={{ color:'var(--gold)',fontFamily:'Cinzel,serif',fontSize:9 }}>Replying to {replyTo.userName}: </span>
            {replyTo.text.substring(0,60)}
          </div>
          <button onClick={()=>setReplyTo(null)} style={{ background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:14 }}>✕</button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding:'10px 14px',borderTop:'1px solid var(--border)',display:'flex',gap:8 }}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
          placeholder={replyTo?'Write your reply...':'Type a message...'}
          style={{ flex:1,background:'var(--panel)',border:'1px solid rgba(201,168,76,0.5)',borderRadius:20,padding:'10px 14px',color:'var(--text)',fontFamily:'Crimson Pro,serif',fontSize:13,outline:'none',boxShadow:'0 0 8px rgba(201,168,76,0.2)' }}
        <button onClick={send} style={{ background:'rgba(201,168,76,0.2)',border:'1px solid rgba(201,168,76,0.4)',borderRadius:'50%',width:38,height:38,color:'var(--gold2)',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{'➤'}</button>
      </div>
    </Overlay>
  )
}

// ── SKILL MODAL (collab) ─────────────────────────────────────────────────────
const SKILL_TYPE_CLR = { Attack:'#ff4d4d', Buff:'#4caf50', Debuff:'#9b5de5' }
const SKILL_TYPE_FIELDS = {
  Attack:[['dmg','DMG'],['hpHeal','HP Heal'],['mpHeal','MP Regen']],
  Buff:[['hpHeal','HP Heal'],['mpHeal','MP Regen'],['speedUp','Speed Up'],['atkBuff','ATK Buff'],['defBuff','DEF Buff']],
  Debuff:[['atkDebuff','ATK Debuff'],['defDebuff','DEF Debuff'],['dmg','DMG']],
}

function CollabSkillModal({ existing, onClose, onSave }) {
  const blank={name:'',type:'Attack',element:'Fire',level:1,description:'',dmg:0,hpHeal:0,mpHeal:0,speedUp:0,atkBuff:0,defBuff:0,atkDebuff:0,defDebuff:0}
  const [f,sf]=useState(existing||blank)
  const set=(k,v)=>sf(p=>({...p,[k]:v}))
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-drag"/>
        <div className="modal-title">{existing?'✏ Edit Skill':'⚡ Add Skill'}</div>
        <div className="form-group"><label className="form-label">Skill Name</label><input className="form-input" placeholder="e.g. Flame Strike..." value={f.name} onChange={e=>set('name',e.target.value)} autoFocus/></div>
        <div className="form-group">
          <label className="form-label">Type</label>
          <div className="radio-group">
            {['Attack','Buff','Debuff'].map(t=><div key={t} className={'radio-btn '+(f.type===t?'active':'')} style={f.type===t?{borderColor:SKILL_TYPE_CLR[t],color:SKILL_TYPE_CLR[t]}:{}} onClick={()=>set('type',t)}>{t}</div>)}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Element</label>
          <div className="multi-select">{ALL_ELEMENTS.map(el=><div key={el} className={'multi-chip '+(f.element===el?'sel':'')} style={{color:AFF_CLR[el]}} onClick={()=>set('element',el)}>{el}</div>)}</div>
        </div>
        <div className="form-group"><label className="form-label">Skill Level</label><input type="number" className="form-number" value={f.level} min={1} onChange={e=>set('level',Math.max(1,+e.target.value))}/></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" style={{minHeight:60}} placeholder="Describe what this skill does..." value={f.description||f.desc||''} onChange={e=>set('description',e.target.value)}/></div>
        <div className="form-group">
          <label className="form-label">Skill Stats</label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {(SKILL_TYPE_FIELDS[f.type]||[]).map(([key,label])=>(
              <div key={key}>
                <div style={{fontSize:9,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:1,marginBottom:4}}>{label}</div>
                <input type="number" className="form-number" value={f[key]||0} min={0} onChange={e=>set(key,+e.target.value)}/>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <MBtn className="btn btn-outline" onClick={onClose}>Cancel</MBtn>
          <MBtn className="btn btn-gold" style={{flex:1}} onClick={()=>{ if(!f.name.trim())return; onSave({...f,id:f.id||uid()}); onClose() }}>{existing?'Save Changes':'Add Skill'}</MBtn>
        </div>
      </div>
    </div>
  )
}

// ── CHARACTER EDITOR ─────────────────────────────────────────────────────────
function CharEditor({ sessionId, char, chapters, user, onBack }) {
  const [c,setC]=useState(char)
  const [saving,setSaving]=useState(false)
  const [showSkill,setShowSkill]=useState(false)
  const [editSkill,setEditSkill]=useState(null)
  const [activeTab,setActiveTab]=useState('base') // 'base' or chapter id
  const [chapterStats,setChapterStats]=useState(char.chapterStats||{})
  const stats=calcStats(c.level||1)

  const patch=(field,val)=>setC(prev=>({...prev,[field]:val}))
  const togAff=(a)=>{
    const cur=c.affinities||[]
    patch('affinities', cur.includes(a)?cur.filter(x=>x!==a):[...cur,a])
  }

  // Chapter stats helpers
  const getChStat=(chId)=>chapterStats[chId]||{}
  const patchChStat=(chId,field,val)=>setChapterStats(prev=>({...prev,[chId]:{...prev[chId],[field]:val}}))
  const chSkills=(chId)=>getChStat(chId).skills||c.skills||[]
  const setChSkills=(chId,skills)=>patchChStat(chId,'skills',skills)

  const save=async()=>{
    if(!rtdb)return
    setSaving(true)
    await update(ref(rtdb,'collab_sessions/'+sessionId+'/characters/'+c.id),{...c,chapterStats,lastEditBy:user.name,lastEditAt:Date.now()})
    setSaving(false)
    onBack()
  }

  const sel=(label,field,opts,chId)=>{
    const val=chId ? (getChStat(chId)[field]||c[field]||opts[0]) : (c[field]||opts[0])
    const onChange=chId ? (v=>patchChStat(chId,field,v)) : (v=>patch(field,v))
    return (
      <div className="form-group" key={field}>
        <label className="form-label">{label}</label>
        <select className="form-input" value={val} onChange={e=>onChange(e.target.value)}>
          {opts.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }

  const isChTab=activeTab!=='base'
  const chId=isChTab?activeTab:null

  return (
    <Overlay zIndex={280}>
      <HeaderBar
        left={<BackBtn onClick={onBack}/>}
        center={<div style={{fontFamily:'Cinzel,serif',fontSize:13,color:'var(--gold2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>}
        right={<div style={{display:'flex',gap:6,alignItems:'center'}}>{saving&&<span style={{fontSize:9,color:'var(--text3)',fontFamily:'Cinzel,serif'}}>saving...</span>}<IBtn onClick={save}>Save ✦</IBtn></div>}
      />

      {/* Tab bar: Base + per chapter */}
      <div style={{display:'flex',overflowX:'auto',borderBottom:'1px solid var(--border)',background:'rgba(13,10,26,0.8)',flexShrink:0}}>
        <button onClick={()=>setActiveTab('base')} style={{padding:'8px 14px',background:'none',border:'none',borderBottom:activeTab==='base'?'2px solid var(--gold)':'2px solid transparent',color:activeTab==='base'?'var(--gold2)':'var(--text3)',fontFamily:'Cinzel,serif',fontSize:10,cursor:'pointer',whiteSpace:'nowrap',letterSpacing:1}}>
          BASE
        </button>
        {(chapters||[]).map(ch=>(
          <button key={ch.id} onClick={()=>setActiveTab(ch.id)} style={{padding:'8px 12px',background:'none',border:'none',borderBottom:activeTab===ch.id?'2px solid var(--gold)':'2px solid transparent',color:activeTab===ch.id?'var(--gold2)':'var(--text3)',fontFamily:'Cinzel,serif',fontSize:9,cursor:'pointer',whiteSpace:'nowrap',letterSpacing:0.5}}>
            {ch.title.length>16?ch.title.substring(0,16)+'…':ch.title}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'12px 14px'}}>

        {/* Chapter tab header */}
        {isChTab&&(
          <div style={{marginBottom:10,padding:'8px 12px',background:'rgba(201,168,76,0.05)',border:'1px solid rgba(201,168,76,0.15)',borderRadius:8,fontSize:11,color:'var(--text2)',fontFamily:'Cinzel,serif'}}>
            ✦ Editing stats for: <span style={{color:'var(--gold2)'}}>{chapters.find(ch=>ch.id===chId)?.title}</span>
            <div style={{fontSize:9,color:'var(--text3)',marginTop:2}}>Leave blank to inherit base stats</div>
          </div>
        )}

        {/* Stats display */}
        {!isChTab&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
            {[['HP',stats.hp],['Mana',stats.mana],['Speed',stats.speed]].map(([k,v])=>(
              <div key={k} style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:8,padding:'8px',textAlign:'center'}}>
                <div style={{fontSize:9,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:1}}>{k}</div>
                <div style={{fontFamily:'Cinzel,serif',fontSize:14,color:'var(--gold2)',marginTop:2}}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {/* Level */}
        <div className="form-group">
          <label className="form-label">Level (1–100)</label>
          <input className="form-input" type="number" min="1" max="100"
            value={isChTab?(getChStat(chId).level||c.level||1):(c.level||1)}
            onChange={e=>isChTab?patchChStat(chId,'level',parseInt(e.target.value)||1):patch('level',parseInt(e.target.value)||1)}/>
          <div style={{fontSize:10,fontFamily:'Cinzel,serif',color:'var(--gold)',marginTop:4}}>
            ⚔ {getTierName(isChTab?(getChStat(chId).level||c.level||1):(c.level||1))}
          </div>
        </div>

        {/* Base-only fields */}
        {!isChTab&&(
          <>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={c.name||''} onChange={e=>patch('name',e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <div className="radio-group">{ROLES.map(r=><div key={r} className={'radio-btn '+(c.role===r?'active':'')} onClick={()=>patch('role',r)}>{r}</div>)}</div>
            </div>
          </>
        )}

        {sel('Archetype','archetype',ARCHETYPES,chId)}
        {sel('Grade / Rank','grade',GRADES,chId)}
        {!isChTab&&sel('Affinity (Primary)','affinity',[...AFFINITIES,...SPECIAL_AFFs],null)}

        {/* Multi affinities — base only */}
        {!isChTab&&(
          <div className="form-group">
            <label className="form-label">Affinities</label>
            <div className="multi-select">
              {[...AFFINITIES,...SPECIAL_AFFs].map(a=>(
                <div key={a} className={'multi-chip '+((c.affinities||[]).includes(a)?'sel':'')} style={{color:AFF_CLR[a]}} onClick={()=>togAff(a)}>{a}</div>
              ))}
            </div>
          </div>
        )}

        {/* Backstory — base only */}
        {!isChTab&&(
          <div className="form-group">
            <label className="form-label">Backstory / Lore</label>
            <textarea className="form-input" rows={4} value={c.lore||c.bio||''} onChange={e=>{patch('lore',e.target.value);patch('bio',e.target.value)}} style={{resize:'vertical'}}/>
          </div>
        )}

        {/* Skills */}
        <div style={{fontSize:9,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:2,marginBottom:8}}>SKILLS</div>
        {(isChTab?chSkills(chId):c.skills||[]).map(sk=>(
          <div key={sk.id||sk.name} className="skill-item" style={{'--element-clr':AFF_CLR[sk.element]||'var(--gold)'}}>
            <div style={{flex:1}}>
              <div className="skill-name">{sk.name}</div>
              <div style={{display:'flex',gap:5,marginTop:3,flexWrap:'wrap'}}>
                <span style={{fontSize:9,padding:'1px 6px',borderRadius:10,border:'1px solid '+(SKILL_TYPE_CLR[sk.type]||'var(--gold)'),color:SKILL_TYPE_CLR[sk.type]||'var(--gold)',fontFamily:'Cinzel,serif'}}>{sk.type}</span>
                <span className="skill-element" style={{color:AFF_CLR[sk.element]||'var(--gold)',borderColor:AFF_CLR[sk.element]||'var(--gold)'}}>{sk.element}</span>
                <span className="skill-lvl">Lv.{sk.level}</span>
              </div>
              {(sk.description||sk.desc)&&<div style={{fontSize:11,color:'var(--text3)',marginTop:3,fontStyle:'italic'}}>{sk.description||sk.desc}</div>}
            </div>
            <button onClick={()=>setEditSkill({...sk,_chId:isChTab?chId:null})} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:13,padding:'0 4px'}}>✏</button>
            <button onClick={()=>{
              if(isChTab) setChSkills(chId,chSkills(chId).filter(x=>x.id!==sk.id&&x.name!==sk.name))
              else patch('skills',(c.skills||[]).filter(x=>x.id!==sk.id&&x.name!==sk.name))
            }} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:18,padding:'0 4px'}}>×</button>
          </div>
        ))}
        <MBtn className="btn btn-outline btn-full" style={{marginTop:6,marginBottom:20}} onClick={()=>setShowSkill(true)}>+ Add Skill</MBtn>
      </div>

      {showSkill&&<CollabSkillModal onClose={()=>setShowSkill(false)} onSave={sk=>{
        if(isChTab) setChSkills(chId,[...chSkills(chId),sk])
        else patch('skills',[...(c.skills||[]),sk])
      }}/>}
      {editSkill&&<CollabSkillModal existing={editSkill} onClose={()=>setEditSkill(null)} onSave={updated=>{
        const _chId=updated._chId
        if(_chId) setChSkills(_chId,chSkills(_chId).map(x=>(x.id===updated.id||x.name===updated.name)?updated:x))
        else patch('skills',(c.skills||[]).map(x=>(x.id===updated.id||x.name===updated.name)?updated:x))
      }}/>}
    </Overlay>
  )
}

// ── CHARACTERS TAB IN SESSION ─────────────────────────────────────────────────
function CharactersPanel({ sessionId, user, onBack, initChars, chapters }) {
  const [chars,setChars]=useState({})
  const [activeChar,setActiveChar]=useState(null)

  useEffect(()=>{
    if(!rtdb)return
    const r=ref(rtdb,'collab_sessions/'+sessionId+'/characters')
    const unsub=onValue(r,snap=>{ const val=snap.val(); setChars(val||{}) })
    return ()=>unsub()
  },[sessionId])

  if(activeChar) return <CharEditor sessionId={sessionId} char={activeChar} chapters={chapters||[]} user={user} onBack={()=>setActiveChar(null)}/>

  const charList=objToArr(chars)

  return (
    <Overlay zIndex={240}>
      <HeaderBar left={<BackBtn onClick={onBack}/>} center={<div style={{ fontFamily:'Cinzel,serif',fontSize:13,color:'var(--gold2)',letterSpacing:1 }}>⚔ CHARACTERS</div>}/>
      <div style={{ flex:1,overflowY:'auto',padding:'12px 16px' }}>
        {charList.length===0&&<div style={{ textAlign:'center',color:'var(--text3)',fontSize:13,padding:'40px 0' }}>No characters in this story yet.</div>}
        {charList.map(c=>{
          const stats=calcStats(c.level||1)
          const affClr=AFF_CLR[c.affinity]||'var(--gold)'
          const gradeClr=GRADE_CLR[c.grade]||'var(--text3)'
          return (
            <div key={c.id} onClick={()=>setActiveChar(c)}
              style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px',marginBottom:10,cursor:'pointer',transition:'all .2s',position:'relative',overflow:'hidden' }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(201,168,76,0.4)'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='' }}>
              <div style={{ position:'absolute',top:0,left:0,right:0,height:2,background:affClr,opacity:0.5 }}/>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontFamily:'Cinzel,serif',fontSize:13,color:'var(--gold2)' }}>{c.name||'Unnamed'}</div>
                  <div style={{ fontSize:10,color:'var(--text3)',marginTop:2 }}>{c.archetype||'?'} · Lv.{c.level||1} · <span style={{ color:gradeClr }}>{c.grade||'Beginner'}</span></div>
                  <div style={{ fontSize:9,color:affClr,marginTop:2 }}>{c.affinity||'None'}</div>
                </div>
                <div style={{ textAlign:'right',fontSize:10,color:'var(--text3)',fontFamily:'Cinzel,serif' }}>
                  <div>HP {stats.hp}</div>
                  <div>MP {stats.mana}</div>
                  {c.lastEditBy&&<div style={{ marginTop:4,fontSize:8 }}>✎ {c.lastEditBy}</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Overlay>
  )
}

// ── PART WRITER ──────────────────────────────────────────────────────────────
function PartWriter({ sessionId, chapterId, part, user, canEdit, onBack, members, onOpenChat }) {
  const [content,setContent]=useState(part.content||'')
  const [saving,setSaving]=useState(false)
  const timer=useRef(null)

  const save=async(val)=>{
    if(!rtdb)return
    setSaving(true)
    await update(ref(rtdb,'collab_sessions/'+sessionId+'/chapters/'+chapterId+'/parts/'+part.id),{content:val,lastEditBy:user.name,lastEditAt:Date.now()})
    setSaving(false)
  }

  return (
    <Overlay zIndex={260}>
      <HeaderBar
        left={<BackBtn onClick={onBack}/>}
        center={<div style={{ fontFamily:'Cinzel,serif',fontSize:12,color:'var(--gold2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{part.title}</div>}
        right={
          <>
            {saving&&<span style={{ fontSize:9,color:'var(--text3)',fontFamily:'Cinzel,serif' }}>saving...</span>}
            <IBtn onClick={onOpenChat}>💬</IBtn>
          </>
        }
      />
      <textarea value={content}
        onChange={e=>{ setContent(e.target.value); clearTimeout(timer.current); timer.current=setTimeout(()=>save(e.target.value),1000) }}
        disabled={!canEdit}
        placeholder={canEdit?'Write this part...':'Not assigned to you — read only.'}
        style={{ flex:1,background:'var(--bg)',border:'none',padding:'22px 18px',color:'var(--text)',fontFamily:'Crimson Pro,serif',fontSize:17,lineHeight:1.9,resize:'none',outline:'none',opacity:canEdit?1:0.5 }}/>
      <div style={{ padding:'5px 18px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--text3)',fontFamily:'Cinzel,serif' }}>
        <span>{content.trim()?content.trim().split(/\s+/).length:0} words</span>
        {part.lastEditBy&&<span>Last: {part.lastEditBy}</span>}
      </div>
    </Overlay>
  )
}

// ── CHAPTER VIEW ─────────────────────────────────────────────────────────────
function ChapterView({ sessionId, chapter, user, isOwner, onBack, members, onOpenChat }) {
  const [parts,setParts]=useState([])
  const [activePart,setActivePart]=useState(null)
  const [newPartTitle,setNewPartTitle]=useState('')
  const [showAddPart,setShowAddPart]=useState(false)

  useEffect(()=>{
    if(!rtdb)return
    const r=ref(rtdb,'collab_sessions/'+sessionId+'/chapters/'+chapter.id+'/parts')
    const unsub=onValue(r,snap=>{ const val=snap.val(); setParts(val?objToArr(val).sort((a,b)=>(a.order||0)-(b.order||0)):[]) })
    return ()=>unsub()
  },[sessionId,chapter.id])

  const canEdit=isOwner||chapter.assignedTo===user.id||chapter.assignedTo==='all'

  const addPart=async()=>{
    if(!newPartTitle.trim()||!rtdb)return
    const pId=uid()
    await set(ref(rtdb,'collab_sessions/'+sessionId+'/chapters/'+chapter.id+'/parts/'+pId),{id:pId,title:newPartTitle.trim(),content:'',order:parts.length,createdBy:user.name})
    setNewPartTitle(''); setShowAddPart(false)
  }

  if(activePart) return <PartWriter sessionId={sessionId} chapterId={chapter.id} part={activePart} user={user} canEdit={canEdit} onBack={()=>setActivePart(null)} members={members} onOpenChat={onOpenChat}/>

  return (
    <Overlay zIndex={230}>
      <HeaderBar
        left={<BackBtn onClick={onBack}/>}
        center={<div style={{ fontFamily:'Cinzel,serif',fontSize:13,color:'var(--gold2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{chapter.title}</div>}
        right={<IBtn onClick={onOpenChat}>💬</IBtn>}
      />
      {!canEdit&&<div style={{ margin:'10px 14px',padding:'8px 12px',background:'rgba(193,18,31,0.1)',border:'1px solid rgba(193,18,31,0.3)',borderRadius:8,fontSize:11,color:'#ff6b6b',fontFamily:'Cinzel,serif' }}>⚠ Not assigned to you — read only.</div>}
      <div style={{ flex:1,overflowY:'auto',padding:'8px 14px 20px' }}>
        {parts.length===0&&<div style={{ textAlign:'center',color:'var(--text3)',fontSize:13,padding:'30px 0' }}>No parts yet.{(isOwner||canEdit)?' Add one below!':''}</div>}
        {parts.map(p=>(
          <div key={p.id} onClick={()=>setActivePart(p)}
            style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:10,padding:'13px 15px',marginBottom:9,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8,transition:'all .2s' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(201,168,76,0.4)'; e.currentTarget.style.transform='translateY(-2px)' }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='' }}>
            <div>
              <div style={{ fontFamily:'Cinzel,serif',fontSize:12,color:'var(--gold2)' }}>{p.title}</div>
              <div style={{ fontSize:10,color:'var(--text3)',marginTop:2 }}>{p.content?.split(/\s+/).filter(Boolean).length||0} words{p.lastEditBy&&' · '+p.lastEditBy}</div>
            </div>
            <div style={{ color:'var(--gold2)',fontSize:16 }}>▶</div>
          </div>
        ))}
        {(isOwner||canEdit)&&(showAddPart?(
          <div style={{ display:'flex',gap:8,marginTop:8 }}>
            <input value={newPartTitle} onChange={e=>setNewPartTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addPart()} placeholder="Part title..." className="form-input" style={{ flex:1 }} autoFocus/>
            <MBtn className="btn btn-gold btn-sm" onClick={addPart}>Add</MBtn>
            <MBtn className="btn btn-outline btn-sm" onClick={()=>setShowAddPart(false)}>✕</MBtn>
          </div>
        ):(
          <MBtn className="btn btn-outline btn-full" style={{ marginTop:10 }} onClick={()=>setShowAddPart(true)}>+ Add Part</MBtn>
        ))}
      </div>
    </Overlay>
  )
}

// ── SESSION VIEW ─────────────────────────────────────────────────────────────
function SessionView({ session, user, onBack, onSaveToLibrary, onDeleteSession }) {
  const [chapters,setChapters]=useState([])
  const [members,setMembers]=useState({})
  const [chars,setChars]=useState({})
  const [activeChapter,setActiveChapter]=useState(null)
  const [showChat,setShowChat]=useState(false)
  const [showChars,setShowChars]=useState(false)
  const [notifications,setNotifications]=useState([])
  const [showAssign,setShowAssign]=useState(null)
  const [newChTitle,setNewChTitle]=useState('')
  const [showAddCh,setShowAddCh]=useState(false)
  const [saving,setSaving]=useState(false)
  const isOwner=session.ownerId===user.id

  useEffect(()=>{
    if(!rtdb)return
    const r=ref(rtdb,'collab_sessions/'+session.id+'/members/'+user.id)
    update(r,{id:user.id,name:user.name,online:true,lastSeen:Date.now()})
    const off=()=>update(r,{online:false,lastSeen:Date.now()})
    window.addEventListener('beforeunload',off)
    return ()=>{ off(); window.removeEventListener('beforeunload',off) }
  },[session.id])

  useEffect(()=>{ if(!rtdb)return; const r=ref(rtdb,'collab_sessions/'+session.id+'/chapters'); const u=onValue(r,s=>{ const v=s.val(); setChapters(v?objToArr(v).sort((a,b)=>(a.order||0)-(b.order||0)):[])}); return ()=>u() },[session.id])
  useEffect(()=>{ if(!rtdb)return; const r=ref(rtdb,'collab_sessions/'+session.id+'/members'); const u=onValue(r,s=>{ if(s.val())setMembers(s.val()) }); return ()=>u() },[session.id])
  useEffect(()=>{ if(!rtdb)return; const r=ref(rtdb,'collab_sessions/'+session.id+'/characters'); const u=onValue(r,s=>{ setChars(s.val()||{}) }); return ()=>u() },[session.id])
  useEffect(()=>{ if(!rtdb)return; const r=ref(rtdb,'collab_sessions/'+session.id+'/notifications'); const u=onValue(r,s=>{ const v=s.val(); setNotifications(v?objToArr(v).sort((a,b)=>b.ts-a.ts).slice(0,5):[])}); return ()=>u() },[session.id])

  const addChapter=async()=>{
    if(!newChTitle.trim()||!rtdb)return
    const cId=uid()
    await set(ref(rtdb,'collab_sessions/'+session.id+'/chapters/'+cId),{id:cId,title:newChTitle.trim(),parts:{},order:chapters.length,assignedTo:'all',createdBy:user.name})
    await push(ref(rtdb,'collab_sessions/'+session.id+'/notifications'),{text:user.name+' added chapter: '+newChTitle.trim(),ts:Date.now()})
    setNewChTitle(''); setShowAddCh(false)
  }

  const assignChapter=async(chId,memberId)=>{
    await update(ref(rtdb,'collab_sessions/'+session.id+'/chapters/'+chId),{assignedTo:memberId})
    setShowAssign(null)
  }

  const kickMember=async(memberId)=>{
    if(!window.confirm('Kick this member?'))return
    await remove(ref(rtdb,'collab_sessions/'+session.id+'/members/'+memberId))
    await push(ref(rtdb,'collab_sessions/'+session.id+'/notifications'),{text:'A member was removed.',ts:Date.now()})
  }

  const copyCode=()=>{ navigator.clipboard.writeText(session.code); alert('Invite code copied: '+session.code) }

  const handleSaveToLibrary=async()=>{
    setSaving(true)
    // Build chapters array from Firebase data
    const builtChapters=chapters.map(ch=>{
      const chParts=objToArr(ch.parts||{})
      return {
        id:ch.id, title:ch.title, completed:ch.completed||false, content:'',
        parts:chParts.map(p=>({id:p.id,title:p.title,content:p.content||''}))
      }
    })
    const builtChars=objToArr(chars)
    await onSaveToLibrary(session.storyId, builtChapters, builtChars)
    setSaving(false)
  }

  const handleDeleteSession=async()=>{
    if(!window.confirm('Delete this entire collab session? This cannot be undone.'))return
    await remove(ref(rtdb,'collab_sessions/'+session.id))
    onDeleteSession()
  }

  if(showChat) return <ChatPanel sessionId={session.id} user={user} members={members} onClose={()=>setShowChat(false)}/>
  if(showChars) return <CharactersPanel sessionId={session.id} user={user} onBack={()=>setShowChars(false)} initChars={chars} chapters={chapters}/>
  if(activeChapter) return <ChapterView sessionId={session.id} chapter={activeChapter} user={user} isOwner={isOwner} onBack={()=>setActiveChapter(null)} members={members} onOpenChat={()=>setShowChat(true)}/>

  return (
    <Overlay zIndex={200}>
      <HeaderBar
        left={<BackBtn onClick={onBack}/>}
        center={
          <div style={{ minWidth:0 }}>
            <div style={{ fontFamily:'Cinzel Decorative,serif',fontSize:12,color:'var(--gold2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{session.title}</div>
            <div style={{ fontSize:9,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:1,marginTop:1 }}>{isOwner?'OWNER':'COLLABORATOR'} · {Object.keys(members).length} members</div>
          </div>
        }
        right={
          <button onClick={copyCode} style={{ background:'rgba(201,168,76,0.1)',border:'1px solid rgba(201,168,76,0.25)',borderRadius:8,padding:'4px 10px',color:'var(--gold)',fontFamily:'Cinzel,serif',fontSize:9,cursor:'pointer',letterSpacing:2 }}>{session.code}</button>
        }
      />

      {/* Action toolbar */}
      <div style={{ display:'flex',gap:0,borderBottom:'1px solid var(--border)',background:'rgba(13,10,26,0.8)',flexShrink:0 }}>
        <ToolBtn icon="💬" label="Chat" onClick={()=>setShowChat(true)}/>
        <ToolBtn icon="⚔" label="Characters" onClick={()=>setShowChars(true)}/>
        {isOwner&&<ToolBtn icon={saving?'⟳':'💾'} label="Save to Library" onClick={handleSaveToLibrary} color='#4caf50'/>}
        {isOwner&&<ToolBtn icon="🗑" label="Delete Session" onClick={handleDeleteSession} color='#ff6b6b'/>}
      </div>

      <div style={{ flex:1,overflowY:'auto',padding:'8px 14px 20px' }}>
        {/* Members row with kick */}
        <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginTop:8,marginBottom:10 }}>
          {Object.values(members).map(m=>(
            <div key={m.id} style={{ display:'flex',alignItems:'center',gap:5,padding:'3px 8px',borderRadius:20,border:'1px solid '+(m.online?'rgba(76,175,80,0.3)':'var(--border)'),background:m.online?'rgba(76,175,80,0.06)':'var(--bg2)',fontSize:10,fontFamily:'Cinzel,serif',color:m.online?'#4caf50':'var(--text3)' }}>
              <div style={{ width:6,height:6,borderRadius:'50%',background:m.online?'#4caf50':'var(--text3)' }}/>
              {m.name}{m.id===session.ownerId?' 👑':''}
              {isOwner&&m.id!==user.id&&(
                <button onClick={()=>kickMember(m.id)} title="Kick member" style={{ background:'none',border:'none',color:'rgba(255,107,107,0.6)',cursor:'pointer',fontSize:10,padding:'0 2px',marginLeft:2 }}>✕</button>
              )}
            </div>
          ))}
        </div>

        {/* Activity */}
        {notifications.length>0&&(
          <div style={{ marginBottom:10,padding:'8px 12px',background:'rgba(201,168,76,0.05)',border:'1px solid rgba(201,168,76,0.15)',borderRadius:10 }}>
            <div style={{ fontSize:8,fontFamily:'Cinzel,serif',color:'var(--gold)',letterSpacing:2,marginBottom:5 }}>RECENT ACTIVITY</div>
            {notifications.map(n=><div key={n.id} style={{ fontSize:11,color:'var(--text2)',marginBottom:2 }}>✦ {n.text}</div>)}
          </div>
        )}

        {/* Owner save tip */}
        {isOwner&&(
          <div style={{ marginBottom:10,padding:'8px 12px',background:'rgba(76,175,80,0.05)',border:'1px solid rgba(76,175,80,0.15)',borderRadius:8,fontSize:11,color:'rgba(76,175,80,0.8)',fontFamily:'Cinzel,serif' }}>
            💾 Tap the save button in the header to sync all collab changes back to your Library story.
          </div>
        )}

        {/* Chapters */}
        <div style={{ fontSize:8,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:2,marginBottom:8 }}>CHAPTERS</div>
        {chapters.length===0&&<div style={{ textAlign:'center',color:'var(--text3)',fontSize:13,padding:'20px 0' }}>No chapters yet.{isOwner?' Add one below!':''}</div>}

        {chapters.map(ch=>{
          const assignedMember=ch.assignedTo&&ch.assignedTo!=='all'?members[ch.assignedTo]:null
          const canEdit=isOwner||ch.assignedTo===user.id||ch.assignedTo==='all'
          const partCount=ch.parts?(Array.isArray(ch.parts)?ch.parts.length:Object.keys(ch.parts).length):0
          return (
            <div key={ch.id} style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px',marginBottom:9,position:'relative' }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8 }}>
                <div style={{ flex:1,cursor:'pointer' }} onClick={()=>setActiveChapter(ch)}>
                  <div style={{ fontFamily:'Cinzel,serif',fontSize:12,color:'var(--gold2)' }}>{ch.title}</div>
                  <div style={{ fontSize:10,color:'var(--text3)',marginTop:2 }}>
                    {partCount} parts · {assignedMember?'→ '+assignedMember.name:'Open to all'}
                    {!canEdit&&' · Read only'}
                  </div>
                </div>
                <div style={{ display:'flex',gap:5,alignItems:'center',flexShrink:0 }}>
                  {isOwner&&<button onClick={()=>setShowAssign(showAssign===ch.id?null:ch.id)} style={{ fontSize:9,fontFamily:'Cinzel,serif',background:'rgba(201,168,76,0.1)',border:'1px solid rgba(201,168,76,0.25)',borderRadius:8,padding:'3px 8px',color:'var(--gold)',cursor:'pointer' }}>Assign</button>}
                  <div onClick={()=>setActiveChapter(ch)} style={{ fontSize:18,color:canEdit?'var(--gold2)':'var(--text3)',cursor:'pointer' }}>▶</div>
                </div>
              </div>

              {showAssign===ch.id&&isOwner&&(
                <div style={{ marginTop:8,padding:'8px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8 }}>
                  <div style={{ fontSize:8,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:1,marginBottom:5 }}>ASSIGN TO</div>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>
                    {[{id:'all',name:'All Members'},...Object.values(members)].map(m=>(
                      <div key={m.id} onClick={()=>assignChapter(ch.id,m.id)}
                        style={{ padding:'3px 10px',borderRadius:20,border:'1px solid '+(ch.assignedTo===m.id?'var(--gold)':'var(--border)'),background:ch.assignedTo===m.id?'rgba(201,168,76,0.1)':'transparent',color:ch.assignedTo===m.id?'var(--gold2)':'var(--text3)',fontSize:10,fontFamily:'Cinzel,serif',cursor:'pointer' }}>
                        {m.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {isOwner&&(showAddCh?(
          <div style={{ display:'flex',gap:8,marginBottom:14 }}>
            <input value={newChTitle} onChange={e=>setNewChTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addChapter()} placeholder="Chapter title..." className="form-input" style={{ flex:1 }} autoFocus/>
            <MBtn className="btn btn-gold btn-sm" onClick={addChapter}>Add</MBtn>
            <MBtn className="btn btn-outline btn-sm" onClick={()=>setShowAddCh(false)}>✕</MBtn>
          </div>
        ):(
          <MBtn className="btn btn-outline btn-full" style={{ marginBottom:14 }} onClick={()=>setShowAddCh(true)}>+ Add Chapter</MBtn>
        ))}
      </div>
    </Overlay>
  )
}

// ── MAIN COLLAB TAB ───────────────────────────────────────────────────────────
export default function CollabTab({ stories, online, onSaveToLibrary }) {
  const [user,setUser]=useState(()=>getUserProfile())
  const [sessions,setSessions]=useState([])
  const [activeSession,setActiveSession]=useState(null)
  const [showCreate,setShowCreate]=useState(false)
  const [showJoin,setShowJoin]=useState(false)
  const [joinCode,setJoinCode]=useState('')
  const [joinError,setJoinError]=useState('')
  const [selectedStory,setSelectedStory]=useState('')
  const [loading,setLoading]=useState(false)

  useEffect(()=>{
    if(!user||!rtdb)return
    const r=ref(rtdb,'collab_sessions')
    const unsub=onValue(r,snap=>{
      const val=snap.val()
      if(!val){setSessions([]);return}
      setSessions(objToArr(val).filter(s=>s.title&&s.code&&(s.ownerId===user.id||(s.members&&s.members[user.id]))))
    })
    return ()=>unsub()
  },[user])

  if(!user) return <SetupProfileModal onDone={p=>{ saveUserProfile(p); setUser(p) }}/>
  if(!online) return <div className="empty-state"><div className="empty-icon">📡</div><div className="empty-title">No Connection</div><div className="empty-desc">Collab requires internet connection.</div></div>

  if(activeSession) return (
    <SessionView
      session={activeSession} user={user}
      onBack={()=>setActiveSession(null)}
      onSaveToLibrary={onSaveToLibrary}
      onDeleteSession={()=>setActiveSession(null)}
    />
  )

  const createSession=async()=>{
    if(!selectedStory||!rtdb)return
    const story=stories.find(s=>s.id===selectedStory)
    if(!story)return
    setLoading(true)
    const sId=uid(), code=genCode()
    const chapters={}

    // Import existing characters into Firebase
    const characters={}
    ;(story.characters||[]).forEach(c=>{ characters[c.id]={...c} })

    ;(story.chapters||[]).forEach((ch,idx)=>{
      const parts={}
      ;(ch.parts||[]).forEach((p,pi)=>{ const pid=p.id||uid(); parts[pid]={id:pid,title:p.title,content:p.content||'',order:pi} })
      // Auto-convert plain chapter content to a part
      if(Object.keys(parts).length===0&&ch.content){ const pid=uid(); parts[pid]={id:pid,title:'Content',content:ch.content,order:0} }
      const cid=ch.id||uid()
      chapters[cid]={id:cid,title:ch.title,parts,order:idx,assignedTo:'all'}
    })

    const sessionData={id:sId,title:story.title,genre:story.genre,code,ownerId:user.id,ownerName:user.name,storyId:story.id,createdAt:Date.now(),members:{[user.id]:{id:user.id,name:user.name,online:true,role:'owner'}},chapters,characters}
    await set(ref(rtdb,'collab_sessions/'+sId),sessionData)
    setLoading(false); setShowCreate(false); setSelectedStory('')
    setActiveSession(sessionData)
  }

  const joinSession=async()=>{
    if(!joinCode.trim()||!rtdb)return
    setJoinError(''); setLoading(true)
    try {
      const snap=await get(ref(rtdb,'collab_sessions'))
      const val=snap.val()
      if(!val){setJoinError('Code not found.');setLoading(false);return}
      const found=objToArr(val).find(s=>s.code===joinCode.trim().toUpperCase())
      if(!found){setJoinError('Invalid code. Try again.');setLoading(false);return}
      await update(ref(rtdb,'collab_sessions/'+found.id+'/members/'+user.id),{id:user.id,name:user.name,online:true,role:'collaborator'})
      await push(ref(rtdb,'collab_sessions/'+found.id+'/notifications'),{text:user.name+' joined the story!',ts:Date.now()})
      setActiveSession(found); setShowJoin(false); setJoinCode('')
    } catch(e){setJoinError('Error joining. Try again.')}
    setLoading(false)
  }

  const publishedStories=stories.filter(s=>s.firebaseId)

  return (
    <div className="screen-fade" style={{ paddingBottom:80 }}>
      {/* Profile card */}
      <div style={{ margin:'14px 16px',padding:'12px 14px',background:'var(--panel)',border:'1px solid var(--border)',borderRadius:12,display:'flex',alignItems:'center',gap:10 }}>
        <div style={{ width:42,height:42,borderRadius:'50%',background:'radial-gradient(circle,#9b3dab,#2d1550)',border:'2px solid var(--gold)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontFamily:'Cinzel,serif',color:'var(--gold2)',flexShrink:0 }}>{user.name[0].toUpperCase()}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'Cinzel,serif',fontSize:13,color:'var(--gold2)' }}>{user.name}</div>
          <div style={{ fontSize:9,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:1,marginTop:1 }}>{user.id}</div>
        </div>
        <button onClick={()=>{ if(window.confirm('Reset your writer name?')){localStorage.removeItem('evo_user_profile');setUser(null)} }} style={{ fontSize:9,fontFamily:'Cinzel,serif',color:'var(--text3)',background:'none',border:'1px solid var(--border)',borderRadius:8,padding:'4px 8px',cursor:'pointer' }}>Edit</button>
      </div>

      {/* Action cards */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'0 16px 14px' }}>
        <div onClick={()=>setShowCreate(true)} style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:12,padding:'16px',cursor:'pointer',transition:'all .2s',textAlign:'center' }} onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(201,168,76,0.4)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
          <div style={{ fontSize:24,marginBottom:5 }}>⚔</div>
          <div style={{ fontFamily:'Cinzel,serif',fontSize:10,color:'var(--gold2)',letterSpacing:1 }}>Start Session</div>
          <div style={{ fontSize:9,color:'var(--text3)',marginTop:2 }}>From published stories</div>
        </div>
        <div onClick={()=>setShowJoin(true)} style={{ background:'var(--panel)',border:'1px solid var(--border)',borderRadius:12,padding:'16px',cursor:'pointer',transition:'all .2s',textAlign:'center' }} onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(0,212,255,0.4)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
          <div style={{ fontSize:24,marginBottom:5 }}>🔗</div>
          <div style={{ fontFamily:'Cinzel,serif',fontSize:10,color:'var(--cyan)',letterSpacing:1 }}>Join Session</div>
          <div style={{ fontSize:9,color:'var(--text3)',marginTop:2 }}>Enter invite code</div>
        </div>
      </div>

      {/* Sessions list */}
      {sessions.length>0&&(
        <>
          <div style={{ padding:'0 16px',fontSize:8,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:2,marginBottom:7 }}>YOUR SESSIONS</div>
          {sessions.map(s=>(
            <div key={s.id} onClick={()=>setActiveSession(s)} style={{ margin:'0 16px 9px',background:'var(--panel)',border:'1px solid var(--border)',borderRadius:12,padding:'12px 14px',cursor:'pointer',transition:'all .2s',position:'relative',overflow:'hidden' }} onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(201,168,76,0.4)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <div style={{ position:'absolute',top:0,left:'15%',right:'15%',height:1,background:'linear-gradient(90deg,transparent,var(--gold),transparent)' }}/>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <div>
                  <div style={{ fontFamily:'Cinzel,serif',fontSize:12,color:'var(--gold2)' }}>{s.title}</div>
                  <div style={{ fontSize:9,color:'var(--text3)',marginTop:2,fontFamily:'Cinzel,serif' }}>{s.ownerId===user.id?'Owner':'Collaborator'} · {Object.keys(s.members||{}).length} members · {s.code}</div>
                </div>
                <div style={{ fontSize:18,color:'var(--gold2)' }}>▶</div>
              </div>
            </div>
          ))}
        </>
      )}

      {sessions.length===0&&!showCreate&&!showJoin&&(
        <div className="empty-state"><div className="empty-icon">🤝</div><div className="empty-title">No Sessions Yet</div><div className="empty-desc">Start a collab from your published story or join with a code.</div></div>
      )}

      {/* Create modal */}
      {showCreate&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowCreate(false)}>
          <div className="modal">
            <div className="modal-drag"/>
            <div className="modal-title">⚔ Start Collab Session</div>
            <p style={{ fontSize:13,color:'var(--text2)',marginBottom:12,lineHeight:1.6 }}>Select a published story. Chapters and characters will be imported.</p>
            {publishedStories.length===0?(
              <div style={{ textAlign:'center',color:'var(--text3)',fontSize:13,padding:'16px 0' }}>No published stories yet. Publish one from Library first.</div>
            ):(
              <>
                <div className="form-group">
                  <label className="form-label">Select Story</label>
                  {publishedStories.map(s=>(
                    <div key={s.id} onClick={()=>setSelectedStory(s.id)} style={{ background:selectedStory===s.id?'rgba(201,168,76,0.08)':'var(--bg2)',border:'1px solid '+(selectedStory===s.id?'var(--gold)':'var(--border)'),borderRadius:8,padding:'9px 12px',marginBottom:7,cursor:'pointer' }}>
                      <div style={{ fontFamily:'Cinzel,serif',fontSize:12,color:selectedStory===s.id?'var(--gold2)':'var(--text)' }}>{s.title}</div>
                      <div style={{ fontSize:10,color:'var(--text3)',marginTop:2 }}>{s.genre} · {s.chapters?.length||0} ch · {s.characters?.length||0} chars</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex',gap:8 }}>
                  <MBtn className="btn btn-outline" onClick={()=>setShowCreate(false)}>Cancel</MBtn>
                  <MBtn className="btn btn-gold" style={{ flex:1 }} disabled={!selectedStory||loading} onClick={createSession}>{loading?'⟳ Creating...':'Create Session ✦'}</MBtn>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Join modal */}
      {showJoin&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowJoin(false)}>
          <div className="modal">
            <div className="modal-drag"/>
            <div className="modal-title">🔗 Join Collab Session</div>
            <p style={{ fontSize:13,color:'var(--text2)',marginBottom:12 }}>Enter the invite code shared by the story owner.</p>
            <div className="form-group">
              <label className="form-label">Invite Code</label>
              <input className="form-input" placeholder="EVO-XXX" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&joinSession()} autoFocus style={{ textTransform:'uppercase',letterSpacing:3,fontFamily:'Cinzel,serif',textAlign:'center',fontSize:18 }}/>
              {joinError&&<div style={{ fontSize:11,color:'#ff6b6b',marginTop:5,fontFamily:'Cinzel,serif' }}>{joinError}</div>}
            </div>
            <div style={{ display:'flex',gap:8 }}>
              <MBtn className="btn btn-outline" onClick={()=>{ setShowJoin(false); setJoinCode(''); setJoinError('') }}>Cancel</MBtn>
              <MBtn className="btn btn-gold" style={{ flex:1 }} disabled={!joinCode.trim()||loading} onClick={joinSession}>{loading?'⟳ Joining...':'Join Session ✦'}</MBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
