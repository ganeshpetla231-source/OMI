const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  label: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: "" }
});

module.exports = mongoose.model("Category", categorySchema);
