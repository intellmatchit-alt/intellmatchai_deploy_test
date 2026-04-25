import path from "path";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import express from "express";

const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml"));

export function setupSwagger(app: any): void {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  app.get("/api-docs.json", (_req: any, res: any) => {
    res.json(swaggerDocument);
  });
}

