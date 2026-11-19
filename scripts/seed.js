// Seed: Knowledge Assets (real curriculum content), character presets, social channels.
// Mirrors sbaskills knowledge_assets fields so the port is 1:1.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const KAS = [
  {
    keyword: "The Human Heart and Blood Circulation",
    subject: "Biology",
    summary:
      "The heart is a muscular pump about the size of a clenched fist that sits slightly left of the centre of the chest. It beats roughly 70-80 times per minute, pushing blood through two circuits: the pulmonary circuit to the lungs and the systemic circuit to the whole body. Blood carries oxygen and nutrients to cells and removes carbon dioxide and waste. The heart has four chambers - two atria that receive blood and two ventricles that pump it out - with valves that keep blood flowing in one direction.",
    subTopics: [
      { title: "Structure of the heart", explanation: "Four chambers: right and left atria on top, right and left ventricles below. The septum separates left from right. Valves (tricuspid, bicuspid/mitral, semilunar) prevent backflow." },
      { title: "The double circulation", explanation: "Pulmonary circulation carries deoxygenated blood from the right ventricle to the lungs and returns oxygenated blood to the left atrium. Systemic circulation delivers oxygenated blood from the left ventricle to the body." },
      { title: "Blood vessels", explanation: "Arteries carry blood away from the heart under high pressure and have thick elastic walls. Veins return blood at low pressure and contain valves. Capillaries are one cell thick for exchange of substances." },
      { title: "Blood components", explanation: "Plasma (55%) transports nutrients and waste; red blood cells carry oxygen with haemoglobin; white blood cells defend against infection; platelets help clotting." },
      { title: "The heartbeat and pulse", explanation: "The 'lub-dub' sound comes from valves closing. Each beat is triggered by the sinoatrial node, the heart's natural pacemaker. Pulse rate in a healthy adult is 70-80 beats per minute at rest." },
    ],
    keyConcepts: ["four chambers", "double circulation", "arteries vs veins", "haemoglobin carries oxygen", "pacemaker (sinoatrial node)", "one-way valves"],
    definitions: [
      { term: "Artery", definition: "A blood vessel that carries blood away from the heart under high pressure." },
      { term: "Vein", definition: "A blood vessel that returns blood to the heart, containing valves to prevent backflow." },
      { term: "Capillary", definition: "A tiny, thin-walled vessel where exchange of oxygen, nutrients and waste happens." },
      { term: "Haemoglobin", definition: "The red pigment in red blood cells that binds oxygen." },
      { term: "Sinoatrial node", definition: "The group of cells in the right atrium that sets the heart's rhythm - the natural pacemaker." },
    ],
    examples: [
      "When you run, your heart rate rises to deliver more oxygen to your muscles.",
      "Veins in your forearm are visible because they sit close to the skin.",
      "A stethoscope hears the lub-dub of valves closing in the heart.",
    ],
    facts: [
      "The heart beats about 100,000 times every day.",
      "Blood makes up about 7% of your body weight.",
      "Red blood cells live for about 120 days.",
      "The left ventricle has the thickest muscular wall because it pumps blood to the whole body.",
      "Capillaries are so narrow that red blood cells travel through them in single file.",
    ],
    rawContent:
      "The human circulatory system is a closed double loop. The right side of the heart handles deoxygenated blood: right atrium receives it from the vena cava, right ventricle pumps it through the pulmonary artery to the lungs, where carbon dioxide is released and oxygen is absorbed. Oxygenated blood returns via pulmonary veins to the left atrium, then the powerful left ventricle pushes it through the aorta to the entire body. Valves (tricuspid on the right, bicuspid/mitral on the left, semilunar at the exits) ensure one-way flow. Arteries: thick, elastic, high pressure. Veins: thinner walls, valves, low pressure. Capillaries: one cell thick, site of exchange. Red blood cells contain haemoglobin which binds oxygen in the lungs and releases it in tissues. White blood cells fight pathogens; platelets trigger clotting. The sinoatrial node in the right atrium initiates each heartbeat, averaging 70-80 bpm at rest.",
  },
  {
    keyword: "Photosynthesis",
    subject: "Biology",
    summary:
      "Photosynthesis is the process green plants use to make their own food. Chlorophyll in the leaves captures energy from sunlight and uses it to convert carbon dioxide from the air and water from the soil into glucose, releasing oxygen as a by-product. It happens mainly in the leaves, inside organelles called chloroplasts. Photosynthesis is the foundation of almost every food chain on Earth and produces the oxygen we breathe.",
    subTopics: [
      { title: "The equation", explanation: "6CO2 + 6H2O + light energy -> C6H12O6 + 6O2. Carbon dioxide plus water, powered by light, produces glucose and oxygen." },
      { title: "Where it happens", explanation: "Mainly in the palisade cells of the leaf, which are packed with chloroplasts containing the green pigment chlorophyll." },
      { title: "Raw materials", explanation: "Carbon dioxide enters through stomata (tiny pores, mostly underneath the leaf); water travels up from the roots through the xylem." },
      { title: "Conditions needed", explanation: "Sunlight, chlorophyll, carbon dioxide and water. Rate increases with light intensity and CO2 until another factor becomes limiting." },
      { title: "Importance", explanation: "Produces food and oxygen for nearly all life, removes CO2 from the atmosphere, and stores energy in glucose which flows through food chains." },
    ],
    keyConcepts: ["chlorophyll traps light energy", "raw materials: CO2 and water", "products: glucose and oxygen", "stomata", "limiting factors", "chloroplasts"],
    definitions: [
      { term: "Chlorophyll", definition: "The green pigment inside chloroplasts that absorbs light energy." },
      { term: "Stomata", definition: "Tiny pores on the underside of leaves that let carbon dioxide in and oxygen out." },
      { term: "Chloroplast", definition: "The organelle where photosynthesis happens." },
      { term: "Glucose", definition: "The sugar made during photosynthesis; plants use it for energy and to build cellulose and starch." },
      { term: "Limiting factor", definition: "Whatever is in shortest supply (light, CO2, water or temperature) and therefore limits the rate of photosynthesis." },
    ],
    examples: [
      "A watered plant in a bright window grows faster than one in a dark cupboard.",
      "Pondweed bubbles oxygen in bright light - a classic experiment.",
      "Farmers sometimes add CO2 in greenhouses to boost crop yield.",
    ],
    facts: [
      "Leaves are broad and thin to absorb maximum light and shorten diffusion distances.",
      "Without photosynthesis, atmospheric oxygen would run out within thousands of years.",
      "Glucose is stored as starch in leaves, which is why iodine turns a leaf blue-black.",
      "Most photosynthesis on Earth is done by algae and phytoplankton in the oceans.",
    ],
    rawContent:
      "Photosynthesis converts light energy into chemical energy stored in glucose. Word equation: carbon dioxide + water --light/chlorophyll--> glucose + oxygen. Balanced: 6CO2 + 6H2O -> C6H12O6 + 6O2. Structure leaf adaptations: broad flat lamina, palisade layer rich in chloroplasts, transparent cuticle and upper epidermis, stomata for gas exchange, xylem brings water, phloem carries away sugars. Experiments: starch test (iodine) proves glucose is made; pondweed light-intensity experiment measures oxygen bubbles. Limiting factors: light intensity, CO2 concentration, temperature (enzyme-controlled). At night plants respire: they take in oxygen and release CO2.",
  },
  {
    keyword: "Chemical Reactions",
    subject: "Chemistry",
    summary:
      "A chemical reaction rearranges atoms to form new substances. Reactants are transformed into products, bonds break and new bonds form, and energy is either released (exothermic) or absorbed (endothermic). Reactions follow the law of conservation of mass: atoms are never created or destroyed, so equations must be balanced. Signs of a reaction include colour change, gas bubbles, temperature change and precipitate formation.",
    subTopics: [
      { title: "Reactants and products", explanation: "Reactants are the starting substances; products are the new substances formed. E.g. hydrogen + water? No: hydrogen + oxygen -> water." },
      { title: "Balancing equations", explanation: "The number of atoms of each element must be equal on both sides. Use coefficients, never change formulae." },
      { title: "Exothermic vs endothermic", explanation: "Exothermic reactions release heat (combustion, neutralisation) so temperature rises. Endothermic reactions absorb heat (photosynthesis, thermal decomposition) so temperature falls." },
      { title: "Types of reactions", explanation: "Combination, decomposition, displacement, neutralisation, combustion and oxidation are common types tested at this level." },
      { title: "Rate of reaction", explanation: "Affected by temperature, concentration, surface area and catalysts. Higher temperature gives particles more energy and more frequent, successful collisions." },
    ],
    keyConcepts: ["conservation of mass", "balancing equations", "exothermic vs endothermic", "collision theory", "catalysts speed up reactions"],
    definitions: [
      { term: "Reactant", definition: "A substance that takes part in and undergoes change during a reaction." },
      { term: "Product", definition: "A new substance formed in a chemical reaction." },
      { term: "Catalyst", definition: "A substance that speeds up a reaction without being used up." },
      { term: "Exothermic", definition: "A reaction that releases energy, usually as heat." },
      { term: "Precipitate", definition: "An insoluble solid that forms when two solutions react." },
    ],
    examples: [
      "Burning magnesium ribbon in air: 2Mg + O2 -> 2MgO with a brilliant white flame (exothermic).",
      "Vinegar + baking soda produces carbon dioxide bubbles.",
      "Rusting iron: iron + oxygen + water -> hydrated iron(III) oxide.",
    ],
    facts: [
      "Mass is always conserved: 4 g of hydrogen burning needs 32 g of oxygen to make 36 g of water.",
      "Enzymes are biological catalysts; even a small amount can multiply reaction rates enormously.",
      "Neutralisation: acid + base -> salt + water.",
      "A lit splint pops near hydrogen; a glowing splint relights in oxygen.",
    ],
    rawContent:
      "Chemical reactions: reactants -> products. Conservation of mass requires balanced symbol equations. Exothermic release energy (combustion of fuels, respiration, neutralisation); endothermic absorb energy (photosynthesis, thermal decomposition of limestone). Collision theory: reactions occur when particles collide with at least the activation energy. Factors increasing rate: higher temperature, higher concentration/pressure, greater surface area, catalysts. Common lab tests: CO2 turns limewater milky; oxygen relights a glowing splint; hydrogen burns with a squeaky pop. pH scale 0-14: acids <7, neutral =7, bases >7. Acid + alkali -> salt + water (neutralisation). Displacement: a more reactive metal displaces a less reactive one from solution (K, Na, Ca, Mg, Al, Zn, Fe, Pb, Cu, Ag, Au reactivity series).",
  },
  {
    keyword: "The Water Cycle",
    subject: "Basic Science",
    summary:
      "The water cycle describes how water moves continuously between the sea, air and land. The sun heats water so it evaporates from oceans, lakes and rivers; water vapour rises, cools and condenses into clouds; when droplets grow heavy they fall as precipitation (rain, hail or snow); water then flows back to the sea as runoff or soaks into the ground. The cycle is powered by the sun and has no beginning or end.",
    subTopics: [
      { title: "Evaporation", explanation: "The sun heats water in oceans and lakes, turning liquid water into water vapour that rises into the air. Plants also release vapour through transpiration." },
      { title: "Condensation", explanation: "As vapour rises it cools and condenses around dust particles into tiny droplets, forming clouds and fog." },
      { title: "Precipitation", explanation: "When droplets merge and grow heavy, they fall as rain, hail, sleet or snow depending on temperature." },
      { title: "Collection and runoff", explanation: "Water collects in rivers, lakes and oceans, or soaks underground as groundwater. Runoff returns water to the sea, completing the cycle." },
      { title: "Why it matters", explanation: "The cycle supplies fresh water for drinking and farming, and it purifies water naturally through evaporation." },
    ],
    keyConcepts: ["evaporation", "condensation", "precipitation", "collection/runoff", "transpiration", "sun powers the cycle"],
    definitions: [
      { term: "Evaporation", definition: "The change of liquid water into water vapour when heated." },
      { term: "Condensation", definition: "The change of water vapour into liquid droplets when cooled." },
      { term: "Transpiration", definition: "The release of water vapour from the leaves of plants." },
      { term: "Precipitation", definition: "Any form of water falling from clouds - rain, hail, sleet or snow." },
      { term: "Groundwater", definition: "Water that has soaked into the soil and collects beneath the surface." },
    ],
    examples: [
      "A wet road dries after rain as water evaporates in the sun.",
      "Water droplets form on the outside of a cold bottle - vapour condensing.",
      "Clouds forming over hills in the afternoon as moist air rises and cools.",
    ],
    facts: [
      "About 97% of Earth's water is salty ocean water; only ~3% is fresh.",
      "The same water has been cycling for billions of years - your drinking water is older than the dinosaurs.",
      "A single cumulus cloud can weigh hundreds of tonnes.",
      "Evaporation purifies water: salt and impurities are left behind.",
    ],
    rawContent:
      "The water (hydrological) cycle: solar energy drives evaporation from oceans (about 86% of atmospheric vapour) and transpiration from plants (evapotranspiration). Warm humid air rises, expands and cools adiabatically; vapour condenses onto condensation nuclei forming droplets and clouds. Coalescence makes droplets heavy enough for precipitation. Rain reaches land, infiltrates soil (infiltration/percolation) recharging aquifers, or flows as surface runoff through streams and rivers back to oceans. States involved: liquid, gas (vapour), solid (ice/hail/snow). The cycle is a closed system driven by the sun and gravity.",
  },
  {
    keyword: "Newton's Laws of Motion and Gravity",
    subject: "Physics",
    summary:
      "Newton's three laws describe how forces change motion. First law: objects keep doing what they are doing unless a resultant force acts (inertia). Second law: force equals mass times acceleration (F = ma). Third law: every action has an equal and opposite reaction. Newton's law of universal gravitation explains that every mass attracts every other mass, which is why objects fall and planets orbit.",
    subTopics: [
      { title: "First law - inertia", explanation: "A body stays at rest or moves at constant velocity unless acted on by a resultant force. Seatbelts protect you because your body keeps moving when the car stops suddenly." },
      { title: "Second law - F = ma", explanation: "Acceleration is proportional to the resultant force and inversely proportional to mass. Doubling the force doubles the acceleration; doubling the mass halves it." },
      { title: "Third law - action and reaction", explanation: "Forces come in pairs. A rocket pushes gas down; the gas pushes the rocket up. Swimming: you push water backwards, water pushes you forwards." },
      { title: "Weight, mass and gravity", explanation: "Mass (kg) is the amount of matter and never changes; weight (N) is the gravitational force on it, W = mg, where g is about 9.8 m/s2 on Earth." },
      { title: "Universal gravitation", explanation: "Every object attracts every other object with a force proportional to the product of their masses and inversely proportional to the square of the distance between them." },
    ],
    keyConcepts: ["inertia", "F = ma", "action-reaction pairs", "weight vs mass", "free fall", "universal gravitation"],
    definitions: [
      { term: "Force", definition: "A push or pull that can change an object's speed, direction or shape, measured in newtons." },
      { term: "Inertia", definition: "The resistance of an object to a change in its motion." },
      { term: "Weight", definition: "The force of gravity acting on a mass: W = mg." },
      { term: "Friction", definition: "A force that opposes relative motion between surfaces in contact." },
      { term: "Free fall", definition: "Motion under gravity alone, with acceleration g (about 9.8 m/s2 near Earth's surface, ignoring air resistance)." },
    ],
    examples: [
      "A ball rolled on grass slows down because of friction - without a force it would keep going.",
      "Astronauts float because they are in continuous free fall around Earth.",
      "Kicking a small ball accelerates it more than kicking a heavy one with the same force.",
    ],
    facts: [
      "A 60 kg person weighs about 588 N on Earth but only about 98 N on the Moon.",
      "The Moon is kept in orbit by the same gravity that drops an apple.",
      "Air resistance is why a feather falls slower than a coin - in a vacuum they land together.",
      "Newton published these laws in 1687 in the Principia.",
    ],
    rawContent:
      "Newton I: resultant force zero => rest or uniform velocity (inertia). Newton II: F = ma (a in m/s2, F in N, m in kg). Newton III: action-reaction pairs act on different bodies, equal magnitude, opposite direction. Gravity: F = G m1 m2 / r^2, G = 6.67e-11. Near Earth, g = 9.8 m/s2; weight W = mg. Terminal velocity: as speed increases air resistance grows until it balances weight, acceleration becomes zero. Applications: seatbelts and crumple zones (inertia), rockets and jet engines (III), projectiles and orbits (gravitation).",
  },
  {
    keyword: "Fractions",
    subject: "Mathematics",
    summary:
      "A fraction represents equal parts of a whole: the bottom number (denominator) says how many equal parts the whole is divided into, and the top number (numerator) says how many parts we take. Fractions can be added, subtracted, multiplied, divided and converted to decimals and percentages. Equivalent fractions look different but represent the same amount, e.g. 1/2 = 2/4 = 5/10.",
    subTopics: [
      { title: "Parts of a fraction", explanation: "Numerator (top): how many parts. Denominator (bottom): how many equal parts the whole is split into." },
      { title: "Equivalent fractions", explanation: "Multiply or divide numerator AND denominator by the same number: 1/2 = 2/4 = 3/6. Simplify by dividing by the highest common factor." },
      { title: "Comparing fractions", explanation: "Convert to the same denominator first: 2/3 vs 3/5 -> 10/15 vs 9/15, so 2/3 is bigger." },
      { title: "Adding and subtracting", explanation: "Same denominator: add numerators only. Different denominators: find a common denominator first. 1/4 + 1/2 = 1/4 + 2/4 = 3/4." },
      { title: "Multiplying and dividing", explanation: "Multiply: multiply tops and bottoms (2/3 x 3/5 = 6/15 = 2/5). Divide: flip the second fraction and multiply (1/2 / 1/4 = 1/2 x 4 = 2)." },
    ],
    keyConcepts: ["numerator", "denominator", "equivalent fractions", "common denominator", "improper fractions and mixed numbers", "fraction of a quantity"],
    definitions: [
      { term: "Numerator", definition: "The top number of a fraction: how many parts are taken." },
      { term: "Denominator", definition: "The bottom number: how many equal parts make one whole." },
      { term: "Equivalent fractions", definition: "Different-looking fractions with the same value." },
      { term: "Improper fraction", definition: "A fraction whose numerator is bigger than its denominator, e.g. 7/4." },
      { term: "Mixed number", definition: "A whole number with a fraction, e.g. 1 3/4." },
    ],
    examples: [
      "Sharing 3 mangoes among 4 friends gives each 3/4 of a mango.",
      "Half of 60 minutes is 1/2 x 60 = 30 minutes.",
      "A recipe needs 3/4 cup of oil; doubling it needs 1 1/2 cups.",
    ],
    facts: [
      "The word fraction comes from the Latin 'fractus', meaning broken.",
      "Any fraction of 100 equals the same percentage: 3/4 = 75%.",
      "Dividing by a fraction makes the answer bigger: 2 / 1/2 = 4.",
      "Ancient Egyptians used fractions over 4,000 years ago, but almost only unit fractions like 1/3.",
    ],
    rawContent:
      "Fractions: a/b. a = numerator, b = denominator, b != 0. Equivalent fractions: a/b = ka/kb. Simplify with HCF. Compare/add/subtract via LCM of denominators. Add: a/c + b/c = (a+b)/c. Multiply: a/b x c/d = ac/bd (simplify first where possible). Divide: a/b / c/d = a/b x d/c. Improper to mixed: 7/4 = 1 3/4 (divide: quotient + remainder/denominator). Fraction of quantity: 2/5 of 40 = (40/5) x 2 = 16. Convert to decimal by division, to percentage by x100. Word problems: shares, recipes, time, lengths. JAMB tip: always reduce to lowest terms before choosing your answer.",
  },
  {
    keyword: "States of Matter",
    subject: "Chemistry",
    summary:
      "Matter exists mainly in three states: solid, liquid and gas. The particles in each state are arranged and move differently. In solids, particles vibrate in fixed positions. In liquids, particles slide past each other. In gases, particles fly freely at high speed. Adding or removing energy (heat) changes a substance from one state to another: melting, freezing, evaporation, condensation and sublimation.",
    subTopics: [
      { title: "Solids", explanation: "Fixed shape and volume. Particles are tightly packed in a regular pattern and only vibrate in place. Strong forces hold them together." },
      { title: "Liquids", explanation: "Fixed volume but take the shape of their container. Particles are close but free to slide past one another." },
      { title: "Gases", explanation: "No fixed shape or volume; gases fill their container. Particles are far apart, move fast and randomly, and are easily compressed." },
      { title: "Changes of state", explanation: "Melting (solid->liquid), freezing (liquid->solid), evaporation/boiling (liquid->gas), condensation (gas->liquid), sublimation (solid->gas directly, like dry ice and camphor)." },
      { title: "Particle theory", explanation: "Heating gives particles more kinetic energy so they move faster and spread out; cooling does the opposite. This explains expansion, contraction and changes of state." },
    ],
    keyConcepts: ["particle arrangement", "kinetic energy and temperature", "melting and boiling points", "sublimation", "diffusion is fastest in gases"],
    definitions: [
      { term: "Melting point", definition: "The temperature at which a solid turns into a liquid." },
      { term: "Boiling point", definition: "The temperature at which a liquid turns into gas throughout the liquid; for water, 100 degrees Celsius at sea level." },
      { term: "Sublimation", definition: "The direct change from solid to gas without becoming liquid." },
      { term: "Diffusion", definition: "The spreading of particles from where they are many to where they are few." },
      { term: "Kinetic energy", definition: "The energy of motion; particle kinetic energy increases with temperature." },
    ],
    examples: [
      "Ice melting in a glass of water at 0 degrees Celsius.",
      "Camphor and mothballs disappearing into vapour - sublimation.",
      "The smell of cooking spreading through the house - diffusion of gas particles.",
    ],
    facts: [
      "Water is the only common substance that exists naturally in all three states on Earth.",
      "Gases expand to fill any container because their particles barely attract each other.",
      "Solid expansion joints on bridges allow for hot-day expansion.",
      "Diffusion happens fastest in gases and slowest in solids.",
    ],
    rawContent:
      "Kinetic particle theory: solids - regular, close-packed lattice, vibrate about fixed points; liquids - random, close, move/slide; gases - random, far apart, fast, negligible forces. State changes: melting at m.p., boiling at b.p., condensation, freezing, sublimation (iodine, dry ice, ammonium chloride). Heating curve: flat plateaus at m.p./b.p. because energy goes into breaking forces, not raising temperature. Expansion: solids least, gases most. Diffusion rate: gas > liquid > solid; lighter particles diffuse faster (ammonia travels further than HCl in the tube experiment).",
  },
  {
    keyword: "Food Chains and Ecosystems",
    subject: "Biology",
    summary:
      "A food chain shows how energy passes from producers to consumers when organisms eat each other. Green plants (producers) capture sunlight to make food; herbivores (primary consumers) eat plants; carnivores (secondary and tertiary consumers) eat other animals. Decomposers recycle nutrients back to the soil. Together with their environment, all these organisms form an ecosystem in which energy flows one way and matter is recycled.",
    subTopics: [
      { title: "Producers", explanation: "Green plants and algae that make their own food by photosynthesis. They are always the first link in a food chain." },
      { title: "Consumers", explanation: "Primary consumers eat producers (herbivores like grasshoppers and goats). Secondary consumers eat primary consumers. Tertiary consumers are top predators." },
      { title: "Decomposers", explanation: "Bacteria and fungi break down dead organisms and waste, returning nutrients to the soil for producers to reuse." },
      { title: "Food webs", explanation: "Interconnected food chains form a food web, showing the many feeding relationships in an ecosystem." },
      { title: "Energy flow and pyramids", explanation: "Only about 10% of energy passes to the next level - the rest is lost as heat and waste. This is why food chains rarely exceed 4-5 levels and pyramids of numbers/biomass are wide at the bottom." },
    ],
    keyConcepts: ["producer", "primary/secondary/tertiary consumers", "decomposers", "energy flow one way", "10% energy rule", "food web interdependence"],
    definitions: [
      { term: "Producer", definition: "An organism that makes its own food using sunlight, e.g. green plants." },
      { term: "Herbivore", definition: "An animal that eats only plants." },
      { term: "Carnivore", definition: "An animal that eats other animals." },
      { term: "Decomposer", definition: "An organism that breaks down dead material, recycling nutrients." },
      { term: "Ecosystem", definition: "All the organisms living in an area together with their physical environment." },
    ],
    examples: [
      "Grass -> grasshopper -> lizard -> hawk is a simple grassland food chain.",
      "In a pond: algae -> tadpole -> fish -> heron.",
      "Mushrooms and bacteria decomposing a fallen log and returning nutrients to soil.",
    ],
    facts: [
      "A hawk at the top of a chain needs thousands of grass plants below it - energy shrinks at each step.",
      "Removing one species can collapse a whole web, e.g. losing bees hits plants, then everything that eats plants.",
      "Only about 10% of the energy in one level reaches the next.",
      "Top predators are rare because so little energy reaches the top.",
    ],
    rawContent:
      "Food chains begin with producers (autotrophs). Arrows show energy flow: grass -> grasshopper -> lizard -> hawk. Trophic levels: T1 producers, T2 primary consumers (herbivores), T3 secondary, T4 tertiary. Decomposers (saprophytic bacteria/fungi) close the nutrient cycle. Food webs interlink chains; ecosystem stability depends on biodiversity. Energy pyramid: ~10% transfer efficiency between levels (loss to respiration, heat, egestion), hence short chains, pyramids of numbers and biomass. Bioaccumulation of toxins increases up the chain (e.g. DDT in birds of prey). Habitat, population, community definitions; abiotic (light, water, temperature) and biotic factors.",
  },
];

const CHARACTERS = [
  { name: "Tobi", presetKey: "tobi", isPreset: true, dna: { skin: "#8a5a3b", hairStyle: "short-curls", hairColor: "#171114", outfit: "hoodie", topColor: "#1a73e8", bottomColor: "#2c3a4d", shoeColor: "#f5f5f0", accentColor: "#FFCC00", height: 1.0, headScale: 1.0, bodyWidth: 1.0, glasses: false, earrings: false, freckles: false, blush: false, voice: "tongtong" } },
  { name: "Ada", presetKey: "ada", isPreset: true, dna: { skin: "#7c4a2d", hairStyle: "afro-puff", hairColor: "#241a12", outfit: "pinafore", topColor: "#e85d75", bottomColor: "#3b2f8f", shoeColor: "#fff", accentColor: "#ffd166", height: 0.97, headScale: 1.06, bodyWidth: 0.95, glasses: false, earrings: true, freckles: false, blush: true, voice: "tongtong" } },
  { name: "Chidi", presetKey: "chidi", isPreset: true, dna: { skin: "#6b3f22", hairStyle: "buzz", hairColor: "#120d0a", outfit: "lab-coat", topColor: "#fafafa", bottomColor: "#33475b", shoeColor: "#333", accentColor: "#39b58a", height: 1.05, headScale: 0.96, bodyWidth: 1.05, glasses: true, earrings: false, freckles: false, blush: false, voice: "tongtong" } },
  { name: "Zainab", presetKey: "zainab", isPreset: true, dna: { skin: "#a0714f", hairStyle: "headwrap", hairColor: "#2b2118", wrapColor: "#c25e8e", outfit: "skirt-blouse", topColor: "#8ecf6f", bottomColor: "#4d9de0", shoeColor: "#f2e9dc", accentColor: "#fff", height: 1.0, headScale: 1.0, bodyWidth: 0.95, glasses: false, earrings: true, freckles: false, blush: true, voice: "tongtong" } },
  { name: "Emeka", presetKey: "emeka", isPreset: true, dna: { skin: "#5e3419", hairStyle: "fade", hairColor: "#0f0b08", outfit: "sports", topColor: "#f4a300", bottomColor: "#274060", shoeColor: "#fff", accentColor: "#e85d75", height: 1.08, headScale: 0.94, bodyWidth: 1.12, glasses: false, earrings: false, freckles: false, blush: false, voice: "tongtong" } },
  { name: "Ngozi", presetKey: "ngozi", isPreset: true, dna: { skin: "#91613e", hairStyle: "braids", hairColor: "#1d1512", outfit: "dress", topColor: "#7a4dd8", bottomColor: "#7a4dd8", shoeColor: "#ffe3ec", accentColor: "#ffd166", height: 0.99, headScale: 1.03, bodyWidth: 0.97, glasses: false, earrings: true, freckles: true, blush: true, voice: "tongtong" } },
  { name: "Musa", presetKey: "musa", isPreset: true, dna: { skin: "#8d5a3a", hairStyle: "short-curls", hairColor: "#161210", outfit: "shirt-trousers", topColor: "#4fb3a9", bottomColor: "#5b4636", shoeColor: "#3a2f28", accentColor: "#fff", height: 1.02, headScale: 0.98, bodyWidth: 1.0, glasses: false, earrings: false, freckles: false, blush: false, voice: "tongtong" } },
  { name: "Kemi", presetKey: "kemi", isPreset: true, dna: { skin: "#b07a52", hairStyle: "buns", hairColor: "#231a13", outfit: "tshirt", topColor: "#ff8c42", bottomColor: "#2f6690", shoeColor: "#fff", accentColor: "#3a86ff", height: 0.95, headScale: 1.1, bodyWidth: 0.92, glasses: true, earrings: false, freckles: true, blush: true, voice: "tongtong" } },
];

const CHANNELS = [
  { platform: "youtube", label: "Shiney Brain Academy (YouTube)", accountId: "UC_sba_demo", isActive: true, simulated: true },
  { platform: "instagram", label: "@shineybrainacademy", accountId: "17841400000000000", isActive: true, simulated: true },
  { platform: "facebook", label: "Shiney Brain Academy Page", accountId: "1029384756", isActive: true, simulated: true },
  { platform: "tiktok", label: "@shineybrain", accountId: "tiktok-sba-demo", isActive: true, simulated: true },
];

async function main() {
  for (const ka of KAS) {
    await prisma.knowledgeAsset.upsert({
      where: { keyword: ka.keyword },
      update: {},
      create: {
        keyword: ka.keyword, subject: ka.subject, topicType: "learning",
        summary: ka.summary,
        subTopics: JSON.stringify(ka.subTopics),
        keyConcepts: JSON.stringify(ka.keyConcepts),
        definitions: JSON.stringify(ka.definitions),
        examples: JSON.stringify(ka.examples),
        facts: JSON.stringify(ka.facts),
        rawContent: ka.rawContent, status: "approved", source: "seed",
      },
    });
  }
  for (const ch of CHARACTERS) {
    await prisma.cartoonCharacter.upsert({
      where: { presetKey: ch.presetKey },
      update: { dna: JSON.stringify(ch.dna), name: ch.name },
      create: { name: ch.name, presetKey: ch.presetKey, dna: JSON.stringify(ch.dna), isPreset: true },
    });
  }
  for (const c of CHANNELS) {
    await prisma.socialChannel.upsert({
      where: { platform_label: { platform: c.platform, label: c.label } },
      update: {},
      create: c,
    });
  }
  console.log("Seed complete:", KAS.length, "KAs,", CHARACTERS.length, "characters,", CHANNELS.length, "channels");
}
main().finally(() => prisma.$disconnect());
