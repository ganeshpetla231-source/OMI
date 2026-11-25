const mongoose = require("mongoose");
const Note = require("../models/Note");
const ApiError = require("../utils/ApiError");
const { parsePagination, buildPagination } = require("../utils/pagination");

async function createNote(userId, body) {
  return (await Note.create({ ...body, user: userId })).toJSON();
}

async function listNotes(userId, query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { user: userId };
  if (query.topic) filter.topic = query.topic;
  if (query.search) filter.$text = { $search: query.search };

  const [items, total] = await Promise.all([
    Note.find(filter).sort(query.search ? { score: { $meta: "textScore" } } : { createdAt: -1 }).skip(skip).limit(limit),
    Note.countDocuments(filter)
  ]);
  return { items: items.map((item) => item.toJSON()), pagination: buildPagination(page, limit, total) };
}

async function getNote(userId, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Note not found");
  const note = await Note.findOne({ _id: id, user: userId });
  if (!note) throw new ApiError(404, "Note not found");
  return note.toJSON();
}

async function updateNote(userId, id, body) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Note not found");
  const note = await Note.findOneAndUpdate({ _id: id, user: userId }, body, { new: true, runValidators: true });
  if (!note) throw new ApiError(404, "Note not found");
  return note.toJSON();
}

async function deleteNote(userId, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Note not found");
  const note = await Note.findOneAndDelete({ _id: id, user: userId });
  if (!note) throw new ApiError(404, "Note not found");
  return null;
}

module.exports = { createNote, listNotes, getNote, updateNote, deleteNote };
