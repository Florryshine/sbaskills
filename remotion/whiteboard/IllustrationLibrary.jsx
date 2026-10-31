'use client';

import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

function Reveal({ progress, children, stroke = '#173f68', width = 7 }) {
  return <g fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray="1200" strokeDashoffset={interpolate(progress, [0, 1], [1200, 0], clamp)}>
    {children}
  </g>;
}

function Plant({ p, frame, accent }) {
  return <>
    <Reveal progress={p}><path d="M500 590 C490 490 500 390 500 270 C500 205 480 150 450 110 M500 360 C430 330 360 270 335 205 M500 420 C575 365 650 300 675 220 M500 500 C430 500 370 530 330 580 M500 500 C570 500 635 535 680 585" /></Reveal>
    <g opacity={p}>
      <path d="M450 110 C365 35 290 95 335 205 C395 215 445 180 450 110Z" fill="#9bcf8a" stroke="#28764a" strokeWidth="7"/>
      <path d="M335 205 Q390 145 450 110 M675 220 C745 125 830 170 800 275 C735 295 685 270 675 220Z" fill="#a9d99a" stroke="#28764a" strokeWidth="7"/>
      <path d="M675 220 Q735 210 800 275 M500 270 C420 190 435 115 500 80 C565 115 580 190 500 270Z" fill="#77bd78" stroke="#28764a" strokeWidth="7"/>
      <path d="M500 270 L500 590 M500 360 L390 230 M500 420 L690 260" fill="none" stroke="#28764a" strokeWidth="5"/>
      <path d="M500 590 Q445 625 390 640 M500 590 Q550 625 610 642 M500 590 Q480 640 470 665" fill="none" stroke="#a87948" strokeWidth="8" strokeLinecap="round"/>
      <g fill="#e7ad34" opacity={interpolate(Math.sin(frame/8),[-1,1],[.45,1])}><circle cx="115" cy="105" r="34"/><path d="M115 50 V25 M115 185 V160 M60 105 H35 M195 105 H170" stroke="#e7ad34" strokeWidth="8"/></g>
      <path d="M160 155 Q245 160 310 185" stroke={accent} strokeWidth="7" strokeDasharray="12 14" fill="none"/>
    </g>
  </>;
}

function Atom({ p, frame, accent }) {
 const electron = (cx,cy,rx,ry,angle) => [cx+Math.cos(angle)*rx,cy+Math.sin(angle)*ry];
 const e1=electron(500,350,210,100,frame/12), e2=electron(500,350,100,210,-frame/15);
 return <>
  <Reveal progress={p}><ellipse cx="500" cy="350" rx="210" ry="100"/><ellipse cx="500" cy="350" rx="100" ry="210" transform="rotate(55 500 350)"/></Reveal>
  <g opacity={p}><circle cx="500" cy="350" r="48" fill="#e7ad34" stroke="#9c6b13" strokeWidth="7"/><circle cx="480" cy="340" r="15" fill="#fff4c9"/><circle cx="520" cy="360" r="15" fill="#d86b54"/></g>
  <g opacity={p}><circle cx={e1[0]} cy={e1[1]} r="17" fill={accent}/><circle cx={e2[0]} cy={e2[1]} r="17" fill="#25845d"/></g>
 </>;
}

function Cell({ p, accent }) {
 return <>
  <Reveal progress={p}><path d="M170 350 C170 205 300 105 500 115 C700 120 835 220 825 365 C815 520 680 610 485 590 C295 580 165 505 170 350Z"/><path d="M205 350 C205 230 325 145 500 150 C675 155 790 240 790 365 C790 490 660 555 485 550 C315 545 205 470 205 350Z"/></Reveal>
  <g opacity={p}><ellipse cx="485" cy="350" rx="100" ry="82" fill="#d8c5ed" stroke="#76539a" strokeWidth="7"/><circle cx="510" cy="350" r="24" fill="#76539a"/>{[[330,275],[620,260],[640,430],[340,445],[720,350]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="38" ry="18" fill={i%2? '#e7ad34':'#83b9a0'} stroke="#427e69" strokeWidth="5" transform={`rotate(${i*24} ${x} ${y})`}/>)}</g>
  <path d="M280 185 Q350 130 420 160" stroke={accent} strokeWidth="7" fill="none" opacity={p}/>
 </>;
}

function Chloroplast({ p }) {
 return <>
  <Reveal progress={p}><path d="M180 350 C180 210 310 125 500 130 C690 135 820 220 820 350 C820 485 690 565 500 570 C310 575 180 485 180 350Z"/></Reveal>
  <g opacity={p}><path d="M255 270 Q500 230 745 270 M245 350 Q500 310 755 350 M255 430 Q500 390 745 430" stroke="#28764a" strokeWidth="8" fill="none"/>{[0,1,2,3,4].map(i=><g key={i} transform={`translate(${300+i*95} 0)`}><rect x="-23" y="235" width="46" height="75" rx="12" fill="#9bcf8a" stroke="#28764a" strokeWidth="5"/><rect x="-23" y="315" width="46" height="75" rx="12" fill="#9bcf8a" stroke="#28764a" strokeWidth="5"/><rect x="-23" y="395" width="46" height="65" rx="12" fill="#9bcf8a" stroke="#28764a" strokeWidth="5"/></g>)}</g>
 </>;
}

export function WhiteboardIllustration({ type, accent = '#e1a82b' }) {
 const frame = useCurrentFrame();
 const { fps } = useVideoConfig();
 const duration = Math.max(1, fps * 2.6);
 const progress = interpolate(frame, [0, duration], [0, 1], clamp);
 if (type === 'plant') return <Plant p={progress} frame={frame} accent={accent}/>;
 if (type === 'atom') return <Atom p={progress} frame={frame} accent={accent}/>;
 if (type === 'cell') return <Cell p={progress} accent={accent}/>;
 if (type === 'chloroplast') return <Chloroplast p={progress}/>;
 return null;
}
