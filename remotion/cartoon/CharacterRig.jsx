import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

const EXPRESSIONS = {
  neutral: { brow: 'M206 214 Q226 205 245 214 M276 214 Q296 205 316 214', mouth: 'M238 278 Q261 287 284 278' },
  happy: { brow: 'M206 211 Q226 201 245 211 M276 211 Q296 201 316 211', mouth: 'M232 270 Q261 313 290 270 Q261 288 232 270' },
  sad: { brow: 'M206 219 Q226 199 245 216 M276 216 Q296 199 316 219', mouth: 'M237 293 Q261 270 285 293' },
  angry: { brow: 'M204 221 L246 207 M276 207 L318 221', mouth: 'M239 289 Q261 278 283 289' },
  surprised: { brow: 'M205 198 Q226 188 246 198 M276 198 Q296 188 317 198', mouth: 'M250 267 Q261 258 272 267 Q278 291 261 296 Q244 291 250 267' },
  scared: { brow: 'M205 198 Q226 184 246 201 M276 201 Q296 184 317 198', mouth: 'M247 279 Q261 267 275 279 Q279 303 261 306 Q243 303 247 279' },
  confused: { brow: 'M207 212 Q226 198 245 211 M278 207 Q299 207 316 201', mouth: 'M242 283 Q263 273 282 282' }
};

const PALETTE = {
  skin: '#8B4F35',
  skinLight: '#A96547',
  skinShadow: '#673722',
  hair: '#17151B',
  hairLight: '#30252A',
  hoodie: '#1769AA',
  hoodieLight: '#3287C8',
  hoodieDark: '#104B80',
  trousers: '#26364A',
  shoe: '#F5F1E9',
  sole: '#D5D9DF',
  outline: '#30242A'
};

/**
 * Reusable, layered SVG character rig.
 * Parts are deliberately separate groups so future rigs can swap artwork
 * without changing the animation API.
 */
export function CharacterRig({
  character = {},
  expression = 'neutral',
  pose = 'standing',
  action = 'idle',
  speaking = false,
  animate = true,
  scale = 1,
  x = 0,
  y = 0,
  style = {}
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = { ...PALETTE, ...(character.palette || {}) };
  const face = EXPRESSIONS[expression] || EXPRESSIONS.neutral;
  const t = animate ? frame / fps : 0;
  const walk = action === 'walk' || action === 'run' || pose === 'walking';
  const runMultiplier = action === 'run' ? 1.65 : 1;
  const gait = walkCycle * runMultiplier;
  const talk = speaking || action === 'talk';
  const bob = animate && action === 'idle' ? Math.sin(t * 2.6) * (action === 'idle' ? 2.2 : 0.8) : 0;
  const walkCycle = walk && animate ? Math.sin(t * Math.PI * (action === 'run' ? 6 : 4)) : 0;
  const armWave = action === 'wave' && animate ? Math.sin(t * 5) * 17 : 0;
  const mouthOpen = talk && animate ? (Math.sin(frame * 0.85) > 0.12 ? 1 : 0) : 0;
  const blink = animate && (frame % Math.max(1, Math.round(fps * 3.7)) < 4);
  const sitting = pose === 'sitting';
  const pointing = pose === 'pointing' || action === 'point';
  const waving = pose === 'waving' || action === 'wave';

  const leftLeg = sitting
    ? 'M218 505 Q207 555 171 572 L130 572 Q115 572 117 590 L244 590 Q266 581 255 561 L246 510 Z'
    : `M216 496 Q210 554 202 625 L184 654 Q178 670 195 675 L249 675 Q261 666 253 650 L268 510 Z`;
  const rightLeg = sitting
    ? 'M278 505 Q298 550 333 566 L374 566 Q389 566 388 584 L269 592 Q247 584 251 562 L251 510 Z'
    : `M275 496 Q287 552 303 625 L320 654 Q326 670 309 675 L255 675 Q243 666 251 650 L242 510 Z`;

  return (
    <svg viewBox="0 0 500 760" width="100%" height="100%" role="img" aria-label={character.name || 'Cartoon character'} style={{ overflow: 'visible', ...style }}>
      <g transform={`translate(${x} ${y + bob}) scale(${scale})`} stroke={p.outline} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        {/* Rear legs and shoes */}
        <g id="legs" fill={p.trousers}>
          <path d={leftLeg} transform={walk ? `rotate(${walkCycle * 24} 240 500)` : 'rotate(0 240 500)'} />
          <path d={rightLeg} transform={walk ? `rotate(${-walkCycle * 24} 260 500)` : 'rotate(0 260 500)'} />
          <path d={sitting ? 'M119 574 Q91 576 91 601 L91 612 L197 612 Q207 600 190 589 L153 575 Z' : 'M183 648 Q154 655 151 680 Q150 694 166 697 L238 697 Q252 691 245 677 L221 653 Z'} fill={p.shoe} />
          <path d={sitting ? 'M93 601 H199' : 'M157 683 H244'} stroke={p.sole} strokeWidth="9" fill="none" />
          <path d={sitting ? 'M263 585 Q276 573 302 574 L361 572 Q390 577 393 599 L393 612 L278 612 Q260 604 263 585 Z' : 'M280 649 Q308 655 325 680 Q330 694 314 697 L246 697 Q232 691 239 677 L260 653 Z'} fill={p.shoe} />
          <path d={sitting ? 'M265 601 H390' : 'M239 683 H324'} stroke={p.sole} strokeWidth="9" fill="none" />
        </g>

        {/* Torso */}
        <g id="torso">
          <path d="M184 335 Q194 317 218 312 L304 312 Q330 320 342 348 L365 493 Q369 515 346 520 L154 520 Q133 516 139 493 L160 365 Q165 345 184 335 Z" fill={p.hoodie} />
          <path d="M184 337 Q218 363 261 363 Q306 363 340 337 L326 393 Q293 417 261 417 Q224 417 194 393 Z" fill={p.hoodieLight} stroke="none" />
          <path d="M202 319 Q260 355 319 319" fill="none" stroke={p.hoodieDark} strokeWidth="12" />
          <path d="M261 368 V503" stroke={p.hoodieDark} strokeWidth="5" fill="none" opacity=".7" />
          <path d="M225 440 Q261 455 297 440 L292 475 Q261 490 230 475 Z" fill={p.hoodieDark} stroke="none" opacity=".8" />
          <path d="M237 389 L246 402 M285 389 L276 402" stroke="#D9EAF7" strokeWidth="5" fill="none" />
          <path d="M194 355 Q170 386 167 445" stroke={p.hoodieLight} strokeWidth="12" fill="none" />
        </g>

        {/* Arms are independent transform groups for reusable gestures */}
        <g id="left-arm" transform={pointing ? 'rotate(24 174 354)' : waving ? `rotate(${-armWave - 42} 174 354)` : walk ? `rotate(${walkCycle * 24} 174 354)` : 'rotate(5 174 354)'}>
          <path d="M177 350 Q151 357 144 389 L126 452 Q119 474 139 483 Q158 489 166 468 L190 397 Q200 367 177 350 Z" fill={p.hoodie} />
          <path d="M139 466 Q126 477 132 496 Q139 514 158 505 Q175 498 166 480 Z" fill={p.skin} />
          {pointing && <path d="M137 491 Q112 493 97 481 Q87 473 94 465 Q100 459 111 466 L137 471" fill={p.skin} />}
        </g>
        <g id="right-arm" transform={pointing ? 'rotate(-62 345 354)' : waving ? `rotate(${armWave - 115} 345 354)` : walk ? `rotate(${-walkCycle * 24} 345 354)` : 'rotate(-5 345 354)'}>
          <path d="M324 350 Q350 357 357 389 L375 452 Q382 474 362 483 Q343 489 335 468 L311 397 Q301 367 324 350 Z" fill={p.hoodie} />
          <path d="M361 466 Q374 477 368 496 Q361 514 342 505 Q325 498 334 480 Z" fill={p.skin} />
          {waving && <path d="M350 484 Q343 455 350 435 Q355 424 364 431 Q370 437 364 452 L370 426 Q374 414 384 420 Q392 426 384 443 L389 432 Q397 423 405 431 Q411 438 400 452 L397 471 Q389 495 367 498 Z" fill={p.skin} />}
        </g>

        {/* Neck and hoodie collar */}
        <path d="M235 294 H287 V348 Q260 370 235 348 Z" fill={p.skin} />
        <path d="M207 322 Q260 372 313 322 L294 353 Q260 382 226 353 Z" fill={p.hoodieDark} />

        {/* Head */}
        <g id="head" transform={`rotate(${animate ? Math.sin(t * 1.2) * 1.4 : 0} 261 230)`}>
          <path d="M178 223 Q177 142 261 133 Q345 142 344 223 L337 275 Q326 323 261 330 Q196 323 185 275 Z" fill={p.skin} />
          <path d="M186 239 Q190 170 261 163 Q329 168 336 239 Q329 203 307 192 Q284 182 260 187 Q222 181 193 211 Z" fill={p.skinLight} stroke="none" opacity=".55" />
          <path d="M179 218 Q158 174 188 143 Q201 105 243 115 Q267 88 302 112 Q344 115 351 158 Q367 185 343 223 Q336 180 310 166 Q279 146 250 160 Q213 149 188 192 Z" fill={p.hair} />
          <path d="M187 160 Q184 130 215 126 M224 126 Q244 103 266 123 M279 118 Q309 105 326 137 M330 146 Q350 157 345 184" fill="none" stroke={p.hairLight} strokeWidth="12" />
          <path d="M178 223 Q166 216 164 235 Q163 253 183 255" fill={p.skin} />
          <path d="M344 223 Q356 216 358 235 Q359 253 339 255" fill={p.skin} />
          {/* Ears */}
          <path d="M171 230 Q150 213 151 241 Q154 264 179 263" fill={p.skin} />
          <path d="M351 230 Q372 213 371 241 Q368 264 343 263" fill={p.skin} />
          <path d="M162 239 Q169 232 175 244 M360 239 Q353 232 347 244" fill="none" stroke={p.skinShadow} strokeWidth="4" />

          {/* Eyes and brows */}
          <g id="eyes">
            {blink ? <path d="M207 244 Q226 251 245 244 M277 244 Q296 251 315 244" fill="none" stroke={p.outline} strokeWidth="7" /> : <>
              <ellipse cx="226" cy="244" rx="17" ry="22" fill="#FFFDF8" stroke="none" />
              <ellipse cx="296" cy="244" rx="17" ry="22" fill="#FFFDF8" stroke="none" />
              <ellipse cx="229" cy="247" rx="8" ry="13" fill="#281C1A" stroke="none" />
              <ellipse cx="299" cy="247" rx="8" ry="13" fill="#281C1A" stroke="none" />
              <circle cx="232" cy="241" r="4" fill="#fff" stroke="none" />
              <circle cx="302" cy="241" r="4" fill="#fff" stroke="none" />
            </>}
            <path d={face.brow} fill="none" stroke={p.outline} strokeWidth="8" />
          </g>
          <path d="M258 246 Q247 263 260 269" fill="none" stroke={p.skinShadow} strokeWidth="5" />
          {/* Mouth: the open/closed states are animated from narration timing */}
          {mouthOpen > 0.5
            ? <path d="M240 280 Q261 268 283 280 Q280 307 261 309 Q242 307 240 280 Z" fill="#55242A" stroke={p.outline} strokeWidth="5" />
            : <path d={face.mouth} fill={expression === 'happy' ? '#8F2633' : 'none'} stroke={p.outline} strokeWidth="6" />}
          {expression === 'happy' && <path d="M242 282 Q261 296 280 282" stroke="#FFF0E8" strokeWidth="5" fill="none" />}
          {['sad','scared','surprised'].includes(expression) && <path d="M198 270 Q208 276 216 270 M306 270 Q314 276 324 270" stroke="#C77C67" strokeWidth="4" fill="none" />}
        </g>

        {/* Hoodie front pocket and cuffs */}
        <path d="M214 464 Q261 481 308 464 L302 493 Q261 510 220 493 Z" fill={p.hoodieDark} stroke="none" />
        <path d="M140 466 Q151 476 166 470 M335 470 Q350 476 365 466" stroke={p.hoodieLight} strokeWidth="11" fill="none" />
      </g>
    </svg>
  );
}

export const CHARACTER_EXPRESSIONS = Object.keys(EXPRESSIONS);
export const CHARACTER_POSES = ['standing', 'sitting', 'walking', 'pointing', 'waving'];
