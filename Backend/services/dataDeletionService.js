const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");

const DATA_COLLECTIONS = [
  "Interview",
  "Answer",
  "Report",
  "Note",
  "Resume",
  "Media"
];

async function deleteUserFiles(userId) {
  if (mongoose.models.Resume) {
    const resumes = await mongoose.models.Resume.find({ user: userId }).select("filePath");
    for (const resume of resumes) {
      if (!resume.filePath) continue;
      try {
        await fs.unlink(resume.filePath);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }

  const resumeDirectory = path.join(__dirname, "..", "uploads", "resumes");
  try {
    const entries = await fs.readdir(resumeDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.includes(userId.toString())) {
        await fs.rm(path.join(resumeDirectory, entry.name), { recursive: true, force: true });
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function deleteAllUserData(userId, { keepUser = false, keepSettings = false } = {}) {
  const counts = {};

  if (mongoose.models.Interview) {
    const interviews = await mongoose.models.Interview.find({ user: userId }).select("_id");
    const interviewIds = interviews.map((item) => item._id);
    for (const name of ["Answer", "Report", "Evaluation"]) {
      if (!mongoose.models[name]) continue;
      const field = name === "Report" ? "interview" : "interview";
      const result = await mongoose.models[name].deleteMany({ [field]: { $in: interviewIds } });
      counts[name] = result.deletedCount || 0;
    }
  }

  for (const name of DATA_COLLECTIONS) {
    if (!mongoose.models[name]) continue;
    const model = mongoose.models[name];
    const result = await model.deleteMany({ user: userId });
    counts[name] = result.deletedCount || 0;
  }

  if (!keepSettings) {
    const Settings = mongoose.models.Settings;
    if (Settings) {
      const result = await Settings.deleteOne({ user: userId });
      counts.Settings = result.deletedCount || 0;
    }
  }

  await deleteUserFiles(userId);

  if (!keepUser) {
    const User = mongoose.models.User;
    if (User) {
      const result = await User.deleteOne({ _id: userId });
      counts.User = result.deletedCount || 0;
    }
  }

  return counts;
}

module.exports = { DATA_COLLECTIONS, deleteAllUserData };
