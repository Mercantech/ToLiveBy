import { sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { quotes } from "./db/schema.js";

const seedData: {
  body: string;
  author: string | null;
  category: "general" | "stoicism" | "motivation" | "discipline";
  tags: string[];
}[] = [
  {
    body: "Det er ikke fordi tingene er svære, at vi ikke tør; det er fordi vi ikke tør, at de er svære.",
    author: "Seneca",
    category: "stoicism",
    tags: ["mod", "handling"],
  },
  {
    body: "Du har magten over dit sind — ikke udenforiske begivenheder. Indse dette, og du finder styrke.",
    author: "Marcus Aurelius",
    category: "stoicism",
    tags: ["indre ro"],
  },
  {
    body: "Små skridt hver dag slår perfektion én gang om ugen.",
    author: null,
    category: "discipline",
    tags: ["vaner"],
  },
  {
    body: "Start hvor du er. Brug hvad du har. Gør hvad du kan.",
    author: "Arthur Ashe",
    category: "motivation",
    tags: ["start"],
  },
];

export async function seedIfEmpty(): Promise<void> {
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(quotes);

  if ((count ?? 0) > 0) {
    return;
  }

  await db.insert(quotes).values(
    seedData.map((s) => ({
      body: s.body,
      author: s.author,
      category: s.category,
      tags: s.tags,
      isActive: true,
    })),
  );
}
