import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vigilanciaRouter from "./vigilancia";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vigilanciaRouter);

export default router;
