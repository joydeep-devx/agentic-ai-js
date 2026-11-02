import express from "express";
import { main } from "../services/ai.service.js";

export const router = express.Router();

/**
 * POST /api/chat
 */
router.post("/", async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await main(prompt);
    res.json({ response });
  } catch (error) {
    console.error("Error in /chat route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
