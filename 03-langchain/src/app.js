import express from "express";
import { router as chatRoutes } from "./routes/chat.route.js";
const app = express();

app.use(express.json());

app.use("/api/chat", chatRoutes);

export default app;
