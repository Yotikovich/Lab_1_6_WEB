import "dotenv/config";
import argon2 from "argon2";
import prisma from "../src/lib/prisma.js";

const name = process.env.ADMIN_NAME || "System Administrator";
const email = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!password || password.length < 12) {
  console.error("Для створення адміністратора задайте ADMIN_PASSWORD (не менше 12 символів) у .env.");
  process.exitCode = 1;
} else {
  try {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const admin = await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash, role: "ADMIN" },
      create: { name, email, passwordHash, role: "ADMIN" },
      select: { id: true, name: true, email: true, role: true },
    });
    console.log(`Адміністратора налаштовано: ${admin.email} (ID: ${admin.id}).`);
  } catch (error) {
    console.error("Не вдалося створити адміністратора:", error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
