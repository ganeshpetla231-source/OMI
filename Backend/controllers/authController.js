const authService = require("../services/authService");
const asyncHandler = require("../utils/asyncHandler");
const { sendCreated, sendSuccess } = require("../utils/response");

const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body);
  return sendCreated(res, "Registration successful", data);
});

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  return sendSuccess(res, 200, "Login successful", data);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user);
  return sendSuccess(res, 200, "Logged out successfully", null);
});

const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, "User profile retrieved", req.user.toJSON());
});

const changePassword = asyncHandler(async (req, res) => {
  const data = await authService.changePassword(req.user.id, req.body);
  return sendSuccess(res, 200, "Password changed successfully", data);
});

module.exports = { register, login, logout, me, changePassword };
