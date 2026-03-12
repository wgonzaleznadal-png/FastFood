import "dotenv/config";
import app from "./app";
import { startCleanupService } from "./lib/cleanup";

const PORT = process.env.PORT ?? 4000;

app.listen(PORT, () => {
  console.log(`[GastroDash API] Running on http://localhost:${PORT}`);
  startCleanupService();
});
