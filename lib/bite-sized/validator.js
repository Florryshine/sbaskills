const SUPPORTED_SCREEN_TYPES = new Set([
  'intro',
  'text',
  'image_text',
  'example',
  'demonstration',
  'guided_practice',
  'practice',
  'tip',
  'quick_check',
  'true_false',
  'scenario',
  'error_analysis',
  'recap',
  'completion',
]);

const QUESTION_SCREEN_TYPES = new Set([
  'guided_practice',
  'practice',
  'quick_check',
  'true_false',
  'scenario',
  'error_analysis',
]);

const EXPLANATORY_SCREEN_TYPES = new Set([
  'text',
  'image_text',
  'example',
  'demonstration',
  'guided_practice',
  'practice',
  'quick_check',
  'true_false',
  'scenario',
  'error_analysis',
]);

const APPLICATION_INTERACTION_TYPES = new Set([
  'application',
  'calculation',
  'ordering',
  'scenario',
  'error_analysis',
  'prediction',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function slug(value) {
  return asText(value)
    .toLowerCase()
    .replace(/[\s/-]+/g, '_');
}

function diagnostic(severity, code, message, path = '') {
  return { severity, code, message, path };
}

function hasPlaceholder(value) {
  if (typeof value !== 'string') return false;
  return /(?:\{\{|\}\}|\[\s*(?:todo|insert|placeholder)[^\]]*\]|<\s*(?:insert|placeholder)|(^|\s)\.\.\.(\s|$))/i.test(value);
}

function screenText(screen) {
  return [screen.title, screen.headline, screen.body, screen.explanation, screen.question?.prompt, screen.question?.question]
    .filter((value) => typeof value === 'string')
    .join(' ');
}

function getQuestion(screen) {
  if (screen.question && typeof screen.question === 'object') return screen.question;
  if (screen.prompt || screen.options || screen.correctIndex !== undefined || screen.correctAnswer !== undefined) {
    return {
      prompt: screen.prompt,
      options: screen.options,
      correctIndex: screen.correctIndex,
      correctAnswer: screen.correctAnswer,
      explanation: screen.explanation,
    };
  }
  return null;
}

function objectiveIndexFor(screen) {
  return Number.isInteger(screen.objectiveIndex) ? screen.objectiveIndex : null;
}

export function normalizeLessonContent(content) {
  const source = content && typeof content === 'object' ? content : {};
  const lesson = source.lesson && typeof source.lesson === 'object' ? source.lesson : {};
  const learningBlueprint = source.learningBlueprint && typeof source.learningBlueprint === 'object'
    ? source.learningBlueprint
    : {};
  const screens = asArray(source.screens).map((screen, index) => ({
    ...(screen && typeof screen === 'object' ? screen : {}),
    type: slug(screen?.type),
    orderIndex: Number.isInteger(screen?.orderIndex) ? screen.orderIndex : index,
  }));

  return {
    schemaVersion: Number.isInteger(source.schemaVersion) ? source.schemaVersion : 1,
    lesson: {
      title: asText(lesson.title),
      description: asText(lesson.description),
      objectives: asArray(lesson.objectives).map(asText).filter(Boolean),
    },
    learningBlueprint,
    screens,
  };
}

export function validateLessonContent(content, { forPublish = false } = {}) {
  const normalized = normalizeLessonContent(content);
  const diagnostics = [];
  const objectives = asArray(normalized.lesson.objectives).length > 0
    ? normalized.lesson.objectives
    : asArray(normalized.learningBlueprint.objectives);
  const concepts = asArray(normalized.learningBlueprint.concepts);
  const screens = normalized.screens;

  if (!normalized.lesson.title) {
    diagnostics.push(diagnostic('error', 'missing_lesson_title', 'The generated lesson must have a title.', 'lesson.title'));
  }
  if (!Array.isArray(normalized.lesson.objectives) && objectives.length === 0) {
    diagnostics.push(diagnostic('error', 'missing_objectives', 'The lesson must retain at least one learning objective.', 'lesson.objectives'));
  }
  if (objectives.length === 0) {
    diagnostics.push(diagnostic('error', 'missing_objectives', 'The lesson must contain at least one learning objective.', 'lesson.objectives'));
  }
  if (concepts.length === 0) {
    diagnostics.push(diagnostic('warning', 'missing_blueprint_concepts', 'The blueprint has no concepts to cross-reference.', 'learningBlueprint.concepts'));
  }
  if (screens.length === 0) {
    diagnostics.push(diagnostic('error', 'missing_screens', 'The lesson must contain at least one ordered screen.', 'screens'));
  }

  const orderIndexes = new Set();
  const objectiveCoverage = new Map();
  const applicationCoverage = new Map();
  let hasRecap = false;
  let hasCompletion = false;

  screens.forEach((screen, index) => {
    const path = `screens[${index}]`;
    const type = screen.type;
    const objectiveIndex = objectiveIndexFor(screen);

    if (orderIndexes.has(screen.orderIndex)) {
      diagnostics.push(diagnostic('error', 'duplicate_screen_order', `Screen order index ${screen.orderIndex} is duplicated.`, `${path}.orderIndex`));
    }
    orderIndexes.add(screen.orderIndex);

    if (!SUPPORTED_SCREEN_TYPES.has(type)) {
      diagnostics.push(diagnostic('error', 'unsupported_screen_type', `Screen type '${screen.type || 'missing'}' has no supported renderer.`, `${path}.type`));
    }
    if (!asText(screen.title || screen.headline) && type !== 'completion') {
      diagnostics.push(diagnostic('error', 'missing_screen_title', 'Each instructional screen needs a title or headline.', `${path}.title`));
    }
    if (!asText(screen.body) && !asText(screen.explanation) && !getQuestion(screen) && type !== 'completion') {
      diagnostics.push(diagnostic('warning', 'thin_screen_content', 'This screen has no body, explanation, or question content.', path));
    }
    if (hasPlaceholder(screenText(screen))) {
      diagnostics.push(diagnostic('error', 'unresolved_placeholder', 'The screen contains an unresolved placeholder.', path));
    }

    if (type === 'recap') hasRecap = true;
    if (type === 'completion') hasCompletion = true;

    if (objectiveIndex !== null) {
      if (objectiveIndex < 0 || objectiveIndex >= objectives.length) {
        diagnostics.push(diagnostic('error', 'objective_index_out_of_bounds', `objectiveIndex ${objectiveIndex} does not reference a lesson objective.`, `${path}.objectiveIndex`));
      } else {
        const current = objectiveCoverage.get(objectiveIndex) || { explanatory: false, practice: false };
        if (EXPLANATORY_SCREEN_TYPES.has(type)) current.explanatory = true;
        if (QUESTION_SCREEN_TYPES.has(type)) current.practice = true;
        objectiveCoverage.set(objectiveIndex, current);

        const question = getQuestion(screen);
        const interactionType = slug(screen.interactionType || question?.interactionType);
        if (APPLICATION_INTERACTION_TYPES.has(interactionType)) {
          applicationCoverage.set(objectiveIndex, true);
        }
      }
    } else if (type !== 'intro' && type !== 'tip' && type !== 'completion') {
      diagnostics.push(diagnostic('warning', 'unmapped_screen', 'This screen is not traceable to a blueprint objective.', `${path}.objectiveIndex`));
    }

    if (QUESTION_SCREEN_TYPES.has(type)) {
      const question = getQuestion(screen);
      if (!question) {
        diagnostics.push(diagnostic('error', 'missing_question', 'Practice and question screens need a structured question payload.', `${path}.question`));
        return;
      }

      const prompt = asText(question.prompt || question.question);
      if (!prompt) diagnostics.push(diagnostic('error', 'missing_question_prompt', 'Question screens need a prompt.', `${path}.question.prompt`));
      if (!asText(question.explanation)) {
        diagnostics.push(diagnostic('warning', 'missing_feedback_explanation', 'Question feedback should explain why the answer is right or wrong.', `${path}.question.explanation`));
      }

      const options = asArray(question.options);
      if (options.length > 0) {
        const normalizedOptions = options.map((option) => asText(option).toLowerCase()).filter(Boolean);
        if (normalizedOptions.length !== options.length) {
          diagnostics.push(diagnostic('error', 'empty_option', 'Question options must not be empty.', `${path}.question.options`));
        }
        if (new Set(normalizedOptions).size !== normalizedOptions.length) {
          diagnostics.push(diagnostic('error', 'duplicate_options', 'Question options must not be duplicated.', `${path}.question.options`));
        }
        if (question.correctIndex !== undefined && (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= options.length)) {
          diagnostics.push(diagnostic('error', 'correct_index_out_of_bounds', 'correctIndex must reference an existing option.', `${path}.question.correctIndex`));
        }
      } else if (question.correctIndex !== undefined) {
        diagnostics.push(diagnostic('error', 'options_required_for_correct_index', 'A correctIndex requires a non-empty options array.', `${path}.question.options`));
      }

      if (question.correctIndex === undefined && question.correctAnswer === undefined && type !== 'guided_practice') {
        diagnostics.push(diagnostic('warning', 'missing_answer_representation', 'This question has no correctIndex or correctAnswer; confirm that it is intentionally qualitative or guided.', `${path}.question`));
      }
    }
  });

  if (!hasRecap) diagnostics.push(diagnostic('error', 'missing_recap', 'The lesson must include a recap tied to what was taught.', 'screens'));
  if (!hasCompletion) diagnostics.push(diagnostic('error', 'missing_completion', 'The lesson must include a final completion screen.', 'screens'));

  objectives.forEach((objective, index) => {
    const coverage = objectiveCoverage.get(index);
    if (!coverage?.explanatory) {
      diagnostics.push(diagnostic('error', 'objective_not_taught', `Objective ${index + 1} is not linked to an explanatory or demonstration screen.`, `objectives[${index}]`));
    }
    if (/(apply|calculate|build|debug|compare|create|distinguish|evaluate|use|perform|solve)/i.test(objective) && !coverage?.practice) {
      diagnostics.push(diagnostic('error', 'application_objective_without_practice', `Objective ${index + 1} describes an applied ability but has no practice opportunity.`, `objectives[${index}]`));
    }
  });

  if (forPublish && diagnostics.some((item) => item.severity === 'error')) {
    diagnostics.push(diagnostic('error', 'publishing_blocked', 'Publishing is blocked until all validation errors are resolved.', ''));
  }

  return {
    valid: diagnostics.every((item) => item.severity !== 'error'),
    diagnostics,
    content: normalized,
  };
}

export { SUPPORTED_SCREEN_TYPES, QUESTION_SCREEN_TYPES };
