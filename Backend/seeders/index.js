const env = require("../config/env");
const { connectDatabase } = require("../config/db");
const mongoose = require("mongoose");
const seedAdmin = require("./adminSeeder");
const logger = require("../utils/logger");
const Category = require("../models/Category");
const JobRole = require("../models/JobRole");
const Skill = require("../models/Skill");
const Question = require("../models/Question");
const categories = require("./data/categories.json");
const roles = require("./data/roles.json");
const skills = require("./data/skills.json");
const baseQuestions = require("./data/questions.json");
const languageQuestions = require("./data/languages.json");

async function seedData() {
  await Category.bulkWrite(categories.map((item) => ({
    updateOne: { filter: { key: item.key }, update: { $set: item }, upsert: true }
  })));
  await JobRole.bulkWrite(roles.map((item) => ({
    updateOne: { filter: { key: item.key }, update: { $set: item }, upsert: true }
  })));
  await Skill.bulkWrite(skills.map((item) => ({
    updateOne: { filter: { key: item.key }, update: { $set: item }, upsert: true }
  })));

  const generated = [];
  const difficulties = ["easy", "medium", "hard"];

  for (const base of baseQuestions) {
    roles.forEach((role, roleIndex) => {
      for (let variant = 0; variant < 4; variant += 1) {
        const difficulty = difficulties[(roleIndex + variant) % difficulties.length];
        const seedKey = `${base.key}-${role.key}-${variant}`;
        generated.push({
          seedKey,
          text: `${base.text} Consider this for the ${role.label} role.`,
          category: base.category,
          jobRole: role.label,
          skill: base.skill,
          difficulty,
          language: base.language,
          expectedAnswer: base.expectedAnswer,
          keywords: base.keywords,
          tags: base.tags,
          evaluationCriteria: base.evaluationCriteria,
          timeLimitSeconds: base.timeLimitSeconds,
          source: "seed",
          isActive: true
        });
      }
    });
  }

  languageQuestions.forEach((item, index) => {
    generated.push({
      seedKey: `${item.language}-question-${index + 1}`,
      text: item.text,
      category: item.category,
      jobRole: "General/Fresher",
      skill: item.skill,
      difficulty: item.difficulty,
      language: item.language,
      expectedAnswer: item.expectedAnswer,
      keywords: item.keywords,
      tags: [item.category, item.language],
      evaluationCriteria: ["Clear explanation", "Relevant example", "Structured answer"],
      timeLimitSeconds: 150,
      source: "seed",
      isActive: true
    });
  });

  await Question.bulkWrite(generated.map((item) => ({
    updateOne: {
      filter: { seedKey: item.seedKey },
      update: { $set: item },
      upsert: true
    }
  })));
  logger.info("Seeding complete");
}

async function seedDatabase() {
  await connectDatabase(env.mongodbUri);
  await seedAdmin();
  await seedData();
  logger.info("Database seeding complete");
  await mongoose.disconnect();
}

if (require.main === module) {
  seedDatabase().catch(async (error) => {
    logger.error("Seeding failed", error);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = { seedData, seedDatabase };
