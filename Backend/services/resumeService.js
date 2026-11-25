const fs = require("fs").promises;
const path = require("path");
const mongoose = require("mongoose");
const Resume = require("../models/Resume");
const { parseResume } = require("./resumeParser");
const ApiError = require("../utils/ApiError");
const { parsePagination, buildPagination } = require("../utils/pagination");

async function uploadResume(userId, file) {
  const resume = await Resume.create({
    user: userId,
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    filePath: file.path,
    extractionStatus: "pending"
  });

  const parsed = await parseResume(resume);
  resume.extractedText = parsed.extractedText;
  resume.extracted = parsed.extracted;
  resume.extractionStatus = parsed.extractionStatus;
  await resume.save();
  return resume.toJSON();
}

async function listResumes(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { user: userId };
  const [items, total] = await Promise.all([
    Resume.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Resume.countDocuments(filter)
  ]);
  return { items: items.map((item) => item.toJSON()), pagination: buildPagination(page, limit, total) };
}

async function getResume(userId, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Resume not found");
  const resume = await Resume.findOne({ _id: id, user: userId });
  if (!resume) throw new ApiError(404, "Resume not found");
  return resume.toJSON();
}

async function deleteResume(userId, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Resume not found");
  const resume = await Resume.findOne({ _id: id, user: userId });
  if (!resume) throw new ApiError(404, "Resume not found");

  if (resume.filePath) {
    try {
      await fs.unlink(resume.filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  await resume.deleteOne();
  return null;
}

module.exports = { uploadResume, listResumes, getResume, deleteResume };
