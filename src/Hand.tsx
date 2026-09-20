import { type Move } from './engine';
export default function Hand({ move, className = '' }: { move: Move; className?: string }) {
  return <svg className={`hand-art ${className}`} viewBox="0 0 100 100" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    {move === 'rock' && <><path fill="currentColor" fillOpacity=".1" d="M26 72 18 55V36q0-9 8-9 8 0 8 8v-9q0-8 8-8t8 8v-3q0-8 8-8t8 8v5q1-7 8-7t8 9v26q0 12-9 22v8H32V75Z"/><path d="M34 36v14m16-24v22m16-20v22M21 51l14-6q7-2 11 5l9 14M32 77h39"/></>}
    {move === 'scissors' && <><path fill="currentColor" fillOpacity=".1" d="m34 49-9-29q-3-8 4-11 7-3 10 5l13 28 9-29q3-9 10-6 7 2 5 10L67 50q10 0 11 8v11q-1 9-9 15v5H35V78q-12-11-12-22 0-9 7-10l15 6q8 3 5 11l-13-3"/><path d="m51 47 10 5q6 4 3 11m3-13-7-4M37 80h30"/></>}
    {move === 'paper' && <><path fill="currentColor" fillOpacity=".1" d="M29 55V23q0-7 6-7t6 7v25-34q0-7 7-7t7 7v34-30q0-7 6-7t6 7v32-23q0-7 6-7t6 7v37q0 13-12 21v5H36v-9L17 56q-5-7 1-11 5-4 10 3l9 11"/><path d="M40 79h24"/></>}
  </g></svg>;
}
