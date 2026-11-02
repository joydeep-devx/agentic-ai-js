import express from "express";
import { main } from "../services/ai.service.js";

export const router = express.Router();

/**
 * POST - /api/chat
 */
router.post("/", async (req, res) => {
  const { prompt } = req.body;
  const response = await main(prompt);
  res.json({ text: response });
});
