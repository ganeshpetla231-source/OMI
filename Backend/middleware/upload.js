const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

const resumeDirectory = path.join(__dirname, "..", "uploads", "resumes");
fs.mkdirSync(resumeDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, resumeDirectory),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
  }
});

function allowedFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeMap = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword"
  };
  return mimeMap[ext] === file.mimetype && Boolean(mimeMap[ext]);
}

const upload = multer({
  storage,
  limits: { fileSize: Math.max(1, env.maxFileSizeMb) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(allowedFile(file) ? null : new multer.MulterError("UNSUPPORTED_FILE_TYPE"), allowedFile(file));
  }
});

function sanitizeOriginalName(name) {
  const base = path.basename(String(name || "resume").replace(/[^\w.-]+/g, "_"));
  return base.slice(0, 180) || "resume";
}

function validateResumeSignatureMiddleware(req, res, next) {
  if (!req.file) return next(new ApiError(400, "Resume file is required"));
  const ext = path.extname(req.file.originalname).toLowerCase();
  try {
    const buffer = fs.readFileSync(req.file.path);
    let valid = false;
    if (ext === ".pdf") valid = buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    if (ext === ".docx") valid = buffer.subarray(0, 2).toString("ascii") === "PK";
    if (ext === ".doc") valid = buffer.subarray(0, 4).equals(Buffer.from([0xD0, 0xCF, 0x11, 0xE0]));

    if (!valid) {
      fs.unlink(req.file.path, () => {});
      return next(new ApiError(415, "Unsupported file"));
    }
    req.file.originalname = sanitizeOriginalName(req.file.originalname);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { upload, validateResumeSignature: validateResumeSignatureMiddleware, resumeDirectory };
