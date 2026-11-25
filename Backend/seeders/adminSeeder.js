const bcrypt = require("bcryptjs");
const env = require("../config/env");
const User = require("../models/User");

async function seedAdmin() {
  if (!env.adminEmail || !env.adminPassword) return null;

  let admin = await User.findOne({ email: env.adminEmail.toLowerCase().trim() });
  if (admin) {
    if (admin.role !== "admin") {
      admin.role = "admin";
      await admin.save();
    }
    return admin;
  }

  admin = await User.create({
    name: "TalkReady Admin",
    email: env.adminEmail.toLowerCase().trim(),
    passwordHash: await bcrypt.hash(env.adminPassword, 11),
    role: "admin"
  });
  return admin;
}

module.exports = seedAdmin;
