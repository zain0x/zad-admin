/**
 * Creates the first admin account (there is no open sign-up).
 *
 *   npm run create-admin -- you@example.com "Your Name"
 *
 * Prints a temporary password. On first login the admin must change it
 * and set up two-factor authentication.
 */
import { PrismaClient } from "@prisma/client";
import { generateTempPassword, hashPassword } from "../lib/auth/password";

const db = new PrismaClient();

async function main() {
    const [emailArg, ...nameParts] = process.argv.slice(2);
    const email = (emailArg ?? "").trim().toLowerCase();
    const name = nameParts.join(" ").trim() || "المدير";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        console.error('Usage: npm run create-admin -- you@example.com "Your Name"');
        process.exit(1);
    }
    if (await db.user.findUnique({ where: { email } })) {
        console.error(`An account with ${email} already exists.`);
        process.exit(1);
    }
    const tempPassword = generateTempPassword();
    const user = await db.user.create({
        data: { email, name, role: "ADMIN", passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
    });
    await db.auditLog.create({
        data: { actorId: null, action: "user.created", targetType: "user", targetId: user.id, details: { email, role: "ADMIN", via: "cli" } },
    });
    console.log("\nAdmin account created.");
    console.log(`  Email:              ${email}`);
    console.log(`  Temporary password: ${tempPassword}`);
    console.log("\nSign in, then you will be asked to set up 2FA and choose a new password.\n");
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => db.$disconnect());
