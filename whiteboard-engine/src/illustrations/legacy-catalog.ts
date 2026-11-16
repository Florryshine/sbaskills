// Metadata bridge for the original SBA vector library.
// Artwork remains authored in remotion/whiteboard/SBAAssetLibrary.jsx;
// this file makes its stable IDs searchable by the v3 planner/parser.
export interface LegacyAssetMeta { id:string; name:string; category:'biology'|'chemistry'|'physics'|'general'; keywords:string[]; }
export const LEGACY_ASSETS: LegacyAssetMeta[] = [
  {
    "id": "animal-cell",
    "name": "Animal cell",
    "category": "biology",
    "keywords": [
      "cell",
      "animal cell",
      "animal cell"
    ]
  },
  {
    "id": "plant-cell",
    "name": "Plant cell",
    "category": "biology",
    "keywords": [
      "plant-cell",
      "plant cell",
      "plant cell"
    ]
  },
  {
    "id": "chloroplast",
    "name": "Chloroplast",
    "category": "biology",
    "keywords": [
      "chloroplast",
      "chloroplast",
      "chloroplast"
    ]
  },
  {
    "id": "mitochondrion",
    "name": "Mitochondrion",
    "category": "biology",
    "keywords": [
      "mitochondrion",
      "mitochondrion",
      "mitochondrion"
    ]
  },
  {
    "id": "digestive-system",
    "name": "Digestive system",
    "category": "biology",
    "keywords": [
      "digestive",
      "digestive system",
      "digestive system"
    ]
  },
  {
    "id": "respiratory-system",
    "name": "Respiratory system",
    "category": "biology",
    "keywords": [
      "lungs",
      "respiratory system",
      "respiratory system"
    ]
  },
  {
    "id": "circulatory-system",
    "name": "Circulatory system",
    "category": "biology",
    "keywords": [
      "circulation",
      "circulatory system",
      "circulatory system"
    ]
  },
  {
    "id": "human-heart",
    "name": "Human heart",
    "category": "biology",
    "keywords": [
      "heart",
      "human heart",
      "human heart"
    ]
  },
  {
    "id": "excretory-system",
    "name": "Excretory system",
    "category": "biology",
    "keywords": [
      "kidneys",
      "excretory system",
      "excretory system"
    ]
  },
  {
    "id": "human-kidney",
    "name": "Human kidney",
    "category": "biology",
    "keywords": [
      "kidney",
      "human kidney",
      "human kidney"
    ]
  },
  {
    "id": "nervous-system",
    "name": "Nervous system",
    "category": "biology",
    "keywords": [
      "nerves",
      "nervous system",
      "nervous system"
    ]
  },
  {
    "id": "human-eye",
    "name": "Human eye",
    "category": "biology",
    "keywords": [
      "eye",
      "human eye",
      "human eye"
    ]
  },
  {
    "id": "human-ear",
    "name": "Human ear",
    "category": "biology",
    "keywords": [
      "ear",
      "human ear",
      "human ear"
    ]
  },
  {
    "id": "human-skeleton",
    "name": "Human skeleton",
    "category": "biology",
    "keywords": [
      "skeleton",
      "human skeleton",
      "human skeleton"
    ]
  },
  {
    "id": "muscular-system",
    "name": "Muscular system",
    "category": "biology",
    "keywords": [
      "muscles",
      "muscular system",
      "muscular system"
    ]
  },
  {
    "id": "reproductive-systems",
    "name": "Reproductive systems",
    "category": "biology",
    "keywords": [
      "reproductive",
      "reproductive systems",
      "reproductive systems"
    ]
  },
  {
    "id": "flower-anatomy",
    "name": "Flower anatomy",
    "category": "biology",
    "keywords": [
      "flower",
      "flower anatomy",
      "flower anatomy"
    ]
  },
  {
    "id": "seed-germination",
    "name": "Seed germination",
    "category": "biology",
    "keywords": [
      "germination",
      "seed germination",
      "seed germination"
    ]
  },
  {
    "id": "dna-double-helix",
    "name": "DNA double helix",
    "category": "biology",
    "keywords": [
      "dna",
      "dna double helix",
      "dna double helix"
    ]
  },
  {
    "id": "chromosomes-genes",
    "name": "Chromosomes and genes",
    "category": "biology",
    "keywords": [
      "chromosome",
      "chromosomes and genes",
      "chromosomes genes"
    ]
  },
  {
    "id": "microorganisms",
    "name": "Amoeba, Euglena and Paramecium",
    "category": "biology",
    "keywords": [
      "microbes",
      "amoeba euglena and paramecium",
      "microorganisms"
    ]
  },
  {
    "id": "food-chain",
    "name": "Food chain and ecological pyramid",
    "category": "biology",
    "keywords": [
      "foodchain",
      "food chain and ecological pyramid",
      "food chain"
    ]
  },
  {
    "id": "atomic-structure",
    "name": "Atomic structure",
    "category": "chemistry",
    "keywords": [
      "atom",
      "atomic structure",
      "atomic structure"
    ]
  },
  {
    "id": "periodic-table",
    "name": "Periodic table",
    "category": "chemistry",
    "keywords": [
      "periodic",
      "periodic table",
      "periodic table"
    ]
  },
  {
    "id": "chemical-bonding",
    "name": "Chemical bonding models",
    "category": "chemistry",
    "keywords": [
      "bonding",
      "chemical bonding models",
      "chemical bonding"
    ]
  },
  {
    "id": "molecular-structures",
    "name": "Molecular structures",
    "category": "chemistry",
    "keywords": [
      "molecule",
      "molecular structures",
      "molecular structures"
    ]
  },
  {
    "id": "lab-apparatus",
    "name": "Laboratory apparatus",
    "category": "chemistry",
    "keywords": [
      "apparatus",
      "laboratory apparatus",
      "lab apparatus"
    ]
  },
  {
    "id": "filtration",
    "name": "Filtration setup",
    "category": "chemistry",
    "keywords": [
      "filtration",
      "filtration setup",
      "filtration"
    ]
  },
  {
    "id": "distillation",
    "name": "Distillation apparatus",
    "category": "chemistry",
    "keywords": [
      "distillation",
      "distillation apparatus",
      "distillation"
    ]
  },
  {
    "id": "titration",
    "name": "Titration setup",
    "category": "chemistry",
    "keywords": [
      "titration",
      "titration setup",
      "titration"
    ]
  },
  {
    "id": "electrolysis",
    "name": "Electrolysis apparatus",
    "category": "chemistry",
    "keywords": [
      "electrolysis",
      "electrolysis apparatus",
      "electrolysis"
    ]
  },
  {
    "id": "electrochemical-cell",
    "name": "Electrochemical cell",
    "category": "chemistry",
    "keywords": [
      "battery",
      "electrochemical cell",
      "electrochemical cell"
    ]
  },
  {
    "id": "gas-collection",
    "name": "Gas collection apparatus",
    "category": "chemistry",
    "keywords": [
      "gas",
      "gas collection apparatus",
      "gas collection"
    ]
  },
  {
    "id": "heating-curve",
    "name": "Heating curve",
    "category": "chemistry",
    "keywords": [
      "heating",
      "heating curve",
      "heating curve"
    ]
  },
  {
    "id": "collision-theory",
    "name": "Collision theory",
    "category": "chemistry",
    "keywords": [
      "collision",
      "collision theory",
      "collision theory"
    ]
  },
  {
    "id": "fractional-distillation",
    "name": "Fractional distillation column",
    "category": "chemistry",
    "keywords": [
      "fractionation",
      "fractional distillation column",
      "fractional distillation"
    ]
  },
  {
    "id": "vernier-calipers",
    "name": "Vernier calipers",
    "category": "physics",
    "keywords": [
      "vernier",
      "vernier calipers",
      "vernier calipers"
    ]
  },
  {
    "id": "micrometer",
    "name": "Micrometer screw gauge",
    "category": "physics",
    "keywords": [
      "micrometer",
      "micrometer screw gauge",
      "micrometer"
    ]
  },
  {
    "id": "beam-balance",
    "name": "Beam balance",
    "category": "physics",
    "keywords": [
      "balance",
      "beam balance",
      "beam balance"
    ]
  },
  {
    "id": "simple-pendulum",
    "name": "Simple pendulum",
    "category": "physics",
    "keywords": [
      "pendulum",
      "simple pendulum",
      "simple pendulum"
    ]
  },
  {
    "id": "inclined-plane",
    "name": "Inclined plane",
    "category": "physics",
    "keywords": [
      "incline",
      "inclined plane",
      "inclined plane"
    ]
  },
  {
    "id": "simple-machines",
    "name": "Lever, pulley and wheel-and-axle",
    "category": "physics",
    "keywords": [
      "machines",
      "lever pulley and wheel and axle",
      "simple machines"
    ]
  },
  {
    "id": "projectile-motion",
    "name": "Projectile motion",
    "category": "physics",
    "keywords": [
      "projectile",
      "projectile motion",
      "projectile motion"
    ]
  },
  {
    "id": "vectors-forces",
    "name": "Vector and force diagrams",
    "category": "physics",
    "keywords": [
      "vectors",
      "vector and force diagrams",
      "vectors forces"
    ]
  },
  {
    "id": "hydraulic-press",
    "name": "Hydraulic press",
    "category": "physics",
    "keywords": [
      "hydraulic",
      "hydraulic press",
      "hydraulic press"
    ]
  },
  {
    "id": "wave-anatomy",
    "name": "Wave anatomy",
    "category": "physics",
    "keywords": [
      "wave",
      "wave anatomy",
      "wave anatomy"
    ]
  },
  {
    "id": "sound-wave",
    "name": "Sound wave and tuning fork",
    "category": "physics",
    "keywords": [
      "sound",
      "sound wave and tuning fork",
      "sound wave"
    ]
  },
  {
    "id": "reflection-refraction",
    "name": "Reflection and refraction",
    "category": "physics",
    "keywords": [
      "optics",
      "reflection and refraction",
      "reflection refraction"
    ]
  },
  {
    "id": "electric-circuit",
    "name": "Electric circuit components",
    "category": "physics",
    "keywords": [
      "circuit",
      "electric circuit components",
      "electric circuit"
    ]
  },
  {
    "id": "magnetic-field",
    "name": "Magnetic field and electromagnet",
    "category": "physics",
    "keywords": [
      "magnetism",
      "magnetic field and electromagnet",
      "magnetic field"
    ]
  },
  {
    "id": "cat",
    "name": "Cat",
    "category": "general",
    "keywords": [
      "cat",
      "cat",
      "cat"
    ]
  },
  {
    "id": "dog",
    "name": "Dog",
    "category": "general",
    "keywords": [
      "dog",
      "dog",
      "dog"
    ]
  },
  {
    "id": "butterfly",
    "name": "Butterfly",
    "category": "general",
    "keywords": [
      "butterfly",
      "butterfly",
      "butterfly"
    ]
  },
  {
    "id": "frog",
    "name": "Frog",
    "category": "general",
    "keywords": [
      "frog",
      "frog",
      "frog"
    ]
  },
  {
    "id": "fish",
    "name": "Fish",
    "category": "general",
    "keywords": [
      "fish",
      "fish",
      "fish"
    ]
  },
  {
    "id": "bird",
    "name": "Bird",
    "category": "general",
    "keywords": [
      "bird",
      "bird",
      "bird"
    ]
  },
  {
    "id": "lion",
    "name": "Lion",
    "category": "general",
    "keywords": [
      "lion",
      "lion",
      "lion"
    ]
  },
  {
    "id": "rainforest",
    "name": "Tropical rainforest",
    "category": "general",
    "keywords": [
      "rainforest",
      "tropical rainforest",
      "rainforest"
    ]
  },
  {
    "id": "savanna",
    "name": "African savanna",
    "category": "general",
    "keywords": [
      "savanna",
      "african savanna",
      "savanna"
    ]
  },
  {
    "id": "desert",
    "name": "Desert landscape",
    "category": "general",
    "keywords": [
      "desert",
      "desert landscape",
      "desert"
    ]
  },
  {
    "id": "river-waterfall",
    "name": "River and waterfall",
    "category": "general",
    "keywords": [
      "river",
      "river and waterfall",
      "river waterfall"
    ]
  },
  {
    "id": "ocean",
    "name": "Ocean underwater scene",
    "category": "general",
    "keywords": [
      "ocean",
      "ocean underwater scene",
      "ocean"
    ]
  },
  {
    "id": "mountain",
    "name": "Mountain landscape",
    "category": "general",
    "keywords": [
      "mountain",
      "mountain landscape",
      "mountain"
    ]
  },
  {
    "id": "farm",
    "name": "Farm and farmland",
    "category": "general",
    "keywords": [
      "farm",
      "farm and farmland",
      "farm"
    ]
  },
  {
    "id": "fruits",
    "name": "Assorted fruits",
    "category": "general",
    "keywords": [
      "fruits",
      "assorted fruits",
      "fruits"
    ]
  },
  {
    "id": "vegetables",
    "name": "Vegetables",
    "category": "general",
    "keywords": [
      "vegetables",
      "vegetables",
      "vegetables"
    ]
  },
  {
    "id": "nigerian-food",
    "name": "Nigerian food collection",
    "category": "general",
    "keywords": [
      "food",
      "nigerian food collection",
      "nigerian food"
    ]
  },
  {
    "id": "kitchen-utensils",
    "name": "Cooking pot and kitchen utensils",
    "category": "general",
    "keywords": [
      "kitchen",
      "cooking pot and kitchen utensils",
      "kitchen utensils"
    ]
  },
  {
    "id": "bicycle",
    "name": "Bicycle",
    "category": "general",
    "keywords": [
      "bicycle",
      "bicycle",
      "bicycle"
    ]
  },
  {
    "id": "drinking-water",
    "name": "Person drinking water",
    "category": "general",
    "keywords": [
      "drinking",
      "person drinking water",
      "drinking water"
    ]
  }
];
export const LEGACY_ALIASES: Record<string,string> = {
  "cell": "animal-cell",
  "plant": "plant-cell",
  "atom": "atomic-structure",
  "heart": "human-heart",
  "lungs": "respiratory-system",
  "flower": "flower-anatomy",
  "tree": "rainforest",
  "water": "drinking-water"
};
export function findLegacyAsset(query:string): LegacyAssetMeta|null {
 const q=query.toLowerCase().replace(/^legacy\\./,'').replace(/[^a-z0-9]+/g,' ').trim();
 if(!q) return null;
 return LEGACY_ASSETS.find(a=>a.id===q.replace(/ /g,'-') || a.name.toLowerCase()===q)
   ?? LEGACY_ASSETS.map(a=>({a,score:a.keywords.reduce((n,k)=>n+(q.includes(k)||k.includes(q)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score)[0]?.a
   ?? null;
}
