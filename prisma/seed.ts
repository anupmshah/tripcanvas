import { PrismaClient } from "@prisma/client";
import { createDemoTrip } from "../src/lib/demo";

const prisma = new PrismaClient();
createDemoTrip(prisma)
  .then((t) => console.log("Demo trip:", t.id))
  .finally(() => prisma.$disconnect());
