const sendError = require("../utils/response").sendError;

module.exports = (req, res) =>
  sendError(res, 404, "Route not found", []);
