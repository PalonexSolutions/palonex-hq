import { disableAdmin, provisionAdmin } from "../lib/server/admin-auth.ts";
import { getDatabase } from "../lib/server/database.ts";

const [command, email, name] = process.argv.slice(2);
try {
  if (!email || (command !== "create" && command !== "disable")) {
    throw new Error("Use create <staff-email> <display-name> or disable <staff-email>.");
  }
  if (command === "create") {
    if (process.stdin.isTTY) throw new Error("Pipe the password into stdin using a hidden prompt.");
    let password = "";
    for await (const chunk of process.stdin) {
      password += chunk.toString();
      if (password.length > 130) throw new Error("Password is too long.");
    }
    await provisionAdmin(email, name, password.replace(/\r?\n$/, ""));
    console.log("Administrator provisioned.");
  } else {
    if (!await disableAdmin(email)) throw new Error("Administrator not found.");
    console.log("Administrator disabled and sessions revoked.");
  }
} catch {
  console.error("Administrator command failed. Verify arguments, database permissions, and account state.");
  process.exitCode = 1;
} finally {
  if (process.env.DATABASE_URL) await getDatabase().end();
}
