import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env"), override: true });

import app from "./app";

const PORT = process.env.PORT ?? 4000;

app.listen(PORT, () => {
  console.log(`[GastroDash API] Running on http://localhost:${PORT}`);
});
