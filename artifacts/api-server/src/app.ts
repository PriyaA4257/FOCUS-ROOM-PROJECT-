import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve the frontend static files from the focus-room dist directory
const frontendDistPath = path.resolve(__dirname, "../../focus-room/dist");
app.use(express.static(frontendDistPath));

// Catch-all route to serve the frontend index.html for client-side routing
app.get("*", (req, res) => {
  // Ignore API routes so they return 404 instead of serving HTML
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "Not Found" });
  }
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

export default app;
