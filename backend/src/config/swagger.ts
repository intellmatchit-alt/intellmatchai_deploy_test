import path from "path";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { Express } from "express";

const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml"));

const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "IntellMatch API Documentation",
  swaggerOptions: {
    persistAuthorization: true,
    filter: true,
    tagsSorter: "alpha",
    operationsSorter: "alpha",
    docExpansion: "none",
    defaultModelsExpandDepth: 2,
  },
};

export function setupSwagger(app: Express): void {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, swaggerUiOptions),
  );

  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerDocument);
  });
}
