const mongoose = require("mongoose");

const jobRoleSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, trim: true },
  label: { type: String, required: true, trim: true }
});

module.exports = mongoose.model("JobRole", jobRoleSchema);
