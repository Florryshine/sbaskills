import { createHash } from 'crypto';

export const COMPONENT_PROMPT_VERSIONS = {
  carousel_slides: '1', master_script: '1', short_script: '1',
  caption_base: '1', seo_meta: '1', mcq_set: '1', visual_instructions: '1',
};

const COMPONENT_FIELDS = {
  carousel_slides: ['keyword','subject','summary','key_concepts','definitions','examples','facts','common_mistakes','learning_objectives','exam_type','sub_topics','difficulty'],
  master_script: ['keyword','subject','summary','key_concepts','definitions','examples','facts','common_mistakes','learning_objectives','exam_type','sub_topics','difficulty','raw_content'],
  short_script: ['keyword','subject','summary','key_concepts','definitions','examples','facts','common_mistakes','learning_objectives','exam_type','sub_topics','difficulty'],
  caption_base: ['keyword','subject','summary','key_concepts','facts','common_mistakes','exam_type'],
  seo_meta: ['keyword','subject','summary','key_concepts','definitions','exam_type','tags'],
  mcq_set: ['keyword','subject','summary','key_concepts','definitions','examples','facts','common_mistakes','learning_objectives','exam_type','sub_topics','difficulty','raw_content'],
  visual_instructions: ['keyword','subject','summary','key_concepts','examples','facts','sub_topics'],
};

export function buildKnowledgeContext(asset, { includeRawContent = true } = {}) {
  const list = (values, render) => (Array.isArray(values) && values.length)
    ? values.map((value) => '- ' + render(value)).join('\n')
    : '- Not specified';
  const lines = [
    'Topic: ' + (asset.keyword || 'Untitled'),
    'Subject: ' + (asset.subject || 'General'),
    'Summary: ' + (asset.summary || 'No summary supplied.'),
    'Difficulty: ' + (asset.difficulty ?? 'Not set') + '/5',
    'Relevant exams: ' + ((asset.exam_type || []).join(', ') || 'Not specified'),
    'Learning objectives:\n' + list(asset.learning_objectives, (x) => typeof x === 'string' ? x : JSON.stringify(x)),
    'Key concepts:\n' + list(asset.key_concepts, (x) => typeof x === 'string' ? x : JSON.stringify(x)),
    'Definitions:\n' + list(asset.definitions, (x) => (x.term || 'Term') + ': ' + (x.definition || '')),
    'Examples:\n' + list(asset.examples, (x) => typeof x === 'string' ? x : JSON.stringify(x)),
    'Facts:\n' + list(asset.facts, (x) => typeof x === 'string' ? x : JSON.stringify(x)),
    'Common mistakes:\n' + list(asset.common_mistakes, (x) => typeof x === 'string' ? x : JSON.stringify(x)),
    'Sub-topics:\n' + list(asset.sub_topics, (x) => (x.title || x.name || 'Sub-topic') + ': ' + (x.explanation || '')),
  ];
  if (includeRawContent && asset.raw_content) lines.push('Additional source material:\n' + String(asset.raw_content).slice(0, 12000));
  return lines.join('\n\n');
}

export function getComponentSourceHash(asset, componentType) {
  const fields = COMPONENT_FIELDS[componentType];
  if (!fields) throw new Error('Unsupported Knowledge Asset component: ' + componentType);
  const source = {};
  fields.forEach((field) => { source[field] = asset[field] ?? null; });
  return createHash('sha256').update(JSON.stringify(source)).digest('hex');
}

export function isComponentFresh(component, asset) {
  return Boolean(component && component.status === 'ready'
    && component.prompt_version === COMPONENT_PROMPT_VERSIONS[component.component_type]
    && component.source_hash === getComponentSourceHash(asset, component.component_type));
}
