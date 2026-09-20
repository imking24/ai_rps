import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVES, judge, chooseAI, startMatch, submitMove, reveal, nextRound, isMatch } from '../src/engine.ts';

test('all nine matchups use the official rules',()=>{
  const expected=[['draw','win','loss'],['loss','draw','win'],['win','loss','draw']];
  MOVES.forEach((p,i)=>MOVES.forEach((a,j)=>assert.equal(judge(p,a),expected[i][j])));
});
test('a submitted move cannot change the committed AI or be submitted/scored twice',()=>{
  const m=startMatch('hard',2); const committed=m.lockedAI;
  const pending=submitMove(m,'paper');
  assert.equal(pending.lockedAI,committed);
  assert.equal(submitMove(pending,'rock'),pending);
  const result=reveal(pending);
  assert.equal(result.rounds.length,1);
  assert.equal(reveal(result),result);
  assert.equal(submitMove(result,'rock'),result);
  assert.ok(isMatch(result));
});
test('draws are recorded without changing either score or consuming a decisive round',()=>{
  let m=startMatch('easy',2);
  for(let i=0;i<12;i++) {m=reveal(submitMove(m,m.lockedAI));assert.equal(m.phase,'result');assert.equal(m.playerScore+m.aiScore,0);m=nextRound(m);}
  assert.equal(m.rounds.length,12);assert.ok(isMatch(m));
});
for(const target of [2,3,4]) for(const winner of ['player','ai']) test(`${target}-win format ends immediately when ${winner} reaches the target`,()=>{
  const win={rock:'paper',paper:'scissors',scissors:'rock'};
  const lose={rock:'scissors',paper:'rock',scissors:'paper'};
  let m=startMatch('easy',target);
  for(let n=1;n<=target;n++){
    m=reveal(submitMove(m,(winner==='player'?win:lose)[m.lockedAI]));
    assert.ok(isMatch(m));
    assert.equal(m.phase,n===target?'finished':'result');
    if(n<target)m=nextRound(m);
  }
  assert.equal(m[winner==='player'?'playerScore':'aiScore'],target);
  assert.equal(nextRound(m),m);assert.equal(submitMove(m,'rock'),m);
});
test('easy never consults history, hard falls back with insufficient data',()=>{
  const forbidden=new Proxy([],{get(){throw Error('Easy read history');}});
  assert.equal(chooseAI('easy',forbidden,()=> 'scissors'),'scissors');
  assert.equal(chooseAI('hard',[],()=> 'paper'),'paper');
});
test('hard counters repeated historical moves and keeps exploration',()=>{
  const history=Array.from({length:6},(_,i)=>({number:i+1,player:'rock',ai:'rock',result:'draw',playerScore:0,aiScore:0}));
  assert.equal(chooseAI('hard',history,()=> 'scissors',()=>.5),'paper');
  assert.equal(chooseAI('hard',history,()=> 'scissors',()=>.1),'scissors');
});
test('invalid persisted scores, unfinished winners, and edited round results are rejected',()=>{
  const m=startMatch('easy',3);
  assert.ok(isMatch(JSON.parse(JSON.stringify(m))));
  assert.equal(isMatch({...m,playerScore:3}),false);
  assert.equal(isMatch({...m,phase:'finished'}),false);
  const r=reveal(submitMove(m,m.lockedAI));
  assert.equal(isMatch({...r,rounds:[{...r.rounds[0],result:'win'}]}),false);
});
