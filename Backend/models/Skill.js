const mongoose = require("mongoose");

const skillSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  label: { type: String, required: true, trim: true },
  jobRoles: [{ type: String, trim: true }]
});

module.exports = mongoose.model("Skill", skillSchema);
