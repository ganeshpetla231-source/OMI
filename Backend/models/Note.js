const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 10000 },
    topic: { type: String, trim: true, maxlength: 100, default: "general" },
    tags: [{ type: String, trim: true, maxlength: 50 }]
  },
  { timestamps: true }
);

noteSchema.index({ title: "text", content: "text" });
noteSchema.index({ user: 1, topic: 1, createdAt: -1 });

noteSchema.set("toJSON", {
  transform: (document, returned) => {
    delete returned.__v;
    returned.id = returned._id.toString();
    delete returned._id;
    return returned;
  }
});

module.exports = mongoose.model("Note", noteSchema);
