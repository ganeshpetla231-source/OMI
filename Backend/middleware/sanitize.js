function stripForbiddenKeys(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = stripForbiddenKeys(value[index]);
    }
    return value;
  }
  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete value[key];
    } else {
      value[key] = stripForbiddenKeys(value[key]);
    }
  }
  return value;
}

module.exports = function sanitizeMongoInput(req, res, next) {
  if (req.body) stripForbiddenKeys(req.body);
  if (req.query) stripForbiddenKeys(req.query);
  if (req.params) stripForbiddenKeys(req.params);
  next();
};
