import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// Lazily initialize Gemini SDK Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is requested but not defined in Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. API: Server Health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // 1.5. API: Duplex CORS Proxy Endpoint to bypass browser security blocks dynamically
  app.all("/api/proxy", async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).json({ error: "Query parameter 'url' is required." });
      }

      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        return res.status(400).json({ error: "Invalid URL protocol. Must use HTTP or HTTPS." });
      }

      console.log(`[CORS Proxy] [${req.method}] Routing remote target: ${targetUrl}`);

      const headersToForward: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
      };

      // Forward X-Auth-Token, Authorization, Content-Type, Accept if client sends them
      const keysToForward = ["x-auth-token", "authorization", "content-type", "accept"];
      for (const key of keysToForward) {
        if (req.headers[key]) {
          headersToForward[key] = req.headers[key] as string;
        }
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers: headersToForward,
      };

      // Handle forwarding bodies for POST/PUT requests
      if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
        fetchOptions.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      }

      const proxyResponse = await fetch(targetUrl, fetchOptions);
      const contentType = proxyResponse.headers.get("content-type") || "text/plain";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");
      res.setHeader("Access-Control-Allow-Headers", "*");

      if (!proxyResponse.ok) {
        const errText = await proxyResponse.text();
        return res.status(proxyResponse.status).send(errText);
      }

      const buffer = await proxyResponse.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error("[CORS Proxy Failure]:", err);
      res.status(500).json({
        error: "Dynamic CORS proxy fetch failed.",
        message: err.message,
      });
    }
  });

  // 2. API: AI Channel Finder using server-side Gemini 3.5 Flash
  app.post("/api/ai/finder", async (req, res) => {
    try {
      const { prompt, channels } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Search query or request content required." });
      }

      // Check if API key is present
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Safe mock fallback with smart keywords inside server to prevent crash if not configured in secrets yet
        console.warn("GEMINI_API_KEY is missing. Fulfilling query via local index matching router...");
        const matchedChannels = (channels || [])
          .filter((ch: any) => {
            const word = prompt.toLowerCase();
            return (
              ch.name.toLowerCase().includes(word) ||
              ch.category.toLowerCase().includes(word)
            );
          })
          .map((ch: any) => ch.id);

        return res.json({
          reasoning: `🛸 **Local Adaptive Search Mode Active**\n\nI processed your search query: *"${prompt}"* using the local sensory matrix. Here are the aligned stream beacons I located below.\n\n*(Note: Configure the **GEMINI_API_KEY** in AI Studio's Settings > Secrets panel to unlock the full cognitive AI recommendations).*`,
          recommendedChannelIds: matchedChannels.slice(0, 4),
        });
      }

      const client = getGeminiClient();

      const channelsDataSimplified = (channels || []).map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        category: ch.category,
      }));

      const systemInstruction = `You are the premium Sazi TV Cyber Observatory virtual navigator.
Your task is to analyze the user's IPTV broadcast find request and recommend from the registered channels list.
Provide a helpful explanation of your suggestions in the 'reasoning' field as clean, concise Markdown, and return a list of exactly matching channel IDs in 'recommendedChannelIds'.
If no channels match perfectly, suggest the closest ones and explain why. Keep your explanation high-tech and warm.`;

      const contents = `User Request: "${prompt}"

Available Channel Beacons:
${JSON.stringify(channelsDataSimplified, null, 2)}`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reasoning: {
                type: Type.STRING,
                description: "Clean concise Markdown text explaining why these channels match the request.",
              },
              recommendedChannelIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Array of channel ID strings that match or are relevant recommendations.",
              },
            },
            required: ["reasoning", "recommendedChannelIds"],
          },
        },
      });

      const text = response.text || "{}";
      const parsedData = JSON.parse(text.trim());
      res.json(parsedData);

    } catch (err: any) {
      console.error("AI Finder backend failure:", err);
      res.status(500).json({
        error: "AI recommendation transmission interrupted.",
        message: err.message,
      });
    }
  });

  // 3. Mount Vite Dev Middleware / Serve Production Build Static Files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SAZI TV BACKEND] Cohesive IPTV server online running on port ${PORT}`);
  });
}

startServer();
