const noteService = require("../services/noteService");
const resumeService = require("../services/resumeService");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendCreated, sendPaginated } = require("../utils/response");

const createNote = asyncHandler(async (req, res) => {
  const data = await noteService.createNote(req.user.id, req.body);
  return sendCreated(res, "Note created", data);
});

const listNotes = asyncHandler(async (req, res) => {
  const data = await noteService.listNotes(req.user.id, req.query);
  return sendPaginated(res, "Notes retrieved", data.items, data.pagination);
});

const getNote = asyncHandler(async (req, res) => {
  const data = await noteService.getNote(req.user.id, req.params.id);
  return sendSuccess(res, 200, "Note retrieved", data);
});

const updateNote = asyncHandler(async (req, res) => {
  const data = await noteService.updateNote(req.user.id, req.params.id, req.body);
  return sendSuccess(res, 200, "Note updated", data);
});

const deleteNote = asyncHandler(async (req, res) => {
  await noteService.deleteNote(req.user.id, req.params.id);
  return sendSuccess(res, 200, "Note deleted", null);
});

const uploadResume = asyncHandler(async (req, res) => {
  const data = await resumeService.uploadResume(req.user.id, req.file);
  return sendCreated(res, "Resume uploaded", data);
});

const listResumes = asyncHandler(async (req, res) => {
  const data = await resumeService.listResumes(req.user.id, req.query);
  return sendPaginated(res, "Resumes retrieved", data.items, data.pagination);
});

const getResume = asyncHandler(async (req, res) => {
  const data = await resumeService.getResume(req.user.id, req.params.id);
  return sendSuccess(res, 200, "Resume retrieved", data);
});

const deleteResume = asyncHandler(async (req, res) => {
  await resumeService.deleteResume(req.user.id, req.params.id);
  return sendSuccess(res, 200, "Resume deleted", null);
});

module.exports = {
  createNote, listNotes, getNote, updateNote, deleteNote,
  uploadResume, listResumes, getResume, deleteResume
};
