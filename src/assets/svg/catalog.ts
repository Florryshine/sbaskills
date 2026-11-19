// Shared Visual Asset Library — the built-in generation catalog.
// Each entry is a deterministic, parameterised SVG generator with rich
// discovery metadata (subject / category / keywords). The library seeds
// itself from this catalog and the discovery engine matches topics to it.
import { BIOLOGY_GENERATORS } from "./generators/biology";
import { NATURE_GENERATORS } from "./generators/nature";
import { SCIENCE_GENERATORS } from "./generators/science";
import { DIAGRAM_GENERATORS } from "./generators/diagrams";
import { OBJECT_GENERATORS, BACKGROUND_GENERATORS } from "./generators/objects";

export interface CatalogEntry {
  key: string;               // stable id ("heart", "bg-space", …)
  name: string;              // human name
  description: string;
  subject: string;           // Biology | Chemistry | Physics | Earth & Space | Mathematics | General
  category: string;          // organ|cell|microorganism|plant|animal|molecule|science-object|diagram|character|object|background
  keywords: string[];
  gen: () => string;         // deterministic; params reserved for future variants
  w: number;
  h: number;
}

function e(
  key: string, name: string, subject: string, category: string,
  keywords: string[], description: string, w = 512, h = 512,
): Omit<CatalogEntry, "gen"> {
  return { key, name, subject, category, keywords, description, w, h };
}

const ALL_GENS: Record<string, () => string> = {
  ...BIOLOGY_GENERATORS,
  ...NATURE_GENERATORS,
  ...SCIENCE_GENERATORS,
  ...DIAGRAM_GENERATORS,
  ...OBJECT_GENERATORS,
  ...BACKGROUND_GENERATORS,
};

const META: Omit<CatalogEntry, "gen">[] = [
  // ---- Biology: organs ----
  e("heart", "Human Heart", "Biology", "organ", ["heart", "circulatory system", "blood", "pump", "cardiovascular", "anatomy", "human body", "organ", "pulse", "heartbeat"], "Cartoon human heart with aorta and pulmonary vessels."),
  e("brain", "Human Brain", "Biology", "organ", ["brain", "nervous system", "thinking", "mind", "memory", "neuroscience", "anatomy", "organ", "cerebellum", "learning"], "Cartoon brain with folds, cerebellum and brainstem."),
  e("lungs", "Lungs", "Biology", "organ", ["lungs", "breathing", "respiration", "respiratory system", "oxygen", "air", "anatomy", "organ", "breath", "trachea"], "Cartoon lungs with trachea and bronchial tree."),
  e("eye", "Human Eye", "Biology", "organ", ["eye", "vision", "see", "sight", "iris", "pupil", "senses", "anatomy", "organ", "light"], "Cartoon eye with iris, pupil and eyelashes."),
  e("ear", "Human Ear", "Biology", "organ", ["ear", "hearing", "sound", "senses", "anatomy", "organ", "listen", "audio", "waves"], "Cartoon ear with sound waves."),
  e("stomach", "Stomach", "Biology", "organ", ["stomach", "digestion", "digestive system", "food", "acid", "gut", "anatomy", "organ", "hunger"], "Cartoon stomach with digestive bubbles."),
  e("liver", "Liver", "Biology", "organ", ["liver", "digestion", "bile", "filter", "anatomy", "organ", "detox", "gallbladder"], "Cartoon liver with gallbladder."),
  e("kidneys", "Kidneys", "Biology", "organ", ["kidneys", "filter", "blood", "urine", "excretion", "anatomy", "organ", "water balance"], "Cartoon kidney pair with ureters."),
  e("tooth", "Tooth", "Biology", "organ", ["tooth", "teeth", "dental", "enamel", "brushing", "cavity", "mouth", "hygiene"], "Shiny cartoon molar with a sparkle."),
  e("bone-joint", "Bone and Joint", "Biology", "organ", ["bone", "joint", "skeleton", "bones", "movement", "cartilage", "limb", "musculoskeletal"], "Two bones meeting at a joint capsule."),
  // ---- Biology: cells & microorganisms ----
  e("neuron", "Neuron", "Biology", "cell", ["neuron", "nerve", "nervous system", "brain", "signal", "axon", "synapse", "cell", "impulse"], "Nerve cell with dendrites, axon and myelin."),
  e("animal-cell", "Animal Cell", "Biology", "cell", ["cell", "animal cell", "nucleus", "organelle", "membrane", "cytoplasm", "biology", "microscopic", "life"], "Animal cell with nucleus and colourful organelles."),
  e("plant-cell", "Plant Cell", "Biology", "cell", ["cell", "plant cell", "chloroplast", "cell wall", "vacuole", "nucleus", "photosynthesis", "microscopic"], "Plant cell with wall, chloroplasts and vacuole."),
  e("bacteria", "Bacterium", "Biology", "microorganism", ["bacteria", "bacterium", "germ", "microbe", "prokaryote", "flagella", "hygiene", "microorganism", "infection"], "Rod-shaped bacterium with flagella and pili."),
  e("red-blood-cells", "Red Blood Cells", "Biology", "cell", ["red blood cell", "erythrocyte", "blood", "haemoglobin", "hemoglobin", "oxygen transport", "circulatory", "cell"], "Red blood cells flowing, biconcave discs."),
  e("white-blood-cell", "White Blood Cell", "Biology", "cell", ["white blood cell", "immune", "immunity", "defence", "defense", "germ", "leukocyte", "infection", "cell"], "White blood cell catching a germ."),
  e("virus", "Virus", "Biology", "microorganism", ["virus", "viral", "germ", "pathogen", "spikes", "infection", "microorganism", "pandemic", "illness"], "Virus particle with protein spikes and RNA."),
  e("mitochondrion", "Mitochondrion", "Biology", "cell", ["mitochondria", "mitochondrion", "energy", "atp", "respiration", "powerhouse", "cell", "organelle"], "Mitochondrion with cristae producing ATP."),
  e("dna", "DNA Double Helix", "Biology", "molecule", ["dna", "genes", "genetics", "heredity", "helix", "chromosome", "code of life", "traits"], "Colour-coded DNA double helix with base pairs."),
  e("amoeba", "Amoeba", "Biology", "microorganism", ["amoeba", "protozoa", "single cell", "pseudopod", "microorganism", "unicellular", "microbe"], "Friendly amoeba with pseudopods and vacuoles."),
  // ---- Nature: plants ----
  e("tree", "Tree", "Biology", "plant", ["tree", "plant", "forest", "nature", "leaves", "oxygen", "wood", "environment", "roots"], "Leafy tree with apples and strong trunk."),
  e("flower", "Flower", "Biology", "plant", ["flower", "petal", "pollination", "plants", "bloom", "garden", "spring", "reproduction"], "Pink daisy with stem and leaves."),
  e("leaf", "Leaf", "Biology", "plant", ["leaf", "leaves", "photosynthesis", "veins", "chlorophyll", "green", "plants", "blade"], "Veined leaf with a water droplet."),
  e("seedling", "Seedling", "Biology", "plant", ["seed", "seedling", "germination", "sprout", "growth", "plant life cycle", "soil", "roots"], "Sprouting seedling emerging from soil."),
  e("mushroom", "Mushroom", "Biology", "plant", ["mushroom", "fungus", "fungi", "toadstool", "spores", "decomposer", "forest"], "Red-capped toadstool with spots."),
  e("sunflower", "Sunflower", "Biology", "plant", ["sunflower", "flower", "seeds", "heliotropism", "plants", "garden", "tall plant"], "Tall sunflower with seed head."),
  // ---- Nature: animals ----
  e("bird", "Bird", "Biology", "animal", ["bird", "wings", "feathers", "flight", "animals", "nest", "beak", "flying"], "Round bluebird with wing and crest."),
  e("fish", "Fish", "Biology", "animal", ["fish", "ocean", "sea", "gills", "swimming", "animals", "aquatic", "water"], "Orange fish with fins, scales and bubbles."),
  e("butterfly", "Butterfly", "Biology", "animal", ["butterfly", "insect", "wings", "metamorphosis", "pollination", "caterpillar", "animals"], "Blue butterfly with red wing spots."),
  e("frog", "Frog", "Biology", "animal", ["frog", "amphibian", "pond", "lifecycle", "tadpole", "jumping", "animals", "hibernation"], "Smiling green frog with eye bulges."),
  e("bee", "Bee", "Biology", "animal", ["bee", "honey", "pollination", "insect", "hive", "flowers", "buzz", "animals"], "Striped bee with wings and flight trail."),
  e("cat", "Cat", "Biology", "animal", ["cat", "pet", "mammal", "animals", "whiskers", "kitten", "feline"], "Sitting ginger cat with stripes."),
  e("snail", "Snail", "Biology", "animal", ["snail", "shell", "slow", "mollusc", "gastropod", "garden", "spiral"], "Snail with spiral shell and eye stalks."),
  // ---- Science: molecules ----
  e("water-molecule", "Water Molecule", "Chemistry", "molecule", ["water", "h2o", "molecule", "hydrogen", "oxygen", "chemistry", "bond", "states of matter"], "H2O ball-and-stick model."),
  e("co2-molecule", "Carbon Dioxide Molecule", "Chemistry", "molecule", ["carbon dioxide", "co2", "molecule", "carbon", "greenhouse gas", "chemistry", "respiration", "climate"], "CO2 linear molecule with double bonds."),
  e("oxygen-molecule", "Oxygen Molecule", "Chemistry", "molecule", ["oxygen", "o2", "molecule", "gas", "chemistry", "air", "breathing", "bond"], "O2 diatomic molecule with double bond."),
  e("methane-molecule", "Methane Molecule", "Chemistry", "molecule", ["methane", "ch4", "molecule", "carbon", "hydrogen", "natural gas", "chemistry", "bond"], "CH4 tetrahedral molecule."),
  e("atom", "Atom", "Chemistry", "molecule", ["atom", "nucleus", "electron", "proton", "neutron", "orbit", "physics", "chemistry", "atomic structure"], "Atom with electron orbits and nucleus cluster."),
  // ---- Science: objects ----
  e("flask", "Erlenmeyer Flask", "Chemistry", "science-object", ["flask", "chemistry", "experiment", "lab", "science", "liquid", "reaction", "laboratory"], "Bubbling conical flask with purple liquid."),
  e("beaker", "Beaker", "Chemistry", "science-object", ["beaker", "chemistry", "lab", "measuring", "liquid", "science", "laboratory", "volume"], "Green-liquid beaker with measuring marks."),
  e("test-tubes", "Test Tubes", "Chemistry", "science-object", ["test tube", "test tubes", "chemistry", "experiment", "lab", "samples", "colours", "colors", "laboratory"], "Rack of three colourful test tubes."),
  e("microscope", "Microscope", "Biology", "science-object", ["microscope", "lab", "cells", "science", "magnify", "observe", "laboratory", "research"], "Compound microscope with stage and knobs."),
  e("magnet", "Magnet", "Physics", "science-object", ["magnet", "magnetic", "poles", "attract", "repel", "physics", "force", "field", "north south"], "Horseshoe magnet with field lines."),
  e("thermometer", "Thermometer", "Physics", "science-object", ["thermometer", "temperature", "hot", "cold", "degrees", "weather", "heat", "measure"], "Thermometer with hot and cold indicators."),
  e("light-bulb", "Light Bulb", "Physics", "science-object", ["light bulb", "electricity", "energy", "idea", "circuit", "invention", "current", "power"], "Glowing bulb with filament and rays."),
  e("saturn", "Saturn", "Earth & Space", "science-object", ["saturn", "planet", "rings", "space", "solar system", "astronomy", "gas giant", "orbit"], "Ringed Saturn with a moon."),
  e("sun", "The Sun", "Earth & Space", "science-object", ["sun", "star", "solar", "space", "daylight", "energy", "solar system", "light", "heat"], "Smiling sun with corona rays."),
  e("moon", "The Moon", "Earth & Space", "science-object", ["moon", "craters", "space", "night", "phases", "lunar", "astronomy", "satellite"], "Full moon with craters and stars."),
  e("earth", "Earth", "Earth & Space", "science-object", ["earth", "world", "globe", "continents", "oceans", "planet", "geography", "solar system"], "Blue marble Earth with continents and clouds."),
  e("rocket", "Rocket", "Physics", "science-object", ["rocket", "space", "launch", "thrust", "astronaut", "physics", "force", "space travel"], "Rocket lifting off with flame and stars."),
  e("compass", "Compass", "Earth & Space", "science-object", ["compass", "direction", "north", "navigation", "magnetic", "geography", "maps"], "Compass with red-blue needle."),
  // ---- Diagrams ----
  e("water-cycle", "The Water Cycle", "Earth & Space", "diagram", ["water cycle", "evaporation", "condensation", "precipitation", "rain", "clouds", "cycle", "water", "geography"], "Labelled water cycle: evaporation, cloud, rain, sea."),
  e("photosynthesis", "Photosynthesis", "Biology", "diagram", ["photosynthesis", "leaf", "sunlight", "chlorophyll", "oxygen", "carbon dioxide", "plants", "sugar", "food"], "Labelled photosynthesis diagram with inputs and outputs."),
  e("food-chain", "Food Chain", "Biology", "diagram", ["food chain", "producer", "consumer", "predator", "prey", "ecosystem", "energy flow", "animals", "grass"], "Grass to grasshopper to frog to hawk chain."),
  e("states-of-matter", "States of Matter", "Chemistry", "diagram", ["states of matter", "solid", "liquid", "gas", "melting", "boiling", "freezing", "condensing", "particles", "chemistry"], "Particle diagrams for solid, liquid and gas."),
  e("butterfly-life-cycle", "Butterfly Life Cycle", "Biology", "diagram", ["life cycle", "butterfly", "metamorphosis", "egg", "larva", "caterpillar", "pupa", "chrysalis", "insect"], "Four-stage butterfly metamorphosis."),
  e("parts-of-a-plant", "Parts of a Plant", "Biology", "diagram", ["plant parts", "roots", "stem", "leaf", "flower", "labels", "plants", "biology", "structure"], "Labelled plant: flower, leaf, stem, roots."),
  // ---- Objects ----
  e("book-stack", "Stack of Books", "General", "object", ["books", "reading", "study", "school", "library", "learning", "education"], "Colourful stack of books with an apple."),
  e("pencil", "Pencil", "General", "object", ["pencil", "write", "writing", "school", "draw", "stationery", "learning"], "Classic yellow pencil with eraser."),
  e("globe", "Desk Globe", "Geography", "object", ["globe", "world", "geography", "earth", "maps", "continents", "school"], "Desk globe on a golden stand."),
  e("clock", "Clock", "Mathematics", "object", ["clock", "time", "telling time", "hours", "minutes", "hands", "mathematics"], "Friendly analogue clock at 10:10."),
  e("abacus", "Abacus", "Mathematics", "object", ["abacus", "counting", "math", "mathematics", "numbers", "arithmetic", "beads", "calculate"], "Wooden abacus with coloured beads."),
  // ---- Backgrounds (800x450) ----
  e("bg-sky", "Sunny Sky Scene", "General", "background", ["sky", "sunny", "outdoors", "field", "hill", "clouds", "meadow", "day", "nature scene"], "Sunny sky with clouds, sun and green hills.", 800, 450),
  e("bg-classroom", "Classroom Scene", "General", "background", ["classroom", "school", "blackboard", "lesson", "teacher", "desk", "education", "indoor"], "Classroom with blackboard, cards and clock.", 800, 450),
  e("bg-space", "Outer Space Scene", "Earth & Space", "background", ["space", "stars", "galaxy", "planets", "universe", "nebula", "astronomy", "night sky"], "Deep space with stars, planet and nebulae.", 800, 450),
  e("bg-underwater", "Underwater Scene", "Biology", "background", ["underwater", "ocean", "sea", "fish", "bubbles", "seaweed", "aquatic", "marine"], "Underwater world with rays, fish and seaweed.", 800, 450),
  e("bg-forest", "Forest Scene", "Biology", "background", ["forest", "woods", "trees", "nature", "wildlife", "habitat", "green"], "Forest clearing with trees and mushrooms.", 800, 450),
  e("bg-city", "City Street Scene", "General", "background", ["city", "town", "buildings", "street", "urban", "community", "road"], "City skyline with road and street lamp.", 800, 450),
  e("bg-laboratory", "Laboratory Scene", "Chemistry", "background", ["laboratory", "lab", "science room", "experiment", "chemistry", "research", "indoor"], "Lab bench with flasks, shelf and poster.", 800, 450),
  e("bg-farm", "Farm Scene", "Biology", "background", ["farm", "barn", "crops", "fields", "countryside", "agriculture", "rural"], "Farm with barn, fence and crop rows.", 800, 450),
];

export const ASSET_CATALOG: CatalogEntry[] = META
  .filter((m) => ALL_GENS[m.key])
  .map((m) => ({ ...m, gen: ALL_GENS[m.key] }));

export const CATALOG_BY_KEY = new Map(ASSET_CATALOG.map((c) => [c.key, c]));

export const ASSET_CATEGORIES = [
  "organ", "cell", "microorganism", "plant", "animal", "molecule",
  "science-object", "diagram", "object", "character", "background",
] as const;

export const ASSET_SUBJECTS = [
  "General", "Biology", "Chemistry", "Physics", "Earth & Space", "Mathematics", "Geography", "English",
] as const;

export const STOCK_SOURCES = [
  "catalog", "svg-llm", "upload", "openverse", "wikimedia", "pexels", "pixabay", "unsplash",
] as const;
