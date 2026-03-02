import { useState, useEffect, useRef } from 'react'
import { collection, addDoc, getDocs, orderBy, query, where, updateDoc, doc } from 'firebase/firestore'
import { db } from './firebase.js'
import { uid, LS } from './utils.js'
import { ARCHETYPES, AFFINITIES, SPECIAL_AFFs, ALL_ELEMENTS, GRADES, ROLES, GENRES, AFF_CLR, GRADE_CLR, calcStats, getTierName } from './constants.js'
import CharacterGallery from './CharacterGallery.jsx'
import CollabTab from './Collab.jsx'

// ── CLICK SPARKS ───────────────────────────────────────────────────────────
function useClickSpark() {
  useEffect(() => {
    const handler = (e) => {
      for (let i = 0; i < 8; i++) {
        const spark = document.createElement('div')
        spark.className = 'spark'
        const angle = (i / 8) * 360
        const dist = 28 + Math.random() * 18
        const tx = Math.cos(angle * Math.PI / 180) * dist
        const ty = Math.sin(angle * Math.PI / 180) * dist
        spark.style.left = e.clientX + 'px'
        spark.style.top = e.clientY + 'px'
        spark.style.setProperty('--tx', tx + 'px')
        spark.style.setProperty('--ty', ty + 'px')
        document.body.appendChild(spark)
        setTimeout(() => spark.remove(), 500)
      }
    }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [])
}

// ── MAGNET BUTTON ──────────────────────────────────────────────────────────
function MagnetBtn({ children, className, onClick, disabled, style, type }) {
  const ref = useRef(null)
  const handleMove = (e) => {
    if (!ref.current || disabled) return
    const rect = ref.current.getBoundingClientRect()
    const dx = (e.clientX - rect.left - rect.width / 2) * 0.3
    const dy = (e.clientY - rect.top - rect.height / 2) * 0.3
    ref.current.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'
  }
  const handleLeave = () => {
    if (!ref.current) return
    ref.current.style.transition = 'transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)'
    ref.current.style.transform = 'translate(0,0)'
    setTimeout(() => { if (ref.current) ref.current.style.transition = '' }, 500)
  }
  return (
    <button ref={ref} type={type} className={'magnet-btn ' + className} onClick={onClick}
      disabled={disabled} style={style} onMouseMove={handleMove} onMouseLeave={handleLeave}>
      {children}
    </button>
  )
}

// ── ANTI-GRAVITY CARD ──────────────────────────────────────────────────────
function AntiCard({ children, className, onClick, style }) {
  const ref = useRef(null)
  const handleMove = (e) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const dx = (e.clientX - rect.left - rect.width / 2) / rect.width * 10
    const dy = (e.clientY - rect.top - rect.height / 2) / rect.height * 10
    ref.current.style.transform = 'perspective(600px) rotateX(' + (-dy) + 'deg) rotateY(' + dx + 'deg) translateY(-3px) scale(1.01)'
    ref.current.style.boxShadow = (-dx) + 'px ' + (-dy) + 'px 25px rgba(201,168,76,0.13),0 10px 35px rgba(0,0,0,0.5)'
  }
  const handleLeave = () => {
    if (!ref.current) return
    ref.current.style.transition = 'all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)'
    ref.current.style.transform = ''
    ref.current.style.boxShadow = ''
    setTimeout(() => { if (ref.current) ref.current.style.transition = '' }, 400)
  }
  return (
    <div ref={ref} className={className} onClick={onClick} style={{ ...style, transition: 'all 0.1s ease' }}
      onMouseMove={handleMove} onMouseLeave={handleLeave}>{children}</div>
  )
}

// ── RUNE FIELD ─────────────────────────────────────────────────────────────
const RUNES = ['᚛','᚜','ᚐ','ᚑ','✦','✧','⚔','⚡','◈','⬡','△','▽','◇','✵','⊕','⊗','❋','✺']
function RuneField() {
  const runes = useRef([])
  if (!runes.current.length)
    runes.current = Array.from({ length: 16 }, (_, i) => ({
      id: i, char: RUNES[i % RUNES.length],
      left: Math.random() * 100, size: 10 + Math.random() * 14,
      duration: 14 + Math.random() * 20, delay: -(Math.random() * 20),
    }))
  return (
    <div className="rune-field">
      {runes.current.map(r => (
        <div key={r.id} className="rune" style={{ left: r.left + '%', fontSize: r.size + 'px', animationDuration: r.duration + 's', animationDelay: r.delay + 's' }}>{r.char}</div>
      ))}
    </div>
  )
}

// ── COUNT UP ───────────────────────────────────────────────────────────────
function CountUp({ value }) {
  const [d, setD] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    const target = parseInt(value) || 0
    const start = performance.now(), dur = 900
    const step = (now) => {
      const t = Math.min((now - start) / dur, 1)
      setD(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [value])
  return d.toLocaleString()
}

// ── TOAST ──────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t) }, [])
  return <div className="toast">✦ {msg}</div>
}

function ConfirmModal({ msg, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-drag" />
        <div className="modal-title">⚠ Confirm Delete</div>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>{msg}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <MagnetBtn className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancel</MagnetBtn>
          <MagnetBtn className="btn btn-danger" style={{ flex: 1 }} onClick={onConfirm}>Delete</MagnetBtn>
        </div>
      </div>
    </div>
  )
}

// ── SKILL TYPE COLORS ──────────────────────────────────────────────────────
const SKILL_TYPE_CLR = { Attack: '#ff4d4d', Buff: '#4caf50', Debuff: '#9b5de5' }

const SKILL_TYPE_FIELDS = {
  Attack: [['dmg','DMG'],['hpHeal','HP Heal'],['mpHeal','MP Regen']],
  Buff:   [['hpHeal','HP Heal'],['mpHeal','MP Regen'],['speedUp','Speed Up'],['atkBuff','ATK Buff'],['defBuff','DEF Buff']],
  Debuff: [['atkDebuff','ATK Debuff'],['defDebuff','DEF Debuff'],['dmg','DMG']],
}

// ── SKILL MODAL (add/edit) ─────────────────────────────────────────────────
function SkillModal({ existing, onClose, onSave }) {
  const blank = { name:'',type:'Attack',element:'Fire',level:1,description:'',dmg:0,hpHeal:0,mpHeal:0,speedUp:0,atkBuff:0,defBuff:0,atkDebuff:0,defDebuff:0 }
  const [f, sf] = useState(existing || blank)
  const set = (k, v) => sf(p => ({ ...p, [k]: v }))
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-drag" />
        <div className="modal-title">{existing ? '✏ Edit Skill' : '⚡ Add Skill'}</div>
        <div className="form-group"><label className="form-label">Skill Name</label><input className="form-input" placeholder="e.g. Flame Strike..." value={f.name} onChange={e => set('name', e.target.value)} autoFocus /></div>
        <div className="form-group">
          <label className="form-label">Type</label>
          <div className="radio-group">
            {['Attack','Buff','Debuff'].map(t => (
              <div key={t} className={'radio-btn ' + (f.type===t?'active':'')} style={f.type===t?{borderColor:SKILL_TYPE_CLR[t],color:SKILL_TYPE_CLR[t]}:{}} onClick={() => set('type', t)}>{t}</div>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Element</label>
          <div className="multi-select">{ALL_ELEMENTS.map(el => <div key={el} className={'multi-chip '+(f.element===el?'sel':'')} style={{color:AFF_CLR[el]}} onClick={() => set('element', el)}>{el}</div>)}</div>
        </div>
        <div className="form-group"><label className="form-label">Skill Level</label><input type="number" className="form-number" value={f.level} min={1} onChange={e => set('level', Math.max(1,+e.target.value))} /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" style={{minHeight:60}} placeholder="Describe what this skill does..." value={f.description} onChange={e => set('description', e.target.value)} /></div>
        <div className="form-group">
          <label className="form-label">Skill Stats</label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {(SKILL_TYPE_FIELDS[f.type]||[]).map(([key,label]) => (
              <div key={key}>
                <div style={{fontSize:9,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:1,marginBottom:4}}>{label}</div>
                <input type="number" className="form-number" value={f[key]||0} min={0} onChange={e => set(key, +e.target.value)} />
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <MagnetBtn className="btn btn-outline" onClick={onClose}>Cancel</MagnetBtn>
          <MagnetBtn className="btn btn-gold" style={{flex:1}} onClick={() => { if(!f.name.trim()) return; onSave({...f,id:f.id||uid()}); onClose() }}>{existing?'Save Changes':'Add Skill'}</MagnetBtn>
        </div>
      </div>
    </div>
  )
}

// ── READER CHARACTER DETAIL MODAL ──────────────────────────────────────────
function CharDetailModal({ char, onClose }) {
  const stats = char.stats || calcStats(char.level || 1)
  const gradeClr = GRADE_CLR[char.grade] || 'var(--gold)'
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{maxHeight:'95vh'}}>
        <div className="modal-drag" />
        <MagnetBtn className="btn btn-outline btn-sm" style={{marginBottom:12}} onClick={onClose}>← Back</MagnetBtn>
        <div style={{textAlign:'center',marginBottom:16}}>
          <div style={{width:80,height:80,borderRadius:'50%',margin:'0 auto 10px',background:'radial-gradient(circle,#9b3dab,#2d1550)',border:'2px solid '+gradeClr,display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,fontFamily:'Cinzel,serif',color:'var(--gold2)',boxShadow:'0 0 30px '+gradeClr+'40'}}>{(char.name||'?')[0].toUpperCase()}</div>
          <div style={{fontFamily:'Cinzel Decorative,serif',fontSize:18,color:'var(--gold2)'}}>{char.name}</div>
          <div style={{fontSize:11,color:'var(--text3)',fontFamily:'Cinzel,serif',letterSpacing:2,marginTop:3}}>{char.role} · {char.archetype}</div>
          <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:6,flexWrap:'wrap'}}>
            <span style={{fontSize:10,fontFamily:'Cinzel,serif',color:gradeClr,border:'1px solid '+gradeClr,padding:'2px 10px',borderRadius:20}}>{char.grade}</span>
            <span style={{fontSize:10,fontFamily:'Cinzel,serif',color:'var(--text3)',border:'1px solid var(--border)',padding:'2px 10px',borderRadius:20}}>Lv.{char.level||1} — {getTierName(char.level||1)}</span>
          </div>
        </div>
        {(char.affinities||[]).length>0 && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:9,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:2,marginBottom:6}}>AFFINITIES</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {(char.affinities||[]).map(a => <span key={a} style={{fontSize:10,padding:'3px 10px',borderRadius:20,border:'1px solid '+(AFF_CLR[a]||'var(--gold)'),color:AFF_CLR[a]||'var(--gold)',background:(AFF_CLR[a]||'#c9a84c')+'15',fontFamily:'Cinzel,serif'}}>{a}</span>)}
            </div>
          </div>
        )}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:12,marginBottom:14}}>
          <div style={{fontSize:9,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:2,marginBottom:10}}>CORE STATS</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
            {[['HP',stats.hp],['Mana',stats.mana],['Speed',stats.speed]].map(([k,v]) => (
              <div key={k} style={{textAlign:'center'}}>
                <div style={{fontSize:8,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:1}}>{k}</div>
                <div style={{fontSize:16,fontFamily:'Cinzel,serif',color:'var(--gold2)',fontWeight:700}}>{(parseInt(v)||0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
        {(char.skills||[]).length>0 && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:9,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:2,marginBottom:8}}>SKILLS</div>
            {(char.skills||[]).map(sk => {
              const tc = SKILL_TYPE_CLR[sk.type]||'var(--gold)'
              const ec = AFF_CLR[sk.element]||'var(--gold)'
              return (
                <div key={sk.id} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',marginBottom:8,borderLeft:'3px solid '+ec}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4,flexWrap:'wrap',gap:4}}>
                    <div style={{fontFamily:'Cinzel,serif',fontSize:12,color:'var(--text)'}}>{sk.name}</div>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                      <span style={{fontSize:9,padding:'1px 7px',borderRadius:10,border:'1px solid '+tc,color:tc,fontFamily:'Cinzel,serif'}}>{sk.type}</span>
                      <span style={{fontSize:9,padding:'1px 7px',borderRadius:10,border:'1px solid '+ec,color:ec,fontFamily:'Cinzel,serif'}}>{sk.element} Lv.{sk.level}</span>
                    </div>
                  </div>
                  {sk.description && <div style={{fontSize:12,color:'var(--text3)',fontStyle:'italic',marginBottom:6,lineHeight:1.5}}>{sk.description}</div>}
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {[['DMG',sk.dmg],['HP Heal',sk.hpHeal],['MP Regen',sk.mpHeal],['SPD Up',sk.speedUp],['ATK Buff',sk.atkBuff],['DEF Buff',sk.defBuff],['ATK Debuff',sk.atkDebuff],['DEF Debuff',sk.defDebuff]].filter(([,v]) => v && parseInt(v)>0).map(([label,val]) => (
                      <div key={label} style={{textAlign:'center',background:'rgba(0,0,0,0.3)',padding:'3px 8px',borderRadius:6,border:'1px solid var(--border)'}}>
                        <div style={{fontSize:7,fontFamily:'Cinzel,serif',color:'var(--text3)'}}>{label}</div>
                        <div style={{fontSize:11,fontFamily:'Cinzel,serif',color:'var(--gold2)',fontWeight:700}}>{parseInt(val).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {char.lore && (
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:14}}>
            <div style={{fontSize:9,fontFamily:'Cinzel,serif',color:'var(--text3)',letterSpacing:2,marginBottom:8}}>BACKSTORY</div>
            <p style={{fontFamily:'Crimson Pro,serif',fontSize:15,color:'var(--text2)',lineHeight:1.8}}>{char.lore}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── STORY MODALS ───────────────────────────────────────────────────────────
function NewStoryModal({ onClose, onCreate }) {
  const [f, sf] = useState({ title:'',genre:'Fantasy',description:'',type:'chapters' })
  const set = (k,v) => sf(p => ({...p,[k]:v}))
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-drag" /><div className="modal-title">✦ New Story</div>
        <div className="form-group"><label className="form-label">Title</label><input className="form-input" placeholder="Name your legend..." value={f.title} onChange={e => set('title',e.target.value)} autoFocus /></div>
        <div className="form-group"><label className="form-label">Genre</label><select className="form-select" value={f.genre} onChange={e => set('genre',e.target.value)}>{GENRES.map(g => <option key={g}>{g}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Structure</label>
          <div className="radio-group">
            <div className={'radio-btn '+(f.type==='chapters'?'active':'')} onClick={() => set('type','chapters')}>⚔ Chapters & Parts</div>
            <div className={'radio-btn '+(f.type==='plain'?'active':'')} onClick={() => set('type','plain')}>📜 Plain</div>
          </div>
        </div>
        <div className="form-group"><label className="form-label">Synopsis</label><textarea className="form-textarea" placeholder="In a world where..." value={f.description} onChange={e => set('description',e.target.value)} /></div>
        <div style={{display:'flex',gap:10}}>
          <MagnetBtn className="btn btn-outline" onClick={onClose}>Cancel</MagnetBtn>
          <MagnetBtn className="btn btn-gold" style={{flex:1}} onClick={() => { if(!f.title.trim()) return; onCreate(f); onClose() }}>Create Story</MagnetBtn>
        </div>
      </div>
    </div>
  )
}

function NewChapterModal({ onClose, onCreate }) {
  const [t, st] = useState('')
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal"><div className="modal-drag" /><div className="modal-title">⚔ New Chapter</div>
        <div className="form-group"><label className="form-label">Title</label><input className="form-input" placeholder="The Awakening..." value={t} onChange={e => st(e.target.value)} autoFocus /></div>
        <div style={{display:'flex',gap:10}}>
          <MagnetBtn className="btn btn-outline" onClick={onClose}>Cancel</MagnetBtn>
          <MagnetBtn className="btn btn-gold" style={{flex:1}} onClick={() => { if(!t.trim()) return; onCreate(t); onClose() }}>Add Chapter</MagnetBtn>
        </div>
      </div>
    </div>
  )
}

function NewPartModal({ onClose, onCreate }) {
  const [t, st] = useState('')
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal"><div className="modal-drag" /><div className="modal-title">✦ New Part</div>
        <div className="form-group"><label className="form-label">Title</label><input className="form-input" placeholder="Part title..." value={t} onChange={e => st(e.target.value)} autoFocus /></div>
        <div style={{display:'flex',gap:10}}>
          <MagnetBtn className="btn btn-outline" onClick={onClose}>Cancel</MagnetBtn>
          <MagnetBtn className="btn btn-gold" style={{flex:1}} onClick={() => { if(!t.trim()) return; onCreate(t); onClose() }}>Add Part</MagnetBtn>
        </div>
      </div>
    </div>
  )
}

// ── NEW CHARACTER MODAL ────────────────────────────────────────────────────
function NewCharModal({ onClose, onCreate }) {
  const [f, sf] = useState({ name:'',role:'Protagonist',archetype:'Warrior',affinities:[],grade:'Beginner',level:1,lore:'',skills:[] })
  const [showSkill, setShowSkill] = useState(false)
  const set = (k,v) => sf(p => ({...p,[k]:v}))
  const togAff = a => set('affinities', f.affinities.includes(a) ? f.affinities.filter(x=>x!==a) : [...f.affinities,a])
  const autoStats = calcStats(f.level)
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-drag" /><div className="modal-title">⚔ New Character</div>
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" placeholder="Character name..." value={f.name} onChange={e => set('name',e.target.value)} autoFocus /></div>
        <div className="form-group"><label className="form-label">Role</label><div className="radio-group">{ROLES.map(r => <div key={r} className={'radio-btn '+(f.role===r?'active':'')} onClick={() => set('role',r)}>{r}</div>)}</div></div>
        <div className="form-group"><label className="form-label">Archetype</label><select className="form-select" value={f.archetype} onChange={e => set('archetype',e.target.value)}>{ARCHETYPES.map(a => <option key={a}>{a}</option>)}</select></div>
        <div className="form-group">
          <label className="form-label">Affinities</label>
          <div className="multi-select">{AFFINITIES.map(a => <div key={a} className={'multi-chip '+(f.affinities.includes(a)?'sel':'')} style={{color:AFF_CLR[a]}} onClick={() => togAff(a)}>{a}</div>)}</div>
          <div style={{fontSize:10,color:'var(--text3)',fontFamily:'Cinzel,serif',letterSpacing:2,margin:'8px 0 5px'}}>SPECIAL</div>
          <div className="multi-select">{SPECIAL_AFFs.map(a => <div key={a} className={'multi-chip '+(f.affinities.includes(a)?'sel':'')} style={{color:AFF_CLR[a]}} onClick={() => togAff(a)}>{a}</div>)}</div>
        </div>
        <div className="form-group">
          <label className="form-label">Grade / Rank</label>
          <div className="grade-grid">{GRADES.map(g => <div key={g} className={'grade-btn '+(f.grade===g?'active':'')} style={f.grade===g?{background:GRADE_CLR[g]||'var(--gold)',borderColor:GRADE_CLR[g]||'var(--gold)',color:'#fff',boxShadow:'0 0 12px '+(GRADE_CLR[g]||'var(--gold)')}:{}} onClick={() => set('grade',g)}>{g}</div>)}</div>
        </div>
        <div className="form-group">
          <label className="form-label">Level</label>
          <input type="number" className="form-number" value={f.level} min={1} max={100} onChange={e => set('level',Math.max(1,Math.min(100,+e.target.value)))} />
          <div className="tier-badge" style={{marginTop:8}}>⚔ {getTierName(f.level)}</div>
        </div>
        <div className="form-group">
          <label className="form-label">Core Stats — Auto by Level</label>
          <div className="stats-input-grid">
            {[['HP',autoStats.hp.toLocaleString()],['Mana',autoStats.mana.toLocaleString()],['Speed',autoStats.speed]].map(([k,v]) => (
              <div key={k}><div className="stat-label" style={{marginBottom:4}}>{k}</div><div className="stat-auto">{v}</div></div>
            ))}
            <div style={{display:'flex',alignItems:'center'}}><div className="atk-note">⚔ ATK via skills</div></div>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Skills</label>
          {f.skills.map((sk,i) => (
            <div key={sk.id} className="skill-item" style={{'--element-clr':AFF_CLR[sk.element]||'var(--gold)'}}>
              <div style={{flex:1}}>
                <div className="skill-name">{sk.name}</div>
                <div style={{display:'flex',gap:5,marginTop:3,flexWrap:'wrap'}}>
                  <span style={{fontSize:9,padding:'1px 6px',borderRadius:10,border:'1px solid '+(SKILL_TYPE_CLR[sk.type]||'var(--gold)'),color:SKILL_TYPE_CLR[sk.type]||'var(--gold)',fontFamily:'Cinzel,serif'}}>{sk.type}</span>
                  <span className="skill-element" style={{color:AFF_CLR[sk.element],borderColor:AFF_CLR[sk.element]}}>{sk.element}</span>
                  <span className="skill-lvl">Lv.{sk.level}</span>
                </div>
              </div>
              <button onClick={() => set('skills',f.skills.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:18,padding:'0 4px'}}>×</button>
            </div>
          ))}
          <MagnetBtn className="btn btn-outline btn-full" style={{marginTop:6}} onClick={() => setShowSkill(true)}>+ Add Skill</MagnetBtn>
        </div>
        <div className="form-group"><label className="form-label">Backstory / Lore</label><textarea className="form-textarea" style={{minHeight:70}} placeholder="Backstory..." value={f.lore} onChange={e => set('lore',e.target.value)} /></div>
        <div style={{display:'flex',gap:10}}>
          <MagnetBtn className="btn btn-outline" onClick={onClose}>Cancel</MagnetBtn>
          <MagnetBtn className="btn btn-gold" style={{flex:1}} onClick={() => { if(!f.name.trim()) return; const stats=calcStats(f.level); onCreate({...f,...stats}); onClose() }}>Create</MagnetBtn>
        </div>
      </div>
      {showSkill && <SkillModal onClose={() => setShowSkill(false)} onSave={sk => set('skills',[...f.skills,sk])} />}
    </div>
  )
}

// ── CHAPTER CHARACTER PROGRESS MODAL ──────────────────────────────────────
function CharProgressModal({ char, chapter, onClose, onSave }) {
  const existing = char.chapterStats?.[chapter.id]
  const [changed, setChanged] = useState(existing ? (existing.changed===false?'no':'yes') : null)
  const [level, setLevel] = useState(existing?.level || char.level || 1)
  const [grade, setGrade] = useState(existing?.grade || char.grade || 'Beginner')
  const [skills, setSkills] = useState(existing?.skills || char.skills || [])
  const [showSkill, setShowSkill] = useState(false)
  const [editSkill, setEditSkill] = useState(null)
  const autoStats = calcStats(level)

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-drag" />
        <div className="modal-title">{char.name} — {chapter.title}</div>
        <p style={{fontSize:12,color:'var(--text3)',marginBottom:14}}>Does this character change in this chapter?</p>
        <div className="radio-group" style={{marginBottom:16}}>
          <div className={'radio-btn '+(changed==='yes'?'active':'')} style={changed==='yes'?{borderColor:'var(--gold)',color:'var(--gold)'}:{}} onClick={() => setChanged('yes')}>✦ Yes — Update Stats</div>
          <div className={'radio-btn '+(changed==='no'?'active':'')} style={changed==='no'?{borderColor:'var(--text3)',color:'var(--text3)'}:{}} onClick={() => setChanged('no')}>✗ No — Skip</div>
        </div>
        {changed==='yes' && (
          <>
            <div className="form-group">
              <label className="form-label">Level</label>
              <input type="number" className="form-number" value={level} min={1} max={100} onChange={e => setLevel(Math.max(1,Math.min(100,+e.target.value)))} />
              <div className="tier-badge" style={{marginTop:6}}>⚔ {getTierName(level)}</div>
            </div>
            <div className="stats-input-grid" style={{marginBottom:14}}>
              {[['HP',autoStats.hp.toLocaleString()],['Mana',autoStats.mana.toLocaleString()],['Speed',autoStats.speed]].map(([k,v]) => (
                <div key={k}><div className="stat-label" style={{marginBottom:4}}>{k}</div><div className="stat-auto">{v}</div></div>
              ))}
              <div style={{display:'flex',alignItems:'center'}}><div className="atk-note">⚔ ATK via skills</div></div>
            </div>
            <div className="form-group">
              <label className="form-label">Grade / Rank</label>
              <div className="grade-grid">{GRADES.map(g => <div key={g} className={'grade-btn '+(grade===g?'active':'')} style={grade===g?{background:GRADE_CLR[g]||'var(--gold)',borderColor:GRADE_CLR[g]||'var(--gold)',color:'#fff'}:{}} onClick={() => setGrade(g)}>{g}</div>)}</div>
            </div>
            <div className="form-group">
              <label className="form-label">Skills</label>
              {skills.map(sk => (
                <div key={sk.id} className="skill-item" style={{'--element-clr':AFF_CLR[sk.element]||'var(--gold)'}}>
                  <div style={{flex:1}}>
                    <div className="skill-name">{sk.name}</div>
                    <div style={{display:'flex',gap:5,marginTop:3,flexWrap:'wrap'}}>
                      <span style={{fontSize:9,padding:'1px 6px',borderRadius:10,border:'1px solid '+(SKILL_TYPE_CLR[sk.type]||'var(--gold)'),color:SKILL_TYPE_CLR[sk.type]||'var(--gold)',fontFamily:'Cinzel,serif'}}>{sk.type}</span>
                      <span className="skill-element" style={{color:AFF_CLR[sk.element],borderColor:AFF_CLR[sk.element]}}>{sk.element}</span>
                      <span className="skill-lvl">Lv.{sk.level}</span>
                    </div>
                  </div>
                  <button onClick={() => setEditSkill(sk)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:13,padding:'0 4px'}}>✏</button>
                  <button onClick={() => setSkills(s => s.filter(x=>x.id!==sk.id))} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:18,padding:'0 4px'}}>×</button>
                </div>
              ))}
              <MagnetBtn className="btn btn-outline btn-full" style={{marginTop:6}} onClick={() => setShowSkill(true)}>+ Add Skill</MagnetBtn>
            </div>
          </>
        )}
        <div style={{display:'flex',gap:10,marginTop:8}}>
          <MagnetBtn className="btn btn-outline" onClick={onClose}>Cancel</MagnetBtn>
          <MagnetBtn className="btn btn-gold" style={{flex:1}} disabled={!changed}
            onClick={() => { onSave(chapter.id, changed==='yes' ? {level,grade,skills,changed:true,...calcStats(level)} : {changed:false}); onClose() }}>
            {changed==='yes'?'Save & Unlock ✦':changed==='no'?'Unlock Chapter ✦':'Choose an option'}
          </MagnetBtn>
        </div>
      </div>
      {showSkill && <SkillModal onClose={() => setShowSkill(false)} onSave={sk => setSkills(s=>[...s,sk])} />}
      {editSkill && <SkillModal existing={editSkill} onClose={() => setEditSkill(null)} onSave={updated => setSkills(s=>s.map(x=>x.id===updated.id?updated:x))} />}
    </div>
  )
}

function PublishModal({ stories, onClose, onPublish }) {
  const [sel, setSel] = useState(null)
  const [loading, setLoading] = useState(false)
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal"><div className="modal-drag" /><div className="modal-title">⚔ Publish to Online</div>
        <p style={{fontSize:13,color:'var(--text2)',marginBottom:12}}>Same story updates its existing entry — no duplicates.</p>
        {stories.map(s => (
          <div key={s.id} className="ch-item" style={sel===s.id?{borderColor:'var(--gold)',background:'rgba(201,168,76,.08)'}:{}} onClick={() => setSel(s.id)}>
            <div style={{fontFamily:'Cinzel,serif',fontSize:13,color:sel===s.id?'var(--gold2)':'var(--text)'}}>{s.title}</div>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>{s.genre} · {s.chapters?.length||0} ch{s.firebaseId&&<span style={{color:'var(--gold)',marginLeft:8}}>● Published</span>}</div>
          </div>
        ))}
        <div style={{display:'flex',gap:10,marginTop:16}}>
          <MagnetBtn className="btn btn-outline" onClick={onClose}>Cancel</MagnetBtn>
          <MagnetBtn className="btn btn-gold" style={{flex:1}} disabled={!sel||loading} onClick={async()=>{setLoading(true);await onPublish(sel);setLoading(false)}}>{loading?'⟳ Publishing...':'Publish ✦'}</MagnetBtn>
        </div>
      </div>
    </div>
  )
}

// ── PLAIN EDITOR ───────────────────────────────────────────────────────────
function PlainEditor({ value, onChange }) {
  const [v, sv] = useState(value)
  const timer = useRef(null)
  return (
    <>
      <textarea className="editor-area" placeholder="Begin your tale..." value={v} onChange={e => { sv(e.target.value); clearTimeout(timer.current); timer.current = setTimeout(()=>onChange(e.target.value),900) }} style={{minHeight:360}} />
      <div style={{fontSize:11,color:'var(--text3)',textAlign:'right',padding:'4px 20px 0',fontFamily:'Cinzel,serif'}}>{v.trim()?v.trim().split(/\s+/).length:0} words</div>
    </>
  )
}

// ── STORY LIST ─────────────────────────────────────────────────────────────
function StoryList({ stories, onOpen }) {
  return (
    <div className="screen-fade">
      <div className="screen-header"><h2>Your Library</h2></div>
      {stories.length===0 ? (
        <div className="empty-state"><div className="empty-icon">📜</div><div className="empty-title">No Stories Yet</div><div className="empty-desc">Tap ✦ to forge your first tale.</div></div>
      ) : stories.map(s => (
        <AntiCard key={s.id} className="card story-card stagger-item" onClick={() => onOpen(s)}>
          <div className="card-title">{s.title}</div>
          <div className="card-sub">{s.genre}</div>
          <span className={'type-badge '+(s.type==='chapters'?'b-chapters':'b-plain')}>{s.type==='chapters'?'⚔ '+(s.chapters?.length||0)+' Chapters':'📜 Plain'}</span>
          {s.firebaseId && <span style={{fontSize:9,color:'var(--gold)',fontFamily:'Cinzel,serif',marginLeft:8}}>● LIVE</span>}
          {s.type==='chapters'&&s.chapters?.length>0&&<div className="prog-bar"><div className="prog-fill" style={{width:(s.chapters.filter(c=>c.completed).length/s.chapters.length*100)+'%'}}/></div>}
          <div className="card-body" style={{fontSize:13}}>{(s.description||'').slice(0,100)}{s.description?.length>100?'...':''}</div>
        </AntiCard>
      ))}
    </div>
  )
}

// ── STORY SCREEN ───────────────────────────────────────────────────────────
function StoryScreen({ story, onBack, onChapter, onChar, onEdit, setModal, setDelTarget, onDeleteStory }) {
  const [editDesc, setEditDesc] = useState(false)
  const [desc, setDesc] = useState(story.description||'')
  const [charProgress, setCharProgress] = useState(null)

  const allCharsConfirmed = (chapter) => {
    const chars = story.characters||[]
    if (!chars.length) return true
    return chars.every(c => c.chapterStats?.[chapter.id] !== undefined)
  }

  return (
    <div className="screen-enter">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>{story.title}</h2>
        <MagnetBtn className="btn btn-sm btn-danger" onClick={() => { setDelTarget({label:story.title,fn:onDeleteStory}); setModal('confirm') }}>🗑</MagnetBtn>
      </div>
      <AntiCard className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div className="card-title">Synopsis</div>
          <MagnetBtn className="btn btn-outline btn-sm" onClick={() => { if(editDesc) onEdit({description:desc}); setEditDesc(!editDesc) }}>{editDesc?'Save':'Edit'}</MagnetBtn>
        </div>
        {editDesc ? <textarea className="form-textarea" style={{marginTop:10}} value={desc} onChange={e => setDesc(e.target.value)} /> : <div className="card-body">{story.description||<span style={{color:'var(--text3)'}}>No synopsis yet...</span>}</div>}
      </AntiCard>

      <div className="section-label">Characters</div>
      {(story.characters||[]).map(c => (
        <AntiCard key={c.id} className="card char-card stagger-item" onClick={() => onChar(c)}>
          <div className="char-row">
            <div className="char-avatar">{(c.name||'?')[0].toUpperCase()}</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="card-title">{c.name}</div>
              <div className="card-sub">{c.role} · {c.archetype}</div>
              <div className="char-badges">
                {(c.affinities||[]).map(a => <span key={a} className="badge" style={{color:AFF_CLR[a],borderColor:AFF_CLR[a]}}>{a}</span>)}
                {c.grade&&<span className="badge" style={{color:GRADE_CLR[c.grade]||'var(--gold)',borderColor:GRADE_CLR[c.grade]||'var(--gold)'}}>{c.grade}</span>}
              </div>
            </div>
          </div>
        </AntiCard>
      ))}
      <div style={{padding:'0 20px 10px'}}><MagnetBtn className="btn btn-outline btn-full" onClick={() => setModal('newChar')}>+ Add Character</MagnetBtn></div>

      {story.type==='chapters' ? (
        <>
          <div className="section-label">Chapters</div>
          {(story.chapters||[]).map((ch, idx) => {
            const locked = idx>0 && !story.chapters[idx-1]?.completed
            const charsOk = allCharsConfirmed(ch)
            const chars = story.characters||[]
            return (
              <div key={ch.id} className={'ch-item stagger-item'+(locked?' locked-ch':'')} style={{margin:'0 20px 8px',position:'relative'}}>
                {locked&&<><div className="fog-particles"/><div className="fog-overlay"><div className="fog-icon">🌫</div><div className="fog-text">Complete previous chapter first</div></div></>}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div style={{flex:1,cursor:locked||!charsOk?'not-allowed':'pointer'}} onClick={() => !locked&&charsOk&&onChapter(ch)}>
                    <div style={{fontFamily:'Cinzel,serif',fontSize:9,color:'var(--text3)',letterSpacing:2}}>Chapter {idx+1}</div>
                    <div style={{fontFamily:'Cinzel,serif',fontSize:13,color:locked?'var(--text3)':'var(--gold2)',marginTop:2}}>{ch.title}</div>
                    <div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>{ch.parts?.length||0} parts · {ch.completed?'✦ Complete':charsOk?'Ready to write':'Awaiting character updates'}</div>
                  </div>
                  <div style={{fontSize:20,color:locked?'var(--text3)':ch.completed?'var(--gold2)':'var(--text2)'}}>{locked?'🔒':ch.completed?'✦':'▶'}</div>
                </div>
                {!locked&&chars.length>0&&(
                  <div style={{marginTop:10,display:'flex',flexWrap:'wrap',gap:6}}>
                    {chars.map(c => {
                      const done = c.chapterStats?.[ch.id] !== undefined
                      return (
                        <div key={c.id} onClick={() => setCharProgress({char:c,chapter:ch})}
                          style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,border:'1px solid '+(done?'rgba(201,168,76,0.4)':'var(--border)'),background:done?'rgba(201,168,76,0.06)':'var(--bg2)',cursor:'pointer',fontSize:10,fontFamily:'Cinzel,serif',color:done?'var(--gold2)':'var(--text3)'}}>
                          <span>{done?'✦':'○'}</span>
                          <span>{c.name}</span>
                          {!done&&<span style={{color:'var(--gold)',fontSize:9}}>tap to confirm</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          {!story.chapters?.length&&<div style={{padding:'0 20px',color:'var(--text3)',fontSize:13,textAlign:'center'}}>No chapters yet. Tap + to begin.</div>}
        </>
      ) : (
        <><div className="section-label">Content</div><PlainEditor value={story.content||''} onChange={v=>onEdit({content:v})}/></>
      )}
      {charProgress&&(
        <CharProgressModal char={charProgress.char} chapter={charProgress.chapter}
          onClose={() => setCharProgress(null)}
          onSave={(cId,cs) => {
            const updatedChars = story.characters.map(c => c.id===charProgress.char.id ? {...c,chapterStats:{...c.chapterStats,[cId]:cs}} : c)
            onEdit({characters:updatedChars})
            setCharProgress(null)
          }} />
      )}
    </div>
  )
}

// ── CHAPTER SCREEN ─────────────────────────────────────────────────────────
function ChapterScreen({ story, chapter, onBack, onPart, onToggleComplete, setModal, onUpdateChapter, setDelTarget, onDeleteChapter }) {
  const [edit, setEdit] = useState(false)
  const [content, setContent] = useState(chapter.content||'')
  const allOk = (story.characters||[]).every(c => c.chapterStats?.[chapter.id]!==undefined)
  return (
    <div className="screen-enter">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>{chapter.title}</h2>
        <MagnetBtn className="btn btn-sm btn-danger" onClick={() => { setDelTarget({label:chapter.title,fn:onDeleteChapter}); setModal('confirm') }}>🗑</MagnetBtn>
      </div>
      {!allOk&&<div style={{margin:'0 20px 12px',padding:'10px 14px',background:'rgba(193,18,31,0.1)',border:'1px solid rgba(193,18,31,0.3)',borderRadius:8,fontSize:12,color:'#ff6b6b',fontFamily:'Cinzel,serif'}}>⚠ Confirm all characters before writing</div>}
      <div style={{padding:'0 20px 12px',display:'flex',gap:8}}>
        <MagnetBtn className={'btn btn-sm '+(chapter.completed?'btn-gold':'btn-outline')} onClick={onToggleComplete}>{chapter.completed?'✦ Completed':'Mark Complete'}</MagnetBtn>
        <MagnetBtn className="btn btn-sm btn-outline" onClick={() => setModal('newPart')}>+ Add Part</MagnetBtn>
      </div>
      <div className="section-label">Chapter Content</div>
      {edit ? (
        <div style={{padding:'0 20px'}}>
          <textarea className="editor-area" style={{margin:0,width:'100%',minHeight:240}} value={content} onChange={e => setContent(e.target.value)} autoFocus />
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <MagnetBtn className="btn btn-gold btn-sm" onClick={() => { onUpdateChapter({content}); setEdit(false) }}>Save</MagnetBtn>
            <MagnetBtn className="btn btn-outline btn-sm" onClick={() => setEdit(false)}>Cancel</MagnetBtn>
          </div>
        </div>
      ) : (
        <AntiCard className="card" onClick={() => setEdit(true)} style={{cursor:'text'}}>
          {chapter.content?<p style={{fontSize:15,lineHeight:1.8}}>{chapter.content}</p>:<p style={{color:'var(--text3)',fontSize:14}}>Tap to write chapter content...</p>}
        </AntiCard>
      )}
      {chapter.parts?.length>0&&(
        <><div className="section-label" style={{marginTop:6}}>Parts</div>
        {chapter.parts.map(p => (
          <div key={p.id} className="part-item stagger-item" onClick={() => onPart(p)}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span>{p.title}</span>
              <span style={{fontSize:11,color:'var(--text3)'}}>{p.content?.split(/\s+/).filter(Boolean).length||0} words →</span>
            </div>
          </div>
        ))}</>
      )}
    </div>
  )
}

function PartScreen({ part, onBack, onUpdate }) {
  const [v, sv] = useState(part.content||'')
  const [editingTitle, setEditingTitle] = useState(false)
  const [pTitle, setPTitle] = useState(part.title)
  const timer = useRef(null)
  return (
    <div className="screen-enter">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>←</button>
        {editingTitle
          ? <input style={{background:'transparent',border:'none',borderBottom:'1px solid var(--gold)',color:'var(--gold2)',fontFamily:'Cinzel,serif',fontSize:16,outline:'none',flex:1}} value={pTitle} onChange={e=>setPTitle(e.target.value)} onBlur={()=>{onUpdate({title:pTitle});setEditingTitle(false)}} onKeyDown={e=>e.key==='Enter'&&(onUpdate({title:pTitle}),setEditingTitle(false))} autoFocus/>
          : <h2 onClick={()=>setEditingTitle(true)} style={{cursor:'text'}} title="Click to rename">{pTitle}</h2>
        }
      </div>
      <textarea className="editor-area" style={{minHeight:420}} placeholder="Write this part..." value={v}
        onChange={e => { sv(e.target.value); clearTimeout(timer.current); timer.current=setTimeout(()=>onUpdate({content:e.target.value}),900) }} />
      <div style={{fontSize:11,color:'var(--text3)',textAlign:'right',padding:'4px 20px',fontFamily:'Cinzel,serif'}}>{v.trim()?v.trim().split(/\s+/).length:0} words</div>
    </div>
  )
}

// ── CHAR DETAIL SCREEN (writer) ────────────────────────────────────────────
function CharDetailScreen({ story, char, onBack, setModal, setDelTarget, onDeleteChar, onUpdateChar }) {
  const [showSkill, setShowSkill] = useState(false)
  const [editSkill, setEditSkill] = useState(null)
  const stats = calcStats(char.level||1)
  return (
    <div className="screen-enter">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>Character</h2>
        <MagnetBtn className="btn btn-sm btn-danger" onClick={() => { setDelTarget({label:char.name,fn:onDeleteChar}); setModal('confirm') }}>🗑</MagnetBtn>
      </div>
      <div style={{textAlign:'center',padding:'16px 20px 8px'}}>
        <div className="char-detail-avatar">{(char.name||'?')[0].toUpperCase()}</div>
        <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:18,color:'var(--gold2)'}}>{char.name}</div>
        <div style={{fontFamily:'Cinzel,serif',fontSize:10,letterSpacing:3,color:'var(--text3)',marginTop:3}}>{char.role}</div>
        <div className="tier-badge" style={{justifyContent:'center',marginTop:6}}>⚔ Lv.{char.level||1} — {getTierName(char.level||1)}</div>
      </div>
      <AntiCard className="card">
        <div className="card-title">Identity</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:10}}>
          <div><div className="stat-label">Archetype</div><div style={{color:'var(--gold2)',fontFamily:'Cinzel,serif',marginTop:3,fontSize:13}}>{char.archetype}</div></div>
          <div><div className="stat-label">Grade</div><div style={{color:GRADE_CLR[char.grade]||'var(--gold)',fontFamily:'Cinzel,serif',marginTop:3,fontSize:13}}>{char.grade}</div></div>
        </div>
        <div style={{marginTop:12}}><div className="stat-label">Affinities</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:5}}>{(char.affinities||[]).map(a => <span key={a} className="badge" style={{color:AFF_CLR[a],borderColor:AFF_CLR[a]}}>{a}</span>)}</div>
        </div>
      </AntiCard>
      <AntiCard className="card">
        <div className="card-title">Base Stats</div>
        <div className="stats-grid" style={{marginTop:10}}>
          <div className="stat-box"><div className="stat-label">HP</div><div className="stat-val"><CountUp value={stats.hp}/></div></div>
          <div className="stat-box"><div className="stat-label">Mana</div><div className="stat-val"><CountUp value={stats.mana}/></div></div>
          <div className="stat-box"><div className="stat-label">Speed</div><div className="stat-val"><CountUp value={stats.speed}/></div></div>
          <div className="stat-box" style={{display:'flex',alignItems:'center',justifyContent:'center'}}><div className="atk-note">⚔ ATK via skills</div></div>
        </div>
      </AntiCard>
      {char.lore&&<AntiCard className="card"><div className="card-title">Backstory</div><div className="card-body">{char.lore}</div></AntiCard>}
      <div className="section-label">Skills</div>
      <div style={{padding:'0 20px 8px'}}>
        {!(char.skills||[]).length&&<div style={{color:'var(--text3)',fontSize:13,textAlign:'center',padding:'14px 0'}}>No skills yet.</div>}
        {(char.skills||[]).map(sk => {
          const tc = SKILL_TYPE_CLR[sk.type]||'var(--gold)'
          return (
            <div key={sk.id} className="skill-item" style={{'--element-clr':AFF_CLR[sk.element]||'var(--gold)'}}>
              <div style={{flex:1}}>
                <div className="skill-name">{sk.name}</div>
                <div style={{display:'flex',gap:5,marginTop:3,flexWrap:'wrap'}}>
                  <span style={{fontSize:9,padding:'1px 6px',borderRadius:10,border:'1px solid '+tc,color:tc,fontFamily:'Cinzel,serif'}}>{sk.type}</span>
                  <span className="skill-element" style={{color:AFF_CLR[sk.element],borderColor:AFF_CLR[sk.element]}}>{sk.element}</span>
                  <span className="skill-lvl">Lv.{sk.level}</span>
                </div>
                {sk.description&&<div style={{fontSize:11,color:'var(--text3)',marginTop:3,fontStyle:'italic'}}>{sk.description}</div>}
              </div>
              <button onClick={() => setEditSkill(sk)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:13,padding:'0 4px'}}>✏</button>
              <button onClick={() => onUpdateChar({skills:(char.skills||[]).filter(s=>s.id!==sk.id)})} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16}}>×</button>
            </div>
          )
        })}
        <MagnetBtn className="btn btn-outline btn-full" style={{marginTop:8}} onClick={() => setShowSkill(true)}>+ Add Skill</MagnetBtn>
      </div>
      {showSkill&&<SkillModal onClose={() => setShowSkill(false)} onSave={sk => onUpdateChar({skills:[...(char.skills||[]),sk]})}/>}
      {editSkill&&<SkillModal existing={editSkill} onClose={() => setEditSkill(null)} onSave={updated => onUpdateChar({skills:(char.skills||[]).map(s=>s.id===updated.id?updated:s)})}/>}
    </div>
  )
}

// ── READER PAGE ────────────────────────────────────────────────────────────
function ReaderPage({ story, onClose }) {
  const [view, setView] = useState('home')
  const [chIdx, setChIdx] = useState(0)
  const [pIdx, setPIdx] = useState(0)
  const storageKey = 'evo_progress_' + story.id
const [unlockedChs, setUnlockedChs] = useState(() => {
  try { return JSON.parse(localStorage.getItem(storageKey)) || [0] } catch { return [0] }
})
  const [viewChar, setViewChar] = useState(null)
  const chapters = story.chapters||[]

  const completeChapter = (idx) => setUnlockedChs(prev => {
  const next = [...new Set([...prev,idx+1])]
  localStorage.setItem(storageKey, JSON.stringify(next))
  return next
})

  const charsAt = (cIdx) => {
    const ch = chapters[cIdx]
    return (story.characters||[]).map(c => {
      if (!ch) return {...c,stats:calcStats(c.level||1)}
      const cs = c.chapterStats?.[ch.id]
      if (cs&&cs.changed!==false) return {...c,level:cs.level||c.level,grade:cs.grade||c.grade,skills:cs.skills||c.skills||[],stats:calcStats(cs.level||c.level)}
      return {...c,stats:calcStats(c.level||1)}
    })
  }

  const toCards = (chars) => chars.map(c => ({
    name:c.name,level:c.level||1,grade:c.grade,
    affinities:c.affinities||[],skills:c.skills||[],
    stats:c.stats||calcStats(c.level||1),lore:c.lore||'',
    gradeColor:GRADE_CLR[c.grade]||'#c9a84c',affColors:AFF_CLR,_ref:c
  }))

  const ReaderNav = ({ title, onPressBack, backLabel }) => (
    <div className="reader-nav">
      <button className="back-btn" onClick={onPressBack}>←</button>
      <div className="reader-title">{title}</div>
    </div>
  )

  if (story.type==='plain') {
    const chars = story.characters||[]
    return (
      <div className="reader-page">
        <ReaderNav title={story.title} onPressBack={onClose} />
        {chars.length>0&&<><div className="section-label" style={{padding:'14px 20px 7px'}}>Characters</div>
          <div className="char-gallery-wrap"><CharacterGallery cards={toCards(chars)} onCharClick={c => setViewChar(c._ref||c)}/></div></>}
        <div className="reader-content" style={{paddingTop:24}}><p className="reader-prose">{story.content||'No content yet.'}</p></div>
        {viewChar&&<CharDetailModal char={viewChar} onClose={() => setViewChar(null)}/>}
      </div>
    )
  }

  if (view==='part') {
    const ch = chapters[chIdx]
    const parts = ch?.parts||[]
    const part = parts[pIdx]
    return (
      <div className="reader-page">
        <ReaderNav title={part?.title} onPressBack={() => setView('chapter')} />
        <div className="reader-content" style={{paddingTop:24}}><p className="reader-prose">{part?.content||'No content yet.'}</p></div>
        <div className="reader-progress">
          <span style={{fontSize:10,color:'var(--text3)',fontFamily:'Cinzel,serif',whiteSpace:'nowrap'}}>Part {pIdx+1}/{parts.length}</span>
          <div className="reader-prog-bar"><div className="reader-prog-fill" style={{width:Math.round(((pIdx+1)/parts.length)*100)+'%'}}/></div>
          {pIdx<parts.length-1
            ? <MagnetBtn className="btn btn-gold btn-sm" onClick={() => setPIdx(pIdx+1)}>Next →</MagnetBtn>
            : <MagnetBtn className="btn btn-gold btn-sm" onClick={() => { completeChapter(chIdx); setView('home') }}>Complete ✦</MagnetBtn>
          }
        </div>
      </div>
    )
  }

  if (view==='chapter') {
    const ch = chapters[chIdx]
    if (!ch) return null
    const chars = charsAt(chIdx)
    return (
      <div className="reader-page">
        <ReaderNav title={'Ch.'+(chIdx+1)+': '+ch.title} onPressBack={() => setView('home')} />
        {chars.length>0&&<><div className="section-label" style={{padding:'14px 20px 7px'}}>Characters</div>
          <div className="char-gallery-wrap"><CharacterGallery cards={toCards(chars)} onCharClick={c => setViewChar(c._ref||c)}/></div></>}
        {ch.content&&<div className="reader-content" style={{paddingTop:20}}><p className="reader-prose">{ch.content}</p></div>}
        {ch.parts?.length>0&&(
          <><div className="section-label" style={{padding:'12px 20px 7px'}}>Parts</div>
          {ch.parts.map((p,i) => (
            <AntiCard key={p.id} className="reader-chapter-card stagger-item" onClick={() => { setPIdx(i); setView('part') }}>
              <div style={{fontFamily:'Cinzel,serif',fontSize:13,color:'var(--gold2)'}}>{p.title}</div>
              <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>{p.content?.split(/\s+/).filter(Boolean).length||0} words</div>
            </AntiCard>
          ))}</>
        )}
        {!ch.content&&!ch.parts?.length&&<div className="empty-state"><div className="empty-icon">📜</div><div className="empty-title">Empty Chapter</div></div>}
        {!ch.parts?.length&&<div style={{padding:'12px 20px 20px',display:'flex',justifyContent:'center'}}><MagnetBtn className="btn btn-gold" onClick={() => { completeChapter(chIdx); setView('home') }}>Mark Complete ✦</MagnetBtn></div>}
        {viewChar&&<CharDetailModal char={viewChar} onClose={() => setViewChar(null)}/>}
      </div>
    )
  }

  // home — chapter list
  return (
    <div className="reader-page">
      <ReaderNav title={story.title} onPressBack={onClose} />
      {toCards(story.characters||[]).length>0&&(
        <><div className="section-label" style={{padding:'14px 20px 7px'}}>Characters</div>
        <div className="char-gallery-wrap"><CharacterGallery cards={toCards(story.characters||[])} onCharClick={c => setViewChar(c._ref||c)}/></div></>
      )}
      {story.description&&<div className="reader-content" style={{paddingBottom:0}}><p style={{fontFamily:'Crimson Pro,serif',fontSize:16,color:'var(--text2)',lineHeight:1.8,fontStyle:'italic',borderLeft:'2px solid var(--gold)',paddingLeft:14}}>{story.description}</p></div>}
      <div className="reader-chapter-list">
        {chapters.map((ch,idx) => {
          const locked = !unlockedChs.includes(idx)
          return (
            <AntiCard key={ch.id} className={'reader-chapter-card stagger-item '+(locked?'locked':'')} onClick={() => !locked&&(setChIdx(idx),setView('chapter'))}>
              {locked&&<><div className="fog-particles"/><div className="fog-overlay"><div className="fog-icon">🌫</div><div className="fog-text">Complete previous chapter to unlock</div></div></>}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontFamily:'Cinzel,serif',fontSize:9,color:'var(--text3)',letterSpacing:2}}>CHAPTER {idx+1}</div>
                  <div style={{fontFamily:'Cinzel,serif',fontSize:15,color:locked?'var(--text3)':'var(--gold2)',marginTop:4}}>{ch.title}</div>
                  <div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>{ch.parts?.length||0} parts</div>
                </div>
                <div style={{fontSize:20,color:locked?'var(--text3)':'var(--text2)'}}>{locked?'🔒':'▶'}</div>
              </div>
            </AntiCard>
          )
        })}
      </div>
      {viewChar&&<CharDetailModal char={viewChar} onClose={() => setViewChar(null)}/>}
    </div>
  )
}

// ── ONLINE TAB ─────────────────────────────────────────────────────────────
function OnlineTab({ online, stories, setModal }) {
  const [published, setPublished] = useState([])
  const [loading, setLoading] = useState(false)
  const [reading, setReading] = useState(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    if (!online||!db) return
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db,'published_stories'),orderBy('publishedAt','desc')))
      setPublished(snap.docs.map(d => ({id:d.id,...d.data()})))
    } catch(e) { console.warn(e) }
    setLoading(false)
  }
  useEffect(() => { if(online) load() }, [online])

  const filtered = published.filter(s => !search.trim()||s.title?.toLowerCase().includes(search.toLowerCase())||s.genre?.toLowerCase().includes(search.toLowerCase())||s.description?.toLowerCase().includes(search.toLowerCase()))

  if (!online) return <div className="empty-state"><div className="empty-icon">📡</div><div className="empty-title">No Connection</div></div>
  if (reading) return <ReaderPage story={reading} onClose={() => setReading(null)}/>

  return (
    <div className="screen-fade">
      <div className="online-hero"><h2>EvoTales Online</h2><p>Discover and read legends from across the realm.</p></div>
      <AntiCard className="online-btn stagger-item" onClick={() => setModal('publish')}>
        <div className="online-btn-icon">⚔</div>
        <div><div className="online-btn-title">Publish Your Story</div><div className="online-btn-desc">Updates existing — no duplicates.</div></div>
      </AntiCard>
      <AntiCard className="online-btn stagger-item" onClick={load}>
        <div className="online-btn-icon">📖</div>
        <div><div className="online-btn-title">Refresh Stories</div><div className="online-btn-desc">{loading?'⟳ Loading...':published.length+' tales available.'}</div></div>
      </AntiCard>
      {published.length>0&&(
        <>
          <div className="section-label">Published Stories</div>
          <div className="search-bar"><span className="search-icon">🔍</span><input className="search-input" placeholder="Search by title, genre..." value={search} onChange={e => setSearch(e.target.value)}/></div>
          {filtered.length===0&&<div style={{textAlign:'center',color:'var(--text3)',fontSize:13,padding:'20px 0'}}>No stories match "{search}"</div>}
          {filtered.map(s => (
            <AntiCard key={s.id} className="pub-card stagger-item" onClick={() => setReading(s)}>
              <div className="card-title">{s.title}</div>
              <div className="card-sub">{s.genre} · {s.type==='chapters'?s.chapters?.length+' chapters':'Plain'}</div>
              <div className="card-body" style={{fontSize:13}}>{(s.description||'').slice(0,120)}{s.description?.length>120?'...':''}</div>
              <div style={{marginTop:8,display:'flex',gap:10,fontSize:10,color:'var(--text3)',fontFamily:'Cinzel,serif',letterSpacing:1}}>
                <span>{s.characters?.length||0} characters</span><span>·</span><span>{s.chapters?.length||0} chapters</span>
                <span style={{marginLeft:'auto',color:'var(--gold)'}}>▶ Read</span>
              </div>
            </AntiCard>
          ))}
        </>
      )}
    </div>
  )
}

// ── MAIN APP ───────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('library')
  const [screen, setScreen] = useState('home')
  const [stories, setStories] = useState(() => LS.get('evo_stories',[]))
  const [activeStory, setActiveStory] = useState(null)
  const [activeChapter, setActiveChapter] = useState(null)
  const [activePart, setActivePart] = useState(null)
  const [activeChar, setActiveChar] = useState(null)
  const [modal, setModal] = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [toast, setToast] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)

  useClickSpark()
  useEffect(() => {
    const on=()=>setOnline(true),off=()=>setOnline(false)
    window.addEventListener('online',on); window.addEventListener('offline',off)
    return () => { window.removeEventListener('online',on); window.removeEventListener('offline',off) }
  },[])

  const saveStories = s => { setStories(s); LS.set('evo_stories',s) }
  const showToast = msg => setToast(msg)
  const story = stories.find(s=>s.id===activeStory?.id)
  const chapter = story?.chapters?.find(c=>c.id===activeChapter?.id)
  const part = chapter?.parts?.find(p=>p.id===activePart?.id)
  const char = story?.characters?.find(c=>c.id===activeChar?.id)

  const patchStory = (id,patch) => saveStories(stories.map(s=>s.id===id?{...s,...patch}:s))
  const createStory = data => { saveStories([{id:uid(),...data,chapters:[],characters:[],createdAt:Date.now()},...stories]); showToast('Story created') }
  const deleteStory = id => { saveStories(stories.filter(s=>s.id!==id)); setScreen('home'); setActiveStory(null); showToast('Deleted') }
  const patchChapter = (sId,cId,patch) => { const s=stories.find(x=>x.id===sId); patchStory(sId,{chapters:s.chapters.map(c=>c.id===cId?{...c,...patch}:c)}) }
  const createChapter = (title,sId) => { const s=stories.find(x=>x.id===sId); patchStory(sId,{chapters:[...s.chapters,{id:uid(),title,parts:[],content:'',completed:false}]}); showToast('Chapter added') }
  const deleteChapter = (sId,cId) => { const s=stories.find(x=>x.id===sId); patchStory(sId,{chapters:s.chapters.filter(c=>c.id!==cId)}); setScreen('story'); setActiveChapter(null); showToast('Deleted') }
  const patchPart = (sId,cId,pId,patch) => { const s=stories.find(x=>x.id===sId); const ch=s.chapters.find(c=>c.id===cId); patchChapter(sId,cId,{parts:ch.parts.map(p=>p.id===pId?{...p,...patch}:p)}) }
  const createPart = (title,sId,cId) => { const s=stories.find(x=>x.id===sId); const ch=s.chapters.find(c=>c.id===cId); patchChapter(sId,cId,{parts:[...ch.parts,{id:uid(),title,content:''}]}); showToast('Part added') }
  const patchChar = (sId,charId,patch) => { const s=stories.find(x=>x.id===sId); patchStory(sId,{characters:s.characters.map(c=>c.id===charId?{...c,...patch}:c)}) }
  const createChar = (data,sId) => { const s=stories.find(x=>x.id===sId); patchStory(sId,{characters:[...s.characters,{id:uid(),...data,chapterStats:{}}]}); showToast('Character created') }
  const deleteChar = (sId,charId) => { const s=stories.find(x=>x.id===sId); patchStory(sId,{characters:s.characters.filter(c=>c.id!==charId)}); setScreen('story'); setActiveChar(null); showToast('Removed') }

  const publishStory = async (sId) => {
    if (!db) { showToast('Firebase unavailable'); return }
    const s=stories.find(x=>x.id===sId)
    const payload={title:s.title,genre:s.genre,description:s.description,type:s.type,chapters:s.chapters||[],characters:s.characters||[],updatedAt:Date.now(),publishedAt:s.publishedAt||Date.now()}
    try {
      if (s.firebaseId) { await updateDoc(doc(db,'published_stories',s.firebaseId),payload); showToast('Updated online ✦') }
      else {
        const ex=await getDocs(query(collection(db,'published_stories'),where('title','==',s.title)))
        if (!ex.empty) { const dId=ex.docs[0].id; await updateDoc(doc(db,'published_stories',dId),payload); patchStory(sId,{firebaseId:dId}); showToast('Updated online ✦') }
        else { const ref=await addDoc(collection(db,'published_stories'),payload); patchStory(sId,{firebaseId:ref.id,publishedAt:Date.now()}); showToast('Published! ✦') }
      }
      setModal(null)
    } catch(e) { showToast('Publish failed') }
  }

  const switchTab = t => { setTab(t); setScreen('home'); setActiveStory(null); setActiveChapter(null); setActivePart(null); setActiveChar(null) }
  const showFab = tab==='library'&&(screen==='home'||(screen==='story'&&story?.type==='chapters')||screen==='chapter')
  const fabAction = () => { if(screen==='home') setModal('newStory'); else if(screen==='story') setModal('newChapter'); else if(screen==='chapter') setModal('newPart') }

  const renderScreen = () => {
    if (screen==='home') return <StoryList stories={stories} onOpen={s=>{setActiveStory(s);setScreen('story')}}/>
    if (screen==='story'&&story) return <StoryScreen story={story} onBack={()=>setScreen('home')} onChapter={ch=>{setActiveChapter(ch);setScreen('chapter')}} onChar={c=>{setActiveChar(c);setScreen('charDetail')}} onEdit={patch=>patchStory(story.id,patch)} setModal={setModal} setDelTarget={setDelTarget} onDeleteStory={()=>deleteStory(story.id)}/>
    if (screen==='chapter'&&chapter) return <ChapterScreen story={story} chapter={chapter} onBack={()=>setScreen('story')} onPart={p=>{setActivePart(p);setScreen('part')}} onToggleComplete={()=>patchChapter(story.id,chapter.id,{completed:!chapter.completed})} setModal={setModal} onUpdateChapter={patch=>patchChapter(story.id,chapter.id,patch)} setDelTarget={setDelTarget} onDeleteChapter={()=>deleteChapter(story.id,chapter.id)}/>
    if (screen==='part'&&part) return <PartScreen part={part} onBack={()=>setScreen('chapter')} onUpdate={patch=>patchPart(story.id,chapter.id,part.id,patch)}/>
    if (screen==='charDetail'&&char) return <CharDetailScreen story={story} char={char} onBack={()=>setScreen('story')} setModal={setModal} setDelTarget={setDelTarget} onDeleteChar={()=>deleteChar(story.id,char.id)} onUpdateChar={patch=>patchChar(story.id,char.id,patch)}/>
    return null
  }

  return (
    <div className="app">
      <div className="app-bg"/>
      <RuneField/>
      <nav className="nav">
        <div><div className="nav-logo">EvoTales</div><div className="nav-sub">Forge Your Legend</div></div>
        <div className={'status-badge '+(online?'s-online':'s-offline')}><div className="sdot"/>{online?'Online':'Offline'}</div>
      </nav>
      <div className="tabs">
        {['library','online','collab'].map(t => <button key={t} className={'tab '+(tab===t?'active':'')} onClick={() => { if((t==='online'||t==='collab')&&!online) return; switchTab(t) }} style={(t==='online'||t==='collab')&&!online?{opacity:0.4,cursor:'not-allowed'}:{}}>{t==='library'?'📚 Library':t==='online'?'🌐 Online':'🤝 Collab'}</button>)}
      </div>
      <div className="content">{tab==='library'?renderScreen():tab==='online'?<OnlineTab online={online} stories={stories} setModal={setModal}/>:<CollabTab stories={stories} online={online} onSaveToLibrary={(storyId,chapters,characters)=>{ patchStory(storyId,{chapters,characters}); showToast("Saved to Library ✦") }}/>}</div>
      {showFab&&<MagnetBtn className="fab" onClick={fabAction}>{screen==='home'?'✦':'+'}</MagnetBtn>}
      {modal==='newStory'&&<NewStoryModal onClose={()=>setModal(null)} onCreate={createStory}/>}
      {modal==='newChapter'&&story&&<NewChapterModal onClose={()=>setModal(null)} onCreate={t=>createChapter(t,story.id)}/>}
      {modal==='newPart'&&chapter&&<NewPartModal onClose={()=>setModal(null)} onCreate={t=>createPart(t,story.id,chapter.id)}/>}
      {modal==='newChar'&&story&&<NewCharModal onClose={()=>setModal(null)} onCreate={d=>createChar(d,story.id)}/>}
      {modal==='publish'&&<PublishModal stories={stories} onClose={()=>setModal(null)} onPublish={publishStory}/>}
      {modal==='confirm'&&delTarget&&<ConfirmModal msg={'Delete "'+delTarget.label+'"?'} onClose={()=>setModal(null)} onConfirm={() => { delTarget.fn(); setModal(null); setDelTarget(null) }}/>}
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  )
}
