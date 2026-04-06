import dotenv from "dotenv";
dotenv.config();

import { parse } from "url";
import next from "next";
import { createApp } from "./createApp.js";
import { getUserReposRoot } from "./config/repos.config.js";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;

const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

await nextApp.prepare();

const app = createApp();

app.all("*", (req, res) => {
  const parsedUrl = parse(req.url || "", true);
  return handle(req, res, parsedUrl);
});

app.listen(port, () => {
  console.log(`Server ready on port ${port}`);
  console.log(`Repositories root: ${getUserReposRoot()}`);
});
