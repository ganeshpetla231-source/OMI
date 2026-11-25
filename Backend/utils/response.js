function sendSuccess(res, statusCode, message, data = null) {
  return res.status(statusCode).json({ success: true, message, data });
}

function sendCreated(res, message, data) {
  return sendSuccess(res, 201, message, data);
}

function sendPaginated(res, message, data, pagination) {
  return res.status(200).json({ success: true, message, data, pagination });
}

function sendError(res, statusCode, message, errors = []) {
  return res.status(statusCode).json({ success: false, message, errors });
}

module.exports = { sendSuccess, sendCreated, sendPaginated, sendError };
