'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Bot, ChevronRight, CircleHelp, Cpu, Crosshair, History, House, LockKeyhole, Play, RotateCcw, ShieldCheck, Sparkles, Swords, Trash2, Trophy, UserRound, X, Zap } from 'lucide-react';
import Hand from './Hand';
import CameraInput from './CameraInput';
import { LABELS, MODES, MOVES, OUTCOMES, nextRound, reveal, startMatch, submitMove, type Difficulty, type Match, type Move, type Round, type Target } from './engine';
import { ACTIVE_KEY, HISTORY_KEY, readActive, readHistory, saveCompleted } from './storage';

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog=ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} aria-label={title} className={`modal ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-inner"><header><h2>{title}</h2><button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={21}/></button></header>{children}</div></dialog>;
}
function RoundHistory({ rounds }: { rounds: Round[] }) {
  if (!rounds.length) return <div className="empty-history"><History size={26}/><p>每一次出拳，都值得记录</p><span>开始挑战后，回合记录将在这里显示</span></div>;
  return <div className="table-scroll"><table><thead><tr><th>回合</th><th>你的出拳</th><th>AI 出拳</th><th>结果</th><th>比分</th></tr></thead><tbody>{[...rounds].reverse().map(r => <tr key={r.number}><td className="mono">{String(r.number).padStart(2, '0')}</td><td>{LABELS[r.player]}</td><td>{LABELS[r.ai]}</td><td><span className={`outcome ${r.result}`}>{OUTCOMES[r.result]}</span></td><td className="mono">{r.playerScore} : {r.aiScore}</td></tr>)}</tbody></table></div>;
}
function ModeSelection({ difficulty, target, onDifficulty, onTarget, disabled, onStart }: { difficulty: Difficulty; target: Target; onDifficulty: (d: Difficulty) => void; onTarget: (t: Target) => void; disabled: boolean; onStart: () => void }) {
  return <section className="panel settings"><div className="section-title"><span className="heading-icon"><Crosshair size={19}/></span><h2>挑战设置</h2><span className="micro">准备你的下一场胜利</span></div><div className="settings-body"><fieldset disabled={disabled}><legend><span>01</span> 选择难度</legend><div className="difficulty-options">{(['easy','hard'] as Difficulty[]).map(d => <button key={d} className={`difficulty-option ${difficulty===d?'selected':''}`} aria-pressed={difficulty===d} onClick={()=>onDifficulty(d)}><span className={`mode-icon ${d}`}>{d==='easy'?<Zap size={22}/>:<Cpu size={22}/>}</span><span className="mode-copy"><b>{d==='easy'?'简单模式':'困难模式'}</b><small>{d==='easy'?'轻松上手，公平随机':'学习习惯，策略博弈'}</small></span><span className="radio">{difficulty===d&&<span/>}</span></button>)}</div></fieldset><fieldset disabled={disabled}><legend><span>02</span> 选择赛制</legend><div className="format-options">{([2,3,4] as Target[]).map(t=><button className={target===t?'selected':''} aria-pressed={target===t} key={t} onClick={()=>onTarget(t)}><b>{MODES[t]}</b><small>率先赢得 {t} 局</small></button>)}</div></fieldset><div className="setting-note"><ShieldCheck size={17}/><span>AI 提前出拳，公平对战每一局</span></div><button className="primary start-button" disabled={disabled} onClick={onStart}><Play size={17} fill="currentColor"/>{disabled?'比赛已开始':'开始游戏'}{!disabled&&<ArrowRight size={19}/>}</button></div></section>;
}
function ScoreSide({ ai, score, target, move, phase }: { ai?: boolean; score: number; target: Target; move: Move | null; phase: string }) {
  const shown=phase==='result'||phase==='finished';
  return <div className={`fighter ${ai?'ai':''}`}><div className="fighter-name"><span>{ai?<Bot size={17}/>:<UserRound size={17}/>}</span>{ai?'AI 对手':'你'}<small>{ai?'智能挑战者':'人类挑战者'}</small></div><div className={`gesture-orbit ${phase==='revealing'?'shaking':''} ${shown?'revealed':''}`}><div className="orbit-inner"/>{shown&&move?<Hand move={move}/>:ai?<Bot className="standby-icon" strokeWidth={1.3}/>:<Hand move="rock"/>}<span className="orbit-dot"/></div><span className="gesture-label">{shown&&move?LABELS[move]:phase==='revealing'?'正在揭晓…':ai?(phase==='waiting'?'出拳已锁定':'等待挑战'):(phase==='waiting'?'等待你的出拳':'准备就绪')}</span><div className="score-dots" aria-label={`已赢 ${score} 局，目标 ${target} 局`}>{Array.from({length:target},(_,i)=><span key={i} className={i<score?'filled':''}/>)}</div></div>;
}

export default function Game() {
  const [difficulty,setDifficulty]=useState<Difficulty>('easy');
  const [target,setTarget]=useState<Target>(2);
  const [match,setMatch]=useState<Match|null>(null);
  const matchRef=useRef<Match|null>(null);
  const [history,setHistory]=useState<Match[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [message,setMessage]=useState('');
  const [modal,setModal]=useState<'history'|'rules'|'exit'|null>(null);
  const [confirmClear,setConfirmClear]=useState(false);
  const [expanded,setExpanded]=useState<string|null>(null);
  const processed=useRef<string|null>(null);
  const commit=(next: Match|null)=>{ matchRef.current=next; setMatch(next); try { if(next) localStorage.setItem(ACTIVE_KEY,JSON.stringify(next)); else localStorage.removeItem(ACTIVE_KEY); } catch {setMessage('浏览器存储不可用：仍可游戏，但刷新后进度可能丢失。');} };
  useEffect(()=>{
    try {setHistory(readHistory());} catch {setMessage('历史记录无法读取。你可以在历史战绩中确认清空后重新记录。');}
    try {const active=readActive(); if(active){matchRef.current=active;setMatch(active);setDifficulty(active.difficulty);setTarget(active.target);}} catch {setMessage('上次比赛进度无法恢复，请开始一场新比赛。');}
    setLoaded(true);
    const sync=(e:StorageEvent)=>{if(e.key===HISTORY_KEY){try{setHistory(readHistory());}catch{setMessage('历史战绩更新失败，请检查浏览器存储。');}}};
    window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
  },[]);
  useEffect(()=>{
    if(match?.phase!=='revealing')return;
    const id=match.id;
    const timer=window.setTimeout(()=>{const current=matchRef.current;if(current?.id===id&&current.phase==='revealing')commit(reveal(current));},700);
    return()=>window.clearTimeout(timer);
  },[match]);
  useEffect(()=>{
    if(match?.phase!=='finished'||processed.current===match.id)return;
    processed.current=match.id;
    try {setHistory(saveCompleted(match));} catch {setMessage('本场战绩未能保存：本地存储已满、不可用或记录损坏。当前结果仍可查看。');}
  },[match]);
  const start=()=>{if(!loaded)return;commit(startMatch(difficulty,target));};
  const play=(move:Move)=>{if(matchRef.current)commit(submitMove(matchRef.current,move));};
  const next=()=>{if(matchRef.current)commit(nextRound(matchRef.current));};
  const leave=()=>{commit(null);setModal(null);};
  const clear=()=>{try {localStorage.removeItem(HISTORY_KEY);setHistory([]);setConfirmClear(false);setExpanded(null);if(matchRef.current?.phase==='finished')commit(null);}catch{setMessage('清空失败，浏览器不允许修改本地存储。');}};
  const phase=match?.phase??'menu';
  useEffect(()=>{
    type Tool = { name: string; description: string; inputSchema: object; annotations: {readOnlyHint:boolean}; execute: (input: unknown)=>unknown };
    const context=(document as Document & {modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const registered:Tool[]=[
      {name:'read_match_status',description:'读取猜拳比赛状态与已完成回合；不公开尚未揭晓的 AI 出拳。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>{const m=matchRef.current;return m?{phase:m.phase,difficulty:m.difficulty,target:m.target,playerScore:m.playerScore,aiScore:m.aiScore,rounds:m.rounds,aiLocked:true}:{phase:'menu'};}},
      {name:'submit_player_move',description:'在等待玩家出拳时提交石头、剪刀或布，开始揭晓动画；与页面按钮共用状态校验。',inputSchema:{type:'object',properties:{move:{type:'string',enum:['rock','scissors','paper']}},required:['move'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input)=>{const move=(input as {move?:Move}|null)?.move;if(!move||!MOVES.includes(move))throw new Error('无效出拳');const current=matchRef.current;if(current?.phase!=='waiting')throw new Error('当前不能出拳');commit(submitMove(current,move));return {phase:matchRef.current!.phase,submitted:true};}}
    ];
    for(const tool of registered){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser API. */}}
    return()=>lifecycle.abort();
  },[]);
  const active=!!match&&phase!=='finished';
  const round=match?.rounds.at(-1);
  const wins=history.filter(m=>m.playerScore===m.target).length;
  const draws=match?.rounds.filter(r=>r.result==='draw').length??0;
  const effective=(match?.playerScore??0)+(match?.aiScore??0);
  const victory=match?.playerScore===match?.target;
  return <div className="app-shell"><header className="topbar"><a className="brand" href="#" onClick={e=>{e.preventDefault();if(active)setModal('exit');else leave();}}><span className="brand-mark"><Swords size={23}/></span><span>AI 猜拳<span className="brand-light">挑战赛</span><small>人类直觉 × 人工智能</small></span></a><nav aria-label="主要导航"><button className="nav-active" onClick={()=>setModal(null)}><Swords size={17}/>对战大厅</button><button onClick={()=>setModal('history')}><History size={17}/>历史战绩</button><button onClick={()=>setModal('rules')}><CircleHelp size={17}/>游戏规则</button></nav><span className="online-indicator"><i/> AI 已就绪</span></header>
    <main><div className="page-heading"><div><span className="eyebrow"><span/> 你的直觉，会是最强算法</span><h1>出拳之间，<span>胜负已定。</span></h1><p>石头、剪刀、布。向 AI 发起挑战，用你的下一手打破预测。</p></div><div className="fair-badge"><ShieldCheck size={25}/><div><b>公平博弈</b><small>先锁定 · 后揭晓</small></div></div></div>
    {message&&<div className="notice" role="status">{message}<button aria-label="关闭提示" onClick={()=>setMessage('')}><X size={16}/></button></div>}
    <div className="game-layout"><div className="main-column"><section className={`panel arena ${phase==='finished'?(victory?'victory':'defeat'):''}`}><div className="arena-header"><div className="section-title"><span className="heading-icon"><Swords size={18}/></span><h2>对战竞技场</h2></div><span className={`status-badge ${active?'live':''}`}><i/>{phase==='menu'?'等待开始':phase==='finished'?'比赛结束':`第 ${match!.rounds.length+(phase==='waiting'||phase==='revealing'?1:0)} 回合`}</span></div><div className="arena-body"><div className="match-info"><span>{difficulty==='easy'?<Zap size={13}/>:<Cpu size={13}/>} {difficulty==='easy'?'简单模式':'困难模式'}</span><span>{MODES[target]}</span><span>先赢 {target} 局获胜</span></div><div className="battle-stage"><ScoreSide score={match?.playerScore??0} target={target} move={match?.player??null} phase={phase}/><div className="score-center"><div className="versus">VS</div><div className="big-score"><span>{match?.playerScore??0}</span><i>:</i><span>{match?.aiScore??0}</span></div><span className="score-caption">当前比分</span></div><ScoreSide ai score={match?.aiScore??0} target={target} move={match?.lockedAI??null} phase={phase}/></div>
    {phase==='finished'?<div className="final-result" aria-live="polite"><div className="result-symbol">{victory?<Trophy size={28}/>:<Bot size={28}/>}</div><h2>{victory?'漂亮！这场胜利属于你':'挑战结束，AI 略胜一筹'}</h2><p>{difficulty==='easy'?'简单模式':'困难模式'} · {MODES[target]} · 共 {match!.rounds.length} 回合</p><div className="result-counts"><span>你获胜 <b>{match!.playerScore}</b></span><span>AI 获胜 <b>{match!.aiScore}</b></span><span>平局 <b>{draws}</b></span></div><div className="result-actions"><button className="primary" onClick={start}><RotateCcw size={17}/>再来一局</button><button className="secondary" onClick={leave}><House size={17}/>返回主菜单</button></div></div>:<><div className={`round-status ${round&&phase==='result'?round.result:''}`} aria-live="polite">{phase==='menu'?<><Sparkles size={17}/><span>准备好了吗？选择模式，开启你的挑战</span></>:phase==='waiting'?<><LockKeyhole size={16}/><span>AI 已完成出拳，请选择你的出拳</span></>:phase==='revealing'?<><span className="loading-dot"/>石头 · 剪刀 · 布！</>:<><span>{round?.result==='win'?'✦':round?.result==='loss'?'↗':'＝'}</span><b>{round&&OUTCOMES[round.result]}</b><span className="status-detail">{round?.result==='draw'?'双方不计分，再来一次':round?.result==='win'?'好判断，拿下一分！':'调整策略，下一局扳回来'}</span></>}</div><CameraInput canSubmit={phase === 'waiting'} phase={phase} paused={modal !== null} roundKey={`${match?.id ?? 'menu'}:${match?.rounds.length ?? 0}:${phase}`} onSubmit={play}/><div className="move-buttons">{MOVES.map((move,i)=><button key={move} disabled={phase!=='waiting'} onClick={()=>play(move)} className={`move-button ${move}`}><Hand move={move}/><b>{LABELS[move]}</b><small>克制{LABELS[MOVES[(i+1)%3]]}</small><span className="move-arrow"><ArrowRight size={15}/></span></button>)}</div><div className="arena-bottom">{phase==='result'?<button className="primary next-button" onClick={next}>下一局<ArrowRight size={17}/></button>:<span>{phase==='waiting'?'相信你的直觉，选择一招出击':'每一次选择，都是新的可能'}</span>}{active&&<button className="text-button" onClick={()=>setModal('exit')}>返回主菜单<ChevronRight size={14}/></button>}</div></>}
    </div><div className="arena-footnote"><ShieldCheck size={14}/><span>AI 的选择在你出拳前已锁定</span><span className="progress-text">有效局数 {effective} / {target*2-1} · 平局 {draws}</span></div></section>
    <section className="panel rounds-panel"><div className="section-title"><span className="heading-icon"><History size={18}/></span><h2>本场回合记录</h2><span className="count-badge">{match?.rounds.length??0} 回合</span><span className="micro">平局不计入有效局数</span></div><RoundHistory rounds={match?.rounds??[]}/></section></div>
    <aside><ModeSelection difficulty={difficulty} target={target} onDifficulty={setDifficulty} onTarget={setTarget} disabled={!!match||!loaded} onStart={start}/><section className="panel stats-panel"><div className="section-title"><span className="heading-icon gold"><Trophy size={18}/></span><h2>我的战绩</h2><button className="text-button" onClick={()=>setModal('history')}>查看全部<ChevronRight size={14}/></button></div><div className="stats-grid"><div><b>{history.length}</b><span>累计场次</span></div><div><b className="cyan">{history.length?Math.round(wins/history.length*100):0}<small>%</small></b><span>比赛胜率</span></div></div><div className="win-bar"><span style={{width:`${history.length?wins/history.length*100:0}%`}}/></div><div className="stats-legend"><span><i/>获胜 {wins}</span><span><i/>失败 {history.length-wins}</span></div></section><section className="tip-panel"><span className="tip-icon"><Sparkles size={19}/></span><div><h3>高手小贴士</h3><p>{difficulty==='easy'?'简单模式中，每一手都是独立随机。放轻松，相信你的直觉。':'困难 AI 会学习你的出拳习惯。避免重复套路，让下一手难以预测。'}</p></div></section></aside></div>
    <footer><span><Swords size={14}/> AI 猜拳挑战赛</span><span>石头胜剪刀 · 剪刀胜布 · 布胜石头</span><span><LockKeyhole size={12}/> 战绩仅保存在当前浏览器</span></footer></main>
    {modal==='rules'&&<Modal title="游戏规则" onClose={()=>setModal(null)}><div className="rules-cycle">{MOVES.map((m,i)=><div key={m}><Hand move={m}/><b>{LABELS[m]}</b><span>胜 {LABELS[MOVES[(i+1)%3]]}</span></div>)}</div><div className="rules-copy"><p>选择难度与赛制，点击“开始游戏”。AI 每回合先锁定出拳，随后你选择石头、剪刀或布，双方同时揭晓。</p><p>赢一局得 1 分，平局不加分、不计入有效局数。三局两胜、五局三胜、七局四胜分别需要率先取得 2、3、4 分。平局可能使总回合数超过赛制局数。</p><p><b>简单模式：</b>每局独立等概率随机出拳，不读取历史。</p><p><b>困难模式：</b>仅根据已完成回合的频率、近期习惯和出拳转换预测下一手，并保留随机性。历史不足 3 回合时随机出拳。</p><p>刷新页面可恢复当前比赛。中途返回主菜单将放弃本场，不计入历史战绩。完成的战绩保存在当前浏览器，清理浏览器数据会移除记录。</p></div><button className="primary full-width" onClick={()=>setModal(null)}>明白了，开始挑战</button></Modal>}
    {modal==='exit'&&<Modal title="要结束当前挑战吗？" onClose={()=>setModal(null)}><p className="dialog-copy">返回主菜单会放弃当前比赛，本场不会计入历史战绩。已经完成的比赛记录不受影响。</p><div className="dialog-actions"><button className="secondary" onClick={()=>setModal(null)}>继续比赛</button><button className="primary" onClick={leave}>确认返回</button></div></Modal>}
    {modal==='history'&&<Modal title="历史战绩" wide onClose={()=>{setModal(null);setConfirmClear(false);}}><div className="history-summary"><span>累计 <b>{history.length}</b> 场</span><span>获胜 <b>{wins}</b> 场</span><span>失败 <b>{history.length-wins}</b> 场</span><span>胜率 <b>{history.length?Math.round(wins/history.length*100):0}%</b></span></div>{!history.length?<div className="empty-history"><History size={35}/><h3>暂无历史记录</h3><p>完成第一场挑战，留下你的精彩战绩。</p></div>:<div className="history-list">{history.map(m=><article className="history-match" key={m.id}><button className="history-match-heading" aria-expanded={expanded===m.id} onClick={()=>setExpanded(expanded===m.id?null:m.id)}><span className={`history-trophy ${m.playerScore===m.target?'win':'loss'}`}><Trophy size={19}/></span><span><b>{m.playerScore===m.target?'挑战胜利':'挑战失败'}<small>{m.difficulty==='easy'?'简单模式':'困难模式'} · {MODES[m.target]}</small></b><time>{new Date(m.endedAt!).toLocaleString('zh-CN',{hour12:false})}</time></span><strong>{m.playerScore} : {m.aiScore}</strong><ChevronRight className={expanded===m.id?'rotate':''} size={18}/></button>{expanded===m.id&&<div className="history-details"><p>共 {m.rounds.length} 回合 · 玩家获胜 {m.playerScore} 次 · AI 获胜 {m.aiScore} 次 · 平局 {m.rounds.filter(r=>r.result==='draw').length} 次</p><RoundHistory rounds={m.rounds}/></div>}</article>)}</div>}<div className="history-bottom"><span>保存在此浏览器中，不上传云端</span><button className="danger-button" onClick={()=>setConfirmClear(true)}><Trash2 size={16}/>清空历史记录</button></div>{confirmClear&&<Modal title="确认清空全部历史记录？" onClose={()=>setConfirmClear(false)}><div className="clear-confirm"><b>此操作无法撤销</b><p>所有历史比赛和累计战绩将永久删除。当前比赛不受影响。</p><div className="dialog-actions"><button className="secondary" onClick={()=>setConfirmClear(false)}>取消</button><button className="danger-button" onClick={clear}>确认清空</button></div></div></Modal>}</Modal>}
  </div>;
}
