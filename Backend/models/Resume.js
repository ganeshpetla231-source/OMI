const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originalName: { type: String, required: true, trim: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    filePath: { type: String, required: true },
    extractedText: { type: String, default: "", select: false },
    extracted: {
      education: [{ type: String, trim: true }],
      skills: [{ type: String, trim: true }],
      projects: [{ type: String, trim: true }],
      experience: [{ type: String, trim: true }]
    },
    extractionStatus: {
      type: String,
      enum: ["pending", "partial", "complete", "failed", "unsupported"],
      default: "pending"
    }
  },
  { timestamps: true }
);

resumeSchema.set("toJSON", {
  transform: (document, returned) => {
    delete returned.__v;
    delete returned.filePath;
    delete returned.extractedText;
    returned.id = returned._id.toString();
    delete returned._id;
    return returned;
  }
});

module.exports = mongoose.model("Resume", resumeSchema);
