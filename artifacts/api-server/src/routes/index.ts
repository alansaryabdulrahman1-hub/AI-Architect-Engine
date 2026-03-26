import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai";
import architectureRouter from "./architecture";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/openai", openaiRouter);
router.use("/architecture", architectureRouter);

export default router;
