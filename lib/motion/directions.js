// Visual direction catalog for the Motion Graphics Engine.
//
// The engine interprets a script, classifies its domain, and selects a full
// visual language: palette, typography, shape vocabulary, particle system,
// lighting, transitions, camera moves, motion personality, music kit and
// SFX kit. These are examples of a design system, NOT fixed templates:
// every video also gets seeded variation (variant choice, scene layouts,
// animation recipes) so two videos on the same subject still differ.

import { Rng } from './random.js';

// ---------------------------------------------------------------------------
// Domain classification — weighted keyword evidence.
export const DOMAINS = [
  'technology', 'money', 'science', 'danger', 'motivation',
  'education', 'health', 'history', 'environment', 'people', 'generic',
];

const DOMAIN_KEYWORDS = {
  technology: {
    strong: ['ai', 'artificial intelligence', 'robot', 'robotics', 'machine learning', 'data', 'algorithm', 'software', 'app', 'code', 'coding', 'cyber', 'digital', 'internet', 'cloud', 'server', 'network', 'computer', 'tech', 'technology', 'automation', 'chip', 'quantum', 'blockchain', 'crypto', 'drone', 'startup', 'innovation', 'smart', 'api', 'database', 'photon', 'silicon', 'hologram', 'virtual'],
    weak: ['future', 'system', 'device', 'screen', 'online', 'electronic', 'machine', 'program', 'engineer', 'predict', 'compute', 'model', 'training', 'neural', 'prompt', 'generative'],
  },
  money: {
    strong: ['money', 'cash', 'profit', 'revenue', 'income', 'salary', 'invest', 'investment', 'investing', 'bank', 'banking', 'budget', 'savings', 'save money', 'wealth', 'rich', 'financial', 'finance', 'stock', 'stocks', 'market', 'trading', 'naira', 'dollar', 'dollars', 'currency', 'loan', 'debt', 'interest', 'compound', 'tax', 'taxes', 'price', 'cost', 'sell', 'sales', 'business', 'entrepreneur', 'customer', 'ecommerce', 'payment', 'capital', 'fund', 'funding', 'million', 'billion'],
    weak: ['grow', 'growth', 'value', 'economy', 'economic', 'spend', 'spending', 'buy', 'pay', 'earn', 'earning', 'shop', 'commerce', 'account', 'net worth', 'asset', 'assets', 'portfolio', 'dividend', 'inflation'],
  },
  science: {
    strong: ['atom', 'molecule', 'physics', 'chemistry', 'biology', 'cell', 'dna', 'gene', 'orbit', 'planet', 'star', 'stars', 'galaxy', 'universe', 'space', 'cosmos', 'cosmic', 'asteroid', 'comet', 'nasa', 'rocket', 'satellite', 'mars', 'moon', 'sun', 'solar', 'gravity', 'energy', 'particle', 'quantum', 'neutron', 'electron', 'light year', 'black hole', 'nebula', 'eclipse', 'astronaut', 'spacecraft', 'telescope', 'organism', 'bacteria', 'virus', 'protein', 'enzyme', 'photosynthesis', 'evolution', 'species', 'ecosystem', 'reaction', 'experiment', 'laboratory', 'hypothesis', 'research'],
    weak: ['discovery', 'discover', 'scientist', 'theory', 'law of', 'force', 'mass', 'speed of light', 'wave', 'magnetic', 'electric', 'radiation', 'element', 'compound', 'cell', 'mind', 'brain', 'memory', 'neuron'],
  },
  danger: {
    strong: ['danger', 'dangerous', 'warning', 'risk', 'risky', 'threat', 'threats', 'hazard', 'toxic', 'poison', 'attack', 'hack', 'hacker', 'scam', 'scammer', 'scammers', 'fraud', 'fraudster', 'unsafe', 'emergency', 'crisis', 'disaster', 'accident', 'injury', 'death', 'deadly', 'kill', 'violence', 'war', 'conflict', 'exploit', 'malware', 'phishing', 'kidnap', 'boom', 'collapse', 'steal', 'steals', 'stole', 'stealing', 'trick', 'tricks', 'trap', 'otp', 'bank details', 'password', 'never share', 'beware of'],
    weak: ['careful', 'caution', 'safe', 'safety', 'protect', 'guard', 'alert', 'alarm', 'fear', 'panic', 'loss', 'destroy', 'damage', 'harm', 'hurt', 'burn', 'fall', 'crash', 'beware', 'avoid', 'fail', 'failure', 'mistake', 'stop', 'never'],
  },
  motivation: {
    strong: ['motivation', 'motivated', 'inspire', 'inspiration', 'inspiring', 'dream', 'dreams', 'believe', 'success', 'successful', 'mindset', 'discipline', 'consistency', 'habit', 'habits', 'goal', 'goals', 'focus', 'purpose', 'confidence', 'brave', 'courage', 'never give up', 'keep going', 'push', 'hustle', 'win', 'winning', 'champion', 'greatness', 'excellence', 'improve yourself', 'self improvement', 'growth mindset', 'affirmation', 'affirmations', 'potential', 'achieve', 'achievement'],
    weak: ['you', 'your', 'today', 'start', 'begin', 'choice', 'change', 'better', 'strong', 'strength', 'power', 'future self', 'journey', 'step', 'daily', 'practice', 'effort', 'progress'],
  },
  education: {
    strong: ['learn', 'learning', 'lesson', 'study', 'studying', 'student', 'students', 'school', 'class', 'classroom', 'teacher', 'exam', 'exams', 'waec', 'jamb', 'neco', 'test', 'revision', 'note', 'notes', 'topic', 'syllabus', 'curriculum', 'homework', 'assignment', 'grade', 'grades', 'university', 'college', 'campus', 'lecture', 'tutorial', 'explain', 'explained', 'understand', 'definition', 'meaning', 'example', 'examples', 'formula', 'equation', 'practice question', 'past question', 'quiz'],
    weak: ['remember', 'memorize', 'knowledge', 'skill', 'skills', 'subject', 'mathematics', 'english', 'physics class', 'chemistry class', 'biology class', 'chapter', 'module', 'course', 'answer', 'solve', 'solution'],
  },
  health: {
    strong: ['health', 'healthy', 'body', 'fitness', 'exercise', 'workout', 'sleep', 'diet', 'nutrition', 'food', 'water', 'hygiene', 'disease', 'illness', 'sickness', 'symptom', 'symptoms', 'doctor', 'hospital', 'medicine', 'medication', 'immunity', 'immune', 'heart', 'blood', 'pressure', 'stress', 'anxiety', 'mental health', 'wellbeing', 'well-being', 'malaria', 'hydration', 'vitamin', 'protein intake', 'calorie', 'calories'],
    weak: ['energy', 'rest', 'balance', 'lifestyle', 'habit loop', 'routine', 'brain fog', 'recovery', 'stretch', 'breathing', 'mindful'],
  },
  history: {
    strong: ['history', 'historical', 'ancient', 'empire', 'century', 'centuries', 'civilization', 'civilisation', 'war of', 'revolution', 'independence', 'colonial', 'colonies', 'era', 'dynasty', 'kingdom', 'treaty', 'movement', 'pioneer', 'legacy', 'heritage', 'tradition', 'founding', 'timeline', 'decade', 'medieval', 'origin', 'origins', 'archive'],
    weak: ['year', 'years ago', 'began', 'founded', 'leader', 'president', 'king', 'queen', 'battle', 'nation', 'country story', 'born', 'died', 'memorial'],
  },
  environment: {
    strong: ['climate', 'environment', 'environmental', 'planet earth', 'nature', 'forest', 'deforestation', 'ocean', 'plastic', 'pollution', 'waste', 'recycle', 'recycling', 'carbon', 'emission', 'emissions', 'global warming', 'renewable', 'solar panel', 'sustainable', 'sustainability', 'biodiversity', 'wildlife', 'conservation', 'flood', 'erosion', 'drought', 'ecosystem loss'],
    weak: ['green', 'eco', 'earth', 'tree', 'trees', 'air', 'water cycle', 'weather', 'season', 'rainfall', 'farm', 'farming', 'soil'],
  },
  people: {
    strong: ['people', 'person', 'community', 'family', 'friend', 'friends', 'team', 'teamwork', 'leadership', 'culture', 'society', 'story', 'story of', 'biography', 'life of', 'hero', 'heroes', 'mentor', 'relationship', 'friendship', 'kindness', 'respect', 'together', 'human', 'humans', 'childhood', 'parents'],
    weak: ['someone', 'everyone', 'anyone', 'voice', 'listen', 'share', 'help', 'support', 'care for', 'belong', 'identity'],
  },
};

export function classifyDomain(text) {
  const hay = ' ' + String(text || '').toLowerCase().replace(/[\n\r]+/g, ' ') + ' ';
  const scores = {};
  for (const [domain, groups] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of groups.strong) {
      const occurrences = hay.split(kw).length - 1;
      if (occurrences) score += Math.min(occurrences, 2) * 3;
    }
    for (const kw of groups.weak) {
      const occurrences = hay.split(kw).length - 1;
      if (occurrences) score += Math.min(occurrences, 3);
    }
    scores[domain] = score;
  }
  let best = 'generic';
  let bestScore = 1; // below this, generic wins
  for (const [domain, score] of Object.entries(scores)) {
    if (score > bestScore) { best = domain; bestScore = score; }
  }
  return { domain: best, scores, confidence: bestScore };
}

// ---------------------------------------------------------------------------
// Mood/emotion modifiers extracted from the text itself.
const MOOD_SIGNALS = {
  urgent: ['now', 'today', 'immediately', 'urgent', 'fast', 'quick', 'hurry', 'deadline', 'before it', 'running out'],
  dramatic: ['secret', 'truth', 'dark', 'hidden', 'shocking', 'untold', 'everyone knows', 'nobody', 'warning', 'beware', 'never'],
  playful: ['fun', 'funny', 'amazing', 'awesome', 'cool', 'wow', 'guess what', 'surprise', 'lol'],
  calm: ['slow', 'gentle', 'calm', 'peace', 'quiet', 'simple', 'breathe', 'relax', 'step by step'],
  hopeful: ['hope', 'future', 'better', 'bright', 'tomorrow', 'promise', 'opportunity', 'new beginning'],
};

export function classifyMood(text) {
  const hay = ' ' + String(text || '').toLowerCase() + ' ';
  const scores = {};
  for (const [mood, words] of Object.entries(MOOD_SIGNALS)) {
    scores[mood] = words.reduce((acc, w) => acc + (hay.includes(w) ? 1 : 0), 0);
  }
  let best = null;
  let bestScore = 1;
  for (const [mood, score] of Object.entries(scores)) {
    if (score > bestScore) { best = mood; bestScore = score; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// The direction variants. Each is a complete visual language.
// palette: bg background, bgAlt secondary background, ink main text,
// inkSoft secondary text, accent / accent2 highlights, glow bloom color.
// typography.display / typography.body are font families bundled in
// public/fonts and registered by remotion/motion/fonts.js.
export const DIRECTION_VARIANTS = {
  technology: [
    {
      id: 'circuit-grid', label: 'Circuit Grid', mood: 'technical',
      palette: { bg: '#050B1A', bgAlt: '#0A1428', ink: '#E8F1FF', inkSoft: '#7E93B8', accent: '#22D3EE', accent2: '#60A5FA', glow: '#22D3EE', dark: true },
      typography: { display: 'Space Mono', body: 'Rajdhani', displayCase: 'upper', tracking: 0.02, numericMono: true },
      shapes: ['grid', 'nodes', 'lines', 'brackets'], particles: 'dust',
      light: { beams: 0.4, flashOnCut: 0.25, grain: 0.08, vignette: 0.4, scanlines: true },
      transitions: ['glitchSlide', 'wipe', 'push', 'scaleCut'],
      camera: ['pushIn', 'drift', 'panRight'],
      motion: { personality: 'technical', energy: 0.65, staggerBase: 0.05, holdBias: 0.55, ease: 'expoOut' },
      musicKit: 'tech', sfxKit: ['tick', 'whoosh', 'impact', 'shimmer'],
    },
    {
      id: 'neon-lab', label: 'Neon Lab', mood: 'futuristic',
      palette: { bg: '#0B0217', bgAlt: '#160A2E', ink: '#F3EBFF', inkSoft: '#A78BC0', accent: '#E879F9', accent2: '#A3E635', glow: '#E879F9', dark: true },
      typography: { display: 'Rajdhani', body: 'Space Mono', displayCase: 'upper', tracking: 0.06, numericMono: true },
      shapes: ['rings', 'beams', 'polygons', 'waveform'], particles: 'sparks',
      light: { beams: 0.85, flashOnCut: 0.45, grain: 0.12, vignette: 0.5, scanlines: false },
      transitions: ['flashCut', 'push', 'iris', 'glitchSlide'],
      camera: ['zoomPunch', 'pushIn', 'drift'],
      motion: { personality: 'futuristic', energy: 0.8, staggerBase: 0.04, holdBias: 0.45, ease: 'backOut' },
      musicKit: 'tech', sfxKit: ['riser', 'impact', 'glitch', 'whoosh'],
    },
    {
      id: 'paper-schematic', label: 'Paper Schematic', mood: 'editorial-technical',
      palette: { bg: '#F4F5F2', bgAlt: '#E7EAE4', ink: '#101418', inkSoft: '#5A6472', accent: '#2563EB', accent2: '#0F766E', glow: '#93C5FD', dark: false },
      typography: { display: 'Archivo Black', body: 'Space Mono', displayCase: 'none', tracking: 0, numericMono: true },
      shapes: ['grid', 'lines', 'arrows', 'dots'], particles: 'none',
      light: { beams: 0, flashOnCut: 0, grain: 0.05, vignette: 0.15, scanlines: false },
      transitions: ['wipe', 'push', 'scaleCut', 'split'],
      camera: ['panRight', 'pushIn', 'drift'],
      motion: { personality: 'editorial', energy: 0.45, staggerBase: 0.07, holdBias: 0.65, ease: 'quintOut' },
      musicKit: 'chill', sfxKit: ['tick', 'pop', 'whoosh'],
    },
  ],
  money: [
    {
      id: 'gold-ledger', label: 'Gold Ledger', mood: 'prosperous',
      palette: { bg: '#071108', bgAlt: '#0C2412', ink: '#F2F7EC', inkSoft: '#8FA98B', accent: '#F5C542', accent2: '#34D399', glow: '#F5C542', dark: true },
      typography: { display: 'Archivo Black', body: 'Poppins', displayCase: 'upper', tracking: 0.01, numericMono: false },
      shapes: ['bars', 'coins', 'rings', 'arrows'], particles: 'sparks',
      light: { beams: 0.5, flashOnCut: 0.4, grain: 0.1, vignette: 0.45, scanlines: false },
      transitions: ['push', 'wipe', 'flashCut', 'scaleCut'],
      camera: ['pushIn', 'zoomPunch', 'panRight'],
      motion: { personality: 'energetic', energy: 0.85, staggerBase: 0.045, holdBias: 0.4, ease: 'expoOut' },
      musicKit: 'pulse', sfxKit: ['impact', 'tick', 'riser', 'shimmer'],
    },
    {
      id: 'neon-ticker', label: 'Neon Ticker', mood: 'fast-trading',
      palette: { bg: '#01110F', bgAlt: '#03211C', ink: '#E9FFF7', inkSoft: '#6FA79A', accent: '#00E68C', accent2: '#38BDF8', glow: '#00E68C', dark: true },
      typography: { display: 'Space Mono', body: 'Rajdhani', displayCase: 'upper', tracking: 0.03, numericMono: true },
      shapes: ['lines', 'grid', 'counters', 'ticker'], particles: 'dust',
      light: { beams: 0.35, flashOnCut: 0.5, grain: 0.12, vignette: 0.4, scanlines: true },
      transitions: ['glitchSlide', 'flashCut', 'push', 'wipe'],
      camera: ['zoomPunch', 'drift', 'pushIn'],
      motion: { personality: 'fast', energy: 0.95, staggerBase: 0.032, holdBias: 0.35, ease: 'expoOut' },
      musicKit: 'tech', sfxKit: ['tick', 'whoosh', 'impact', 'glitch'],
    },
    {
      id: 'mint-editorial', label: 'Mint Editorial', mood: 'trusted-advisory',
      palette: { bg: '#FAF7F0', bgAlt: '#EFE9DC', ink: '#12261B', inkSoft: '#5E7263', accent: '#0E9F6E', accent2: '#B7791F', glow: '#A7F3D0', dark: false },
      typography: { display: 'DM Serif Display', body: 'Poppins', displayCase: 'none', tracking: 0, numericMono: false },
      shapes: ['lines', 'coins', 'arrows', 'dots'], particles: 'none',
      light: { beams: 0.2, flashOnCut: 0.05, grain: 0.06, vignette: 0.2, scanlines: false },
      transitions: ['wipe', 'split', 'push', 'scaleCut'],
      camera: ['pushIn', 'drift', 'panRight'],
      motion: { personality: 'editorial', energy: 0.5, staggerBase: 0.075, holdBias: 0.6, ease: 'quintOut' },
      musicKit: 'chill', sfxKit: ['pop', 'tick', 'shimmer'],
    },
  ],
  science: [
    {
      id: 'deep-space', label: 'Deep Space', mood: 'cosmic-awe',
      palette: { bg: '#030614', bgAlt: '#0A1030', ink: '#EAF0FF', inkSoft: '#8291B5', accent: '#A78BFA', accent2: '#7DD3FC', glow: '#A78BFA', dark: true },
      typography: { display: 'Space Mono', body: 'Poppins', displayCase: 'upper', tracking: 0.04, numericMono: true },
      shapes: ['orbits', 'rings', 'stars', 'lines'], particles: 'stars',
      light: { beams: 0.55, flashOnCut: 0.2, grain: 0.1, vignette: 0.55, scanlines: false },
      transitions: ['iris', 'push', 'wipe', 'scaleCut'],
      camera: ['pushIn', 'drift', 'panUp'],
      motion: { personality: 'cinematic', energy: 0.5, staggerBase: 0.07, holdBias: 0.6, ease: 'quintOut' },
      musicKit: 'cinematic', sfxKit: ['shimmer', 'riser', 'impact', 'whoosh'],
    },
    {
      id: 'biolume', label: 'Bioluminescent Lab', mood: 'curious',
      palette: { bg: '#02120F', bgAlt: '#06302A', ink: '#E8FFF8', inkSoft: '#7FB3A6', accent: '#2DD4BF', accent2: '#A3E635', glow: '#2DD4BF', dark: true },
      typography: { display: 'Poppins', body: 'Space Mono', displayCase: 'none', tracking: 0.01, numericMono: true },
      shapes: ['blobs', 'cells', 'rings', 'lines'], particles: 'bubbles',
      light: { beams: 0.45, flashOnCut: 0.15, grain: 0.08, vignette: 0.5, scanlines: false },
      transitions: ['wipe', 'iris', 'push', 'split'],
      camera: ['drift', 'pushIn', 'panRight'],
      motion: { personality: 'smooth', energy: 0.55, staggerBase: 0.06, holdBias: 0.55, ease: 'quintOut' },
      musicKit: 'chill', sfxKit: ['shimmer', 'pop', 'whoosh', 'riser'],
    },
    {
      id: 'lab-annotated', label: 'Annotated Lab', mood: 'explainer',
      palette: { bg: '#F6F7FB', bgAlt: '#E9EDF6', ink: '#111827', inkSoft: '#5B6474', accent: '#4F46E5', accent2: '#0EA5E9', glow: '#C7D2FE', dark: false },
      typography: { display: 'Space Mono', body: 'Poppins', displayCase: 'none', tracking: 0, numericMono: true },
      shapes: ['brackets', 'arrows', 'dots', 'grid'], particles: 'none',
      light: { beams: 0, flashOnCut: 0, grain: 0.04, vignette: 0.12, scanlines: false },
      transitions: ['wipe', 'push', 'scaleCut', 'split'],
      camera: ['panRight', 'pushIn', 'drift'],
      motion: { personality: 'technical', energy: 0.5, staggerBase: 0.07, holdBias: 0.6, ease: 'expoOut' },
      musicKit: 'chill', sfxKit: ['tick', 'pop', 'whoosh'],
    },
  ],
  danger: [
    {
      id: 'hazard-strike', label: 'Hazard Strike', mood: 'urgent-alert',
      palette: { bg: '#0A0A0A', bgAlt: '#1A0E0E', ink: '#FAFAFA', inkSoft: '#9C8F8F', accent: '#EF4444', accent2: '#FACC15', glow: '#EF4444', dark: true },
      typography: { display: 'Archivo Black', body: 'Rajdhani', displayCase: 'upper', tracking: 0.02, numericMono: false },
      shapes: ['stripes', 'triangles', 'slashes', 'grid'], particles: 'embers',
      light: { beams: 0.5, flashOnCut: 0.7, grain: 0.14, vignette: 0.5, scanlines: false },
      transitions: ['flashCut', 'glitchSlide', 'shatter', 'push'],
      camera: ['zoomPunch', 'pushIn', 'shakeLight'],
      motion: { personality: 'dramatic', energy: 0.9, staggerBase: 0.03, holdBias: 0.4, ease: 'expoOut' },
      musicKit: 'dark', sfxKit: ['impact', 'riser', 'glitch', 'alarm'],
    },
    {
      id: 'siren-night', label: 'Siren Night', mood: 'tense',
      palette: { bg: '#100C0E', bgAlt: '#1E1417', ink: '#F5EEF0', inkSoft: '#A08E94', accent: '#F43F5E', accent2: '#F8FAFC', glow: '#F43F5E', dark: true },
      typography: { display: 'Bebas Neue', body: 'Space Mono', displayCase: 'upper', tracking: 0.05, numericMono: true },
      shapes: ['rings', 'slashes', 'lines', 'beams'], particles: 'embers',
      light: { beams: 0.7, flashOnCut: 0.55, grain: 0.12, vignette: 0.55, scanlines: false },
      transitions: ['flashCut', 'iris', 'push', 'glitchSlide'],
      camera: ['pushIn', 'zoomPunch', 'drift'],
      motion: { personality: 'cinematic', energy: 0.7, staggerBase: 0.05, holdBias: 0.5, ease: 'expoOut' },
      musicKit: 'dark', sfxKit: ['riser', 'impact', 'alarm', 'whoosh'],
    },
  ],
  motivation: [
    {
      id: 'minimal-bold', label: 'Minimal Bold', mood: 'focused',
      palette: { bg: '#F7F5F0', bgAlt: '#ECE8DF', ink: '#141414', inkSoft: '#6B675E', accent: '#EA580C', accent2: '#141414', glow: '#FDBA74', dark: false },
      typography: { display: 'Archivo Black', body: 'Poppins', displayCase: 'upper', tracking: 0, numericMono: false },
      shapes: ['lines', 'dots', 'arrows'], particles: 'none',
      light: { beams: 0, flashOnCut: 0.08, grain: 0.05, vignette: 0.18, scanlines: false },
      transitions: ['scaleCut', 'wipe', 'push', 'split'],
      camera: ['pushIn', 'drift', 'panRight'],
      motion: { personality: 'minimal', energy: 0.5, staggerBase: 0.08, holdBias: 0.7, ease: 'quintOut' },
      musicKit: 'pulse', sfxKit: ['impact', 'pop', 'whoosh'],
    },
    {
      id: 'sunrise-drive', label: 'Sunrise Drive', mood: 'energetic',
      palette: { bg: '#1D0B2E', bgAlt: '#3B1254', ink: '#FFF7ED', inkSoft: '#D8B4FE', accent: '#FB923C', accent2: '#F472B6', glow: '#FB923C', dark: true },
      typography: { display: 'Bebas Neue', body: 'Poppins', displayCase: 'upper', tracking: 0.03, numericMono: false },
      shapes: ['rays', 'arrows', 'rings', 'triangles'], particles: 'dust',
      light: { beams: 0.8, flashOnCut: 0.35, grain: 0.1, vignette: 0.4, scanlines: false },
      transitions: ['push', 'wipe', 'flashCut', 'scaleCut'],
      camera: ['pushIn', 'zoomPunch', 'panUp'],
      motion: { personality: 'energetic', energy: 0.85, staggerBase: 0.045, holdBias: 0.4, ease: 'backOut' },
      musicKit: 'epic', sfxKit: ['riser', 'impact', 'whoosh', 'shimmer'],
    },
    {
      id: 'mono-focus', label: 'Mono Focus', mood: 'stark',
      palette: { bg: '#0A0A0A', bgAlt: '#161616', ink: '#FAFAFA', inkSoft: '#8A8A8A', accent: '#FFFFFF', accent2: '#E11D48', glow: '#FFFFFF', dark: true },
      typography: { display: 'Anton', body: 'Space Mono', displayCase: 'upper', tracking: 0.02, numericMono: true },
      shapes: ['lines', 'brackets', 'dots'], particles: 'dust',
      light: { beams: 0.3, flashOnCut: 0.3, grain: 0.12, vignette: 0.45, scanlines: false },
      transitions: ['flashCut', 'push', 'glitchSlide', 'scaleCut'],
      camera: ['pushIn', 'zoomPunch', 'drift'],
      motion: { personality: 'dramatic', energy: 0.75, staggerBase: 0.04, holdBias: 0.5, ease: 'expoOut' },
      musicKit: 'dark', sfxKit: ['impact', 'tick', 'riser'],
    },
  ],
  education: [
    {
      id: 'chalk-class', label: 'Chalk Class', mood: 'friendly-teacher',
      palette: { bg: '#152430', bgAlt: '#1E3444', ink: '#F1F7FA', inkSoft: '#9FB6C2', accent: '#FDE047', accent2: '#7DD3FC', glow: '#FDE047', dark: true },
      typography: { display: 'Permanent Marker', body: 'Poppins', displayCase: 'none', tracking: 0, numericMono: false },
      shapes: ['lines', 'circles-sketch', 'arrows-sketch', 'dots'], particles: 'none',
      light: { beams: 0.2, flashOnCut: 0.1, grain: 0.08, vignette: 0.3, scanlines: false },
      transitions: ['wipe', 'push', 'scaleCut', 'split'],
      camera: ['drift', 'pushIn', 'panRight'],
      motion: { personality: 'playful', energy: 0.6, staggerBase: 0.07, holdBias: 0.55, ease: 'backOut' },
      musicKit: 'chill', sfxKit: ['pop', 'tick', 'whoosh', 'shimmer'],
    },
    {
      id: 'bright-academy', label: 'Bright Academy', mood: 'cheerful',
      palette: { bg: '#FDFBF4', bgAlt: '#FFF3D6', ink: '#1E293B', inkSoft: '#64748B', accent: '#2563EB', accent2: '#F59E0B', glow: '#BFDBFE', dark: false },
      typography: { display: 'Poppins', body: 'Poppins', displayCase: 'none', tracking: 0, numericMono: false },
      shapes: ['circles', 'dots', 'arrows', 'lines'], particles: 'confetti',
      light: { beams: 0.15, flashOnCut: 0.08, grain: 0.03, vignette: 0.12, scanlines: false },
      transitions: ['push', 'wipe', 'scaleCut', 'split'],
      camera: ['pushIn', 'panRight', 'drift'],
      motion: { personality: 'playful', energy: 0.65, staggerBase: 0.06, holdBias: 0.5, ease: 'backOut' },
      musicKit: 'bright', sfxKit: ['pop', 'shimmer', 'tick', 'whoosh'],
    },
    {
      id: 'exam-focus', label: 'Exam Focus', mood: 'determined',
      palette: { bg: '#0E1428', bgAlt: '#16203B', ink: '#EDF2FF', inkSoft: '#8C9BC0', accent: '#FACC15', accent2: '#38BDF8', glow: '#FACC15', dark: true },
      typography: { display: 'Anton', body: 'Rajdhani', displayCase: 'upper', tracking: 0.02, numericMono: true },
      shapes: ['counters', 'grid', 'lines', 'brackets'], particles: 'dust',
      light: { beams: 0.35, flashOnCut: 0.3, grain: 0.08, vignette: 0.42, scanlines: false },
      transitions: ['push', 'wipe', 'flashCut', 'scaleCut'],
      camera: ['pushIn', 'zoomPunch', 'panRight'],
      motion: { personality: 'energetic', energy: 0.75, staggerBase: 0.05, holdBias: 0.45, ease: 'expoOut' },
      musicKit: 'pulse', sfxKit: ['impact', 'tick', 'whoosh', 'riser'],
    },
  ],
  health: [
    {
      id: 'vital-pulse', label: 'Vital Pulse', mood: 'alive',
      palette: { bg: '#041416', bgAlt: '#0A2629', ink: '#EAFBF7', inkSoft: '#7FA8A5', accent: '#F97362', accent2: '#2DD4BF', glow: '#F97362', dark: true },
      typography: { display: 'Bebas Neue', body: 'Poppins', displayCase: 'upper', tracking: 0.03, numericMono: true },
      shapes: ['waveform', 'rings', 'lines', 'cells'], particles: 'bubbles',
      light: { beams: 0.4, flashOnCut: 0.25, grain: 0.08, vignette: 0.45, scanlines: false },
      transitions: ['wipe', 'push', 'iris', 'scaleCut'],
      camera: ['pushIn', 'drift', 'panRight'],
      motion: { personality: 'smooth', energy: 0.6, staggerBase: 0.055, holdBias: 0.5, ease: 'quintOut' },
      musicKit: 'pulse', sfxKit: ['impact', 'shimmer', 'tick', 'whoosh'],
    },
    {
      id: 'clean-care', label: 'Clean Care', mood: 'reassuring',
      palette: { bg: '#F4FAF8', bgAlt: '#E1F1EC', ink: '#0F2E28', inkSoft: '#5F7E77', accent: '#0D9488', accent2: '#84CC16', glow: '#99F6E4', dark: false },
      typography: { display: 'Poppins', body: 'Poppins', displayCase: 'none', tracking: 0, numericMono: false },
      shapes: ['circles', 'blobs', 'arrows', 'dots'], particles: 'none',
      light: { beams: 0.1, flashOnCut: 0.05, grain: 0.03, vignette: 0.12, scanlines: false },
      transitions: ['wipe', 'push', 'split', 'scaleCut'],
      camera: ['pushIn', 'drift', 'panRight'],
      motion: { personality: 'smooth', energy: 0.45, staggerBase: 0.075, holdBias: 0.6, ease: 'quintOut' },
      musicKit: 'chill', sfxKit: ['pop', 'shimmer', 'whoosh'],
    },
  ],
  history: [
    {
      id: 'archive-film', label: 'Archive Film', mood: 'nostalgic',
      palette: { bg: '#191210', bgAlt: '#2A1F19', ink: '#F3E9DC', inkSoft: '#A6907C', accent: '#D9A441', accent2: '#B4552D', glow: '#D9A441', dark: true },
      typography: { display: 'DM Serif Display', body: 'Space Mono', displayCase: 'none', tracking: 0.01, numericMono: true },
      shapes: ['lines', 'frames', 'dots', 'tape'], particles: 'dust',
      light: { beams: 0.25, flashOnCut: 0.18, grain: 0.2, vignette: 0.55, scanlines: false },
      transitions: ['wipe', 'push', 'scaleCut', 'iris'],
      camera: ['pushIn', 'drift', 'panRight'],
      motion: { personality: 'cinematic', energy: 0.4, staggerBase: 0.08, holdBias: 0.65, ease: 'quintOut' },
      musicKit: 'cinematic', sfxKit: ['shimmer', 'impact', 'whoosh', 'tick'],
    },
    {
      id: 'timeline-ink', label: 'Timeline Ink', mood: 'documentary',
      palette: { bg: '#F1ECE2', bgAlt: '#E4DCCB', ink: '#221C15', inkSoft: '#6E6250', accent: '#A33B26', accent2: '#3F5D3A', glow: '#E9C46A', dark: false },
      typography: { display: 'DM Serif Display', body: 'Poppins', displayCase: 'none', tracking: 0, numericMono: false },
      shapes: ['lines', 'tape', 'arrows', 'dots'], particles: 'none',
      light: { beams: 0.1, flashOnCut: 0.05, grain: 0.1, vignette: 0.25, scanlines: false },
      transitions: ['wipe', 'push', 'split', 'scaleCut'],
      camera: ['panRight', 'pushIn', 'drift'],
      motion: { personality: 'editorial', energy: 0.45, staggerBase: 0.075, holdBias: 0.6, ease: 'quintOut' },
      musicKit: 'cinematic', sfxKit: ['tick', 'whoosh', 'impact'],
    },
  ],
  environment: [
    {
      id: 'earth-growth', label: 'Earth Growth', mood: 'organic',
      palette: { bg: '#071A10', bgAlt: '#0E301C', ink: '#EFFBF1', inkSoft: '#8FB89B', accent: '#4ADE80', accent2: '#FBBF24', glow: '#4ADE80', dark: true },
      typography: { display: 'Poppins', body: 'Poppins', displayCase: 'none', tracking: 0, numericMono: false },
      shapes: ['blobs', 'leaves', 'rings', 'lines'], particles: 'dust',
      light: { beams: 0.6, flashOnCut: 0.15, grain: 0.07, vignette: 0.45, scanlines: false },
      transitions: ['wipe', 'iris', 'push', 'split'],
      camera: ['drift', 'pushIn', 'panUp'],
      motion: { personality: 'smooth', energy: 0.5, staggerBase: 0.07, holdBias: 0.55, ease: 'quintOut' },
      musicKit: 'chill', sfxKit: ['shimmer', 'pop', 'riser', 'whoosh'],
    },
    {
      id: 'climate-data', label: 'Climate Data', mood: 'evidence',
      palette: { bg: '#07101F', bgAlt: '#0D1B33', ink: '#EAF2FF', inkSoft: '#7C8FB0', accent: '#38BDF8', accent2: '#FB7185', glow: '#38BDF8', dark: true },
      typography: { display: 'Space Mono', body: 'Rajdhani', displayCase: 'upper', tracking: 0.02, numericMono: true },
      shapes: ['bars', 'grid', 'lines', 'counters'], particles: 'dust',
      light: { beams: 0.3, flashOnCut: 0.2, grain: 0.08, vignette: 0.4, scanlines: false },
      transitions: ['push', 'wipe', 'scaleCut', 'glitchSlide'],
      camera: ['pushIn', 'panRight', 'drift'],
      motion: { personality: 'technical', energy: 0.6, staggerBase: 0.055, holdBias: 0.5, ease: 'expoOut' },
      musicKit: 'tech', sfxKit: ['tick', 'impact', 'riser', 'whoosh'],
    },
  ],
  people: [
    {
      id: 'portrait-film', label: 'Portrait Film', mood: 'warm-intimate',
      palette: { bg: '#170F0C', bgAlt: '#2A1B14', ink: '#F8EFE6', inkSoft: '#B39B88', accent: '#F2A65A', accent2: '#E76F51', glow: '#F2A65A', dark: true },
      typography: { display: 'DM Serif Display', body: 'Poppins', displayCase: 'none', tracking: 0, numericMono: false },
      shapes: ['lines', 'dots', 'rings'], particles: 'dust',
      light: { beams: 0.5, flashOnCut: 0.12, grain: 0.12, vignette: 0.5, scanlines: false },
      transitions: ['wipe', 'push', 'iris', 'scaleCut'],
      camera: ['pushIn', 'drift', 'panRight'],
      motion: { personality: 'cinematic', energy: 0.45, staggerBase: 0.075, holdBias: 0.6, ease: 'quintOut' },
      musicKit: 'cinematic', sfxKit: ['shimmer', 'whoosh', 'impact'],
    },
    {
      id: 'community-pop', label: 'Community Pop', mood: 'vibrant',
      palette: { bg: '#12122E', bgAlt: '#22224E', ink: '#F5F7FF', inkSoft: '#9BA3D0', accent: '#FDE047', accent2: '#FB7185', glow: '#FDE047', dark: true },
      typography: { display: 'Bebas Neue', body: 'Poppins', displayCase: 'upper', tracking: 0.03, numericMono: false },
      shapes: ['confetti-shapes', 'rings', 'arrows', 'dots'], particles: 'confetti',
      light: { beams: 0.4, flashOnCut: 0.3, grain: 0.07, vignette: 0.35, scanlines: false },
      transitions: ['push', 'split', 'flashCut', 'wipe'],
      camera: ['zoomPunch', 'panRight', 'pushIn'],
      motion: { personality: 'playful', energy: 0.8, staggerBase: 0.05, holdBias: 0.42, ease: 'backOut' },
      musicKit: 'bright', sfxKit: ['pop', 'impact', 'shimmer', 'whoosh'],
    },
  ],
  generic: [
    {
      id: 'midnight-modern', label: 'Midnight Modern', mood: 'polished',
      palette: { bg: '#0B0F1A', bgAlt: '#141B2E', ink: '#EEF2FA', inkSoft: '#8B95AC', accent: '#6366F1', accent2: '#22D3EE', glow: '#6366F1', dark: true },
      typography: { display: 'Archivo Black', body: 'Poppins', displayCase: 'upper', tracking: 0.01, numericMono: false },
      shapes: ['rings', 'lines', 'dots', 'grid'], particles: 'dust',
      light: { beams: 0.35, flashOnCut: 0.25, grain: 0.08, vignette: 0.4, scanlines: false },
      transitions: ['push', 'wipe', 'scaleCut', 'flashCut'],
      camera: ['pushIn', 'drift', 'panRight'],
      motion: { personality: 'smooth', energy: 0.6, staggerBase: 0.055, holdBias: 0.5, ease: 'expoOut' },
      musicKit: 'pulse', sfxKit: ['impact', 'whoosh', 'tick', 'shimmer'],
    },
    {
      id: 'editorial-print', label: 'Editorial Print', mood: 'authoritative',
      palette: { bg: '#F8F6F1', bgAlt: '#EDE9DF', ink: '#171513', inkSoft: '#6A655B', accent: '#B91C1C', accent2: '#171513', glow: '#FCA5A5', dark: false },
      typography: { display: 'DM Serif Display', body: 'Space Mono', displayCase: 'none', tracking: 0, numericMono: true },
      shapes: ['lines', 'frames', 'dots'], particles: 'none',
      light: { beams: 0, flashOnCut: 0.05, grain: 0.06, vignette: 0.18, scanlines: false },
      transitions: ['wipe', 'split', 'push', 'scaleCut'],
      camera: ['panRight', 'pushIn', 'drift'],
      motion: { personality: 'editorial', energy: 0.42, staggerBase: 0.08, holdBias: 0.62, ease: 'quintOut' },
      musicKit: 'chill', sfxKit: ['tick', 'pop', 'whoosh'],
    },
    {
      id: 'duotone-pop', label: 'Duotone Pop', mood: 'punchy',
      palette: { bg: '#101010', bgAlt: '#1F0A2E', ink: '#FFFFFF', inkSoft: '#A9A2B5', accent: '#E4FF19', accent2: '#FF3D81', glow: '#E4FF19', dark: true },
      typography: { display: 'Anton', body: 'Rajdhani', displayCase: 'upper', tracking: 0.02, numericMono: false },
      shapes: ['triangles', 'slashes', 'rings', 'bars'], particles: 'confetti',
      light: { beams: 0.4, flashOnCut: 0.4, grain: 0.1, vignette: 0.35, scanlines: false },
      transitions: ['flashCut', 'push', 'glitchSlide', 'scaleCut'],
      camera: ['zoomPunch', 'pushIn', 'panRight'],
      motion: { personality: 'fast', energy: 0.9, staggerBase: 0.035, holdBias: 0.38, ease: 'backOut' },
      musicKit: 'pulse', sfxKit: ['impact', 'glitch', 'whoosh', 'pop'],
    },
  ],
};

// ---------------------------------------------------------------------------
// Intensity scales how busy / aggressive the output is. "calm" trims layers,
// "bold" adds density and faster cuts.
const INTENSITY = {
  calm: { density: 0.7, energyMul: 0.85, particleMul: 0.5, flashMul: 0.4, cutMul: 1.25 },
  balanced: { density: 1, energyMul: 1, particleMul: 1, flashMul: 1, cutMul: 1 },
  bold: { density: 1.35, energyMul: 1.18, particleMul: 1.7, flashMul: 1.5, cutMul: 0.85 },
};

export function chooseDirection(scriptText, opts = {}) {
  const { domain: forcedDomain, seed, intensity = 'balanced', moodHint } = opts;
  const classification = classifyDomain(scriptText);
  const domain = forcedDomain && DOMAINS.includes(forcedDomain) ? forcedDomain : classification.domain;
  const rng = new Rng(seed >>> 0);
  const variants = DIRECTION_VARIANTS[domain] || DIRECTION_VARIANTS.generic;

  // Weighted pick: mood similarity first, then seeded variety. Repeated calls
  // with the same seed always land on the same variant; different seeds drift.
  const mood = moodHint || classifyMood(scriptText);
  const variant = rng.weighted(variants, (v) => {
    let w = 1;
    if (mood && v.mood && v.mood.includes(mood)) w += 2.2;
    if (mood && v.mood && v.mood.split('-')[0] === mood) w += 1.2;
    return w;
  });

  const scale = INTENSITY[intensity] || INTENSITY.balanced;
  const direction = {
    ...variant,
    domain,
    moodLabel: mood || variant.mood,
    intensity,
    palette: { ...variant.palette },
    typography: { ...variant.typography },
    motion: {
      ...variant.motion,
      energy: Math.min(1, variant.motion.energy * scale.energyMul),
      staggerBase: variant.motion.staggerBase / Math.max(0.8, scale.energyMul),
    },
    light: {
      ...variant.light,
      flashOnCut: Math.min(0.85, variant.light.flashOnCut * scale.flashMul),
      grain: variant.light.grain,
      vignette: variant.light.vignette,
    },
    particleDensity: scale.particleMul,
    layoutDensity: scale.density,
    cutSpeed: scale.cutMul,
    sfxKit: [...variant.sfxKit],
    transitions: [...variant.transitions],
    camera: [...variant.camera],
  };
  return { direction, classification, mood, rng };
}

export const LAYOUT_KEYS = [
  'kineticHeadline', 'counterFocus', 'dataViz', 'splitCompare', 'flowSteps',
  'staggerList', 'questionReveal', 'quoteCard', 'definitionCard', 'radialBurst',
  'gridReveal', 'spotlight', 'timelineTrack', 'waveFocus',
];
