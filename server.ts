import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`CWD: ${process.cwd()}`);
  
  const debugLog = path.join(process.cwd(), "server_debug.log");
  const log = (msg: string) => {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(entry.trim());
    try {
      fs.appendFileSync(debugLog, entry);
    } catch (e) {}
  };
  log(`Server starting. NODE_ENV: ${process.env.NODE_ENV}, CWD: ${process.cwd()}`);
  try {
    log(`Root contents: ${fs.readdirSync('/').join(', ')}`);
    log(`CWD contents: ${fs.readdirSync(process.cwd()).join(', ')}`);
  } catch (e) {
    log(`Failed to list directories: ${e}`);
  }

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      cwd: process.cwd(),
      dirname: __dirname
    });
  });

  app.get("/landing", (req, res) => {
    res.sendFile(path.join(process.cwd(), "landing.html"));
  });

  app.get("/api/debug-logs", (req, res) => {
    const debugLog = path.join(process.cwd(), "server_debug.log");
    if (fs.existsSync(debugLog)) {
      res.sendFile(debugLog);
    } else {
      res.send("No debug logs found.");
    }
  });

  app.post("/api/logs", (req, res) => {
    const { level, message, context, timestamp } = req.body;
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message} ${context ? JSON.stringify(context) : ""}\n`;
    
    console.log(logEntry.trim());

    // Append to logs/app.log
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }
    fs.appendFile(path.join(logDir, "app.log"), logEntry, (err) => {
      if (err) console.error("Failed to write to log file:", err);
    });

    res.status(200).json({ status: "ok" });
  });

  // Determine if we should serve static files or use Vite
  const distPath = path.join(process.cwd(), 'dist');
  const useStatic = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'));

  if (useStatic) {
    log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    
    // Handle SPA routing
    app.get('*', (req, res, next) => {
      // Skip API routes
      if (req.url.startsWith('/api/')) return next();
      
      log(`Request for: ${req.url} -> serving index.html`);
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath);
    });
  } else {
    log("dist directory not found or incomplete. Falling back to Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
