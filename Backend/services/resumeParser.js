const fs = require("fs").promises;
const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");
const Skill = require("../models/Skill");

const BUILTIN_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Node.js", "React",
  "Angular", "Vue", "Express", "MongoDB", "SQL", "PostgreSQL", "MySQL", "Redis",
  "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Git", "Linux", "REST", "GraphQL",
  "HTML", "CSS", "Django", "Spring", "Flutter", "Android", "Machine Learning"
];

function sectionChunks(text) {
  const headings = /(EDUCATION|SKILLS|TECHNICAL SKILLS|PROJECTS|EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|SUMMARY|CERTIFICATIONS)[\s:]*$/im;
  const chunks = { education: [], skills: [], projects: [], experience: [] };
  const lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let section = null;
  for (const line of lines) {
    const match = line.match(headings);
    if (match) {
      const heading = match[1].toUpperCase();
      if (heading.includes("EDUC")) section = "education";
      else if (heading.includes("SKILL")) section = "skills";
      else if (heading.includes("PROJECT")) section = "projects";
      else if (heading.includes("EXPER")) section = "experience";
      else section = null;
      continue;
    }
    if (section) {
      const item = line.replace(/^[-*•]\s*/, "").trim();
      if (item && item.length < 300) chunks[section].push(item);
    }
  }
  return chunks;
}

function uniqueText(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
}

async function parseResume(resume) {
  const ext = resume.originalName.split(".").pop().toLowerCase();
  if (ext === "doc") {
    return { extractedText: "", extracted: { education: [], skills: [], projects: [], experience: [] }, extractionStatus: "unsupported" };
  }

  try {
    const buffer = await fs.readFile(resume.filePath);
    let text = "";
    if (ext === "pdf") {
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        text = parsed.text || "";
      } finally {
        await parser.destroy();
      }
    } else if (ext === "docx") {
      const parsed = await mammoth.extractRawText({ buffer });
      text = parsed.value || "";
    } else {
      throw new Error("Unsupported resume type");
    }

    const chunks = sectionChunks(text);
    const skillLabels = await Skill.find({}, { key: 1, label: 1 }).lean();
    const candidates = [...BUILTIN_SKILLS, ...skillLabels.map((item) => item.label), ...skillLabels.map((item) => item.key)];
    const lowerText = text.toLowerCase();
    const foundSkills = uniqueText(candidates.filter((candidate) => {
      const escaped = candidate.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(lowerText);
    }).map((item) => String(item)));

    return {
      extractedText: text,
      extracted: {
        education: uniqueText(chunks.education),
        skills: foundSkills,
        projects: uniqueText(chunks.projects),
        experience: uniqueText(chunks.experience)
      },
      extractionStatus: text.trim() ? "complete" : "partial"
    };
  } catch (error) {
    return { extractedText: "", extracted: { education: [], skills: [], projects: [], experience: [] }, extractionStatus: "failed" };
  }
}

module.exports = { parseResume, sectionChunks };
