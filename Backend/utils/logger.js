const logger = {
  info: (message, meta) => console.log(`[INFO] ${message}`, meta || ""),
  warn: (message, meta) => console.warn(`[WARN] ${message}`, meta || ""),
  error: (message, error) => {
    console.error(`[ERROR] ${message}`);
    if (error) console.error(error);
  }
};

module.exports = logger;
