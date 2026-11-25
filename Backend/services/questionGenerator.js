const mongoose = require("mongoose");
const Question = require("../models/Question");
const { extractTopics, extractDefinitions, extractKeywords } = require("./notesProcessor");

function cleanUnique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function noteQuestions(noteId, userId) {
  if (!mongoose.models.Note || !noteId) return [];
  const Note = mongoose.models.Note;
  const note = await Note.findOne({ _id: noteId, user: userId });
  if (!note) return [];
  const topics = extractTopics(note.content);
  const definitions = extractDefinitions(note.content);
  const terms = cleanUnique([...topics, ...definitions.map((item) => item.term), ...extractKeywords(note.content)]).slice(0, 8);
  const base = terms.map((term) => ({
    id: `notes-${term}`,
    text: `Explain ${term} in your own words.`,
    expectedAnswer: `Describe ${term}, where it is used, and give a practical example.`,
    keywords: [term],
    tags: [term],
    timeLimitSeconds: 150,
    difficulty: "medium",
    skill: term,
    category: "general",
    source: "notes"
  }));
  for (const definition of definitions.slice(0, 3)) {
    base.unshift({
      id: `notes-definition-${definition.term}`,
      text: `What does "${definition.term}" mean?`,
      expectedAnswer: definition.definition,
      keywords: [definition.term, ...extractKeywords(definition.definition)],
      tags: [definition.term, "definition", "notes"],
      timeLimitSeconds: 150,
      difficulty: "medium",
      skill: definition.term,
      category: "general",
      source: "notes"
    });
  }
  return base;
}

async function resumeQuestions(resumeId, userId) {
  if (!mongoose.models.Resume || !resumeId) return [];
  const Resume = mongoose.models.Resume;
  const resume = await Resume.findOne({ _id: resumeId, user: userId });
  if (!resume) return [];
  const extracted = resume.extracted || {};
  const skills = Array.isArray(extracted.skills) ? extracted.skills : [];
  const projects = Array.isArray(extracted.projects) ? extracted.projects : [];
  const result = [];
  for (const project of projects.slice(0, 3)) {
    const name = typeof project === "string" ? project : project.name;
    if (name) result.push({
      id: `resume-project-${name}`,
      text: `Tell me about your project ${name}.`,
      expectedAnswer: "Explain the goal, your responsibilities, technology choices, challenges, and outcome.",
      keywords: [name, "goal", "responsibility", "result"],
      tags: ["project", "resume"],
      timeLimitSeconds: 180,
      difficulty: "medium",
      skill: "Problem Solving",
      category: "general",
      source: "resume"
    });
  }
  for (const skill of cleanUnique(skills).slice(0, 5)) {
    result.push({
      id: `resume-skill-${skill}`,
      text: `How have you used ${skill} in practice?`,
      expectedAnswer: `Describe a concrete situation where you used ${skill}, the action you took, and the result.`,
      keywords: [skill, "example", "result"],
      tags: ["skill", "resume"],
      timeLimitSeconds: 150,
      difficulty: "medium",
      skill,
      category: "technical",
      source: "resume"
    });
  }
  return result;
}

async function generateQuestions({ count, category, difficulty, language, jobRole, skill, skills, noteId, resumeId, userId }) {
  const filter = { isActive: true };
  if (category) filter.category = category;
  if (difficulty) filter.difficulty = difficulty;
  if (language) filter.language = language;
  if (jobRole) filter.jobRole = jobRole;
  if (skill) filter.skill = skill;
  if (Array.isArray(skills) && skills.length) filter.skill = { $in: skills };

  let bank = await Question.find(filter).limit(count * 3);
  let selected = bank.map((item) => ({ ...item.toJSON(), source: item.source === "seed" ? "bank" : item.source }));
  const extra = [];
  if (noteId) extra.push(...await noteQuestions(noteId, userId));
  if (resumeId) extra.push(...await resumeQuestions(resumeId, userId));

  const combined = [];
  const seen = new Set();
  for (const item of [...extra, ...selected]) {
    const key = item.text.trim().toLowerCase();
    if (!seen.has(key) && combined.length < count) {
      seen.add(key);
      combined.push(item);
    }
  }

  let index = 0;
  while (combined.length < count) {
    const label = category || "general";
    const roleLabel = jobRole || "General/Fresher";
    combined.push({
      id: `template-${label}-${index}`,
      text: `Describe a ${label} challenge you solved as a ${roleLabel} (scenario ${index + 1}).`,
      expectedAnswer: "Explain the situation, the actions you took, challenges, and the final result.",
      keywords: ["situation", "action", "challenge", "result"],
      tags: [label, "template"],
      timeLimitSeconds: 150,
      difficulty: difficulty || "medium",
      skill: skill || "Problem Solving",
      category: label,
      source: "template"
    });
    index += 1;
  }

  const sources = combined.reduce((totals, item) => {
    totals[item.source || "template"] = (totals[item.source || "template"] || 0) + 1;
    return totals;
  }, {});

  return { questions: combined, sources };
}

module.exports = { generateQuestions };
