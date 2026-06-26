import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import * as path from "path";

// ─── Tags corporativos aplicados a todos los recursos del stack ───────────────
const TAGS: Record<string, string> = {
  proyecto:     "Identera",
  cliente:      "Itera / Preventa",
  arquitecto:   "Juan Castillo",
  arquitecto2:  "Juan Pablo Molina",
  arquitecto3:  "Andryd Ibarra",
  PM:           "Xiomara Valencia",
  Aprobador:    "Sebastian Sanchez",
};

export class IdenteraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Aplica los tags a todos los recursos del stack de una vez
    Object.entries(TAGS).forEach(([key, value]) =>
      cdk.Tags.of(this).add(key, value)
    );

    // =========================================================================
    // 1. DYNAMODB — tabla única (single-table design)
    //    PK + SK idénticos al diseño original
    // =========================================================================
    const table = new dynamodb.Table(this, "IdenteraTable", {
      tableName:    "IdenteraDB",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey:      { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // protege datos en cdk destroy
      pointInTimeRecovery: true,
    });

    // =========================================================================
    // 2. VARIABLES DE ENTORNO COMUNES para todas las Lambdas
    // =========================================================================
    const commonEnv: Record<string, string> = {
      DYNAMODB_TABLE_NAME:                table.tableName,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
    };

    // =========================================================================
    // 3. HELPER — crea una Lambda Node.js 20 con configuración base compartida
    //    Cada Lambda vive en backend/handlers/{domain}/
    // =========================================================================
    const createLambda = (
      constructId: string,
      functionName: string,
      domain: string,       // nombre de la subcarpeta en backend/handlers/
      description: string,
      extraEnv?: Record<string, string>
    ): lambda.Function => {
      return new lambda.Function(this, constructId, {
        functionName,
        runtime: lambda.Runtime.NODEJS_20_X,
        // El código de cada Lambda está en backend/handlers/{domain}/
        // El bundling instala sus dependencias (node_modules) en el paquete
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../../backend/handlers", domain),
          {
            bundling: {
              image: lambda.Runtime.NODEJS_20_X.bundlingImage,
              // Bundling local sin Docker: copia shared/ e instala deps
              local: {
                tryBundle(outputDir: string): boolean {
                  const { execSync } = require("child_process");
                  const sourceDir = path.join(__dirname, "../../backend/handlers", domain);
                  const sharedDir = path.join(__dirname, "../../backend/handlers/shared");
                  try {
                    // Copiar el código del handler al outputDir
                    execSync(`cp -r "${sourceDir}/." "${outputDir}"`);
                    // Copiar shared/ para que require('../shared/db') funcione
                    execSync(`cp -r "${sharedDir}" "${outputDir}/shared"`);
                    // Instalar solo dependencias de producción
                    execSync(`cd "${outputDir}" && npm install --omit=dev`, { stdio: "inherit" });
                    return true;
                  } catch (e) {
                    console.error("Local bundling failed:", e);
                    return false;
                  }
                },
              },
              // Fallback Docker si local falla
              command: [
                "bash", "-c",
                [
                  "cp -rT /asset-input /asset-output",
                  "cp -r /asset-input/../shared /asset-output/shared",
                  "cd /asset-output && npm ci --omit=dev",
                ].join(" && "),
              ],
            },
          }
        ),
        handler: "index.handler",
        timeout:    cdk.Duration.seconds(30),
        memorySize: 512,
        environment: { ...commonEnv, ...extraEnv },
        description,
        logRetention: logs.RetentionDays.ONE_MONTH,
      });
    };

    // =========================================================================
    // 4. LAMBDAS — una por dominio de negocio
    // =========================================================================
    const lambdaValidaciones = createLambda(
      "LambdaValidaciones",
      "identera-lambda-validaciones",
      "validaciones",
      "CRUD de validaciones y carnets escaneados"
    );

    const lambdaUsuarios = createLambda(
      "LambdaUsuarios",
      "identera-lambda-usuarios",
      "usuarios",
      "Autenticación y gestión de usuarios"
    );

    const lambdaQr = createLambda(
      "LambdaQr",
      "identera-lambda-qr",
      "qr",
      "Generación y regeneración de códigos QR"
    );

    const lambdaCarnets = createLambda(
      "LambdaCarnets",
      "identera-lambda-carnets",
      "carnets",
      "Creación y edición de carnets de identidad"
    );

    // Permisos DynamoDB CRUD para todas las Lambdas
    [lambdaValidaciones, lambdaUsuarios, lambdaQr, lambdaCarnets].forEach((fn) =>
      table.grantReadWriteData(fn)
    );

    // =========================================================================
    // 5. API GATEWAY REST
    // =========================================================================
    const api = new apigateway.RestApi(this, "IdenteraApi", {
      restApiName: "identera-api",
      description: "API REST de Identera — carnets, usuarios, validaciones y QR",
      deployOptions: {
        stageName:        "prod",
        loggingLevel:     apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled:   true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-api-key"],
      },
    });

    const intValidaciones = new apigateway.LambdaIntegration(lambdaValidaciones);
    const intUsuarios     = new apigateway.LambdaIntegration(lambdaUsuarios);
    const intQr           = new apigateway.LambdaIntegration(lambdaQr);
    const intCarnets      = new apigateway.LambdaIntegration(lambdaCarnets);

    // ── /validaciones ─────────────────────────────────────────────────────────
    const rValidaciones = api.root.addResource("validaciones");
    rValidaciones.addMethod("GET",  intValidaciones); // GET  /validaciones?userId=
    rValidaciones.addMethod("POST", intValidaciones); // POST /validaciones?role=

    rValidaciones.addResource("{id}")
      .addMethod("DELETE", intValidaciones);           // DELETE /validaciones/{id}

    // ── /login ────────────────────────────────────────────────────────────────
    api.root.addResource("login")
      .addMethod("POST", intUsuarios);                 // POST /login

    // ── /usuarios ─────────────────────────────────────────────────────────────
    const rUsuarios = api.root.addResource("usuarios");
    rUsuarios.addMethod("GET",  intUsuarios);          // GET  /usuarios
    rUsuarios.addMethod("POST", intUsuarios);          // POST /usuarios

    const rUsuarioByEmail = rUsuarios.addResource("{email}");
    rUsuarioByEmail.addMethod("DELETE", intUsuarios);  // DELETE /usuarios/{email}
    rUsuarioByEmail.addResource("profile")
      .addMethod("PATCH", intUsuarios);                // PATCH  /usuarios/{email}/profile
    rUsuarioByEmail.addResource("status")
      .addMethod("PATCH", intUsuarios);                // PATCH  /usuarios/{email}/status
    rUsuarioByEmail.addResource("role")
      .addMethod("PATCH", intUsuarios);                // PATCH  /usuarios/{email}/role

    // ── /qr ───────────────────────────────────────────────────────────────────
    const rQrRegenerar = api.root.addResource("qr").addResource("regenerar");
    rQrRegenerar.addMethod("GET",  intQr);             // GET  /qr/regenerar
    rQrRegenerar.addMethod("POST", intQr);             // POST /qr/regenerar

    // ── /carnets ──────────────────────────────────────────────────────────────
    const rCarnets = api.root.addResource("carnets");
    rCarnets.addMethod("GET",  intCarnets);            // GET  /carnets
    rCarnets.addMethod("POST", intCarnets);            // POST /carnets
    rCarnets.addResource("{carnetId}")
      .addMethod("PATCH", intCarnets);                 // PATCH /carnets/{carnetId}

    // =========================================================================
    // 6. OUTPUTS
    // =========================================================================
    new cdk.CfnOutput(this, "ApiUrl", {
      value:       api.url,
      description: "URL base del API Gateway — usar como VITE_API_URL en el frontend",
      exportName:  "IdenteraApiUrl",
    });
    new cdk.CfnOutput(this, "DynamoTableName", {
      value:       table.tableName,
      description: "Nombre de la tabla DynamoDB",
      exportName:  "IdenteraTableName",
    });
    new cdk.CfnOutput(this, "LambdaValidacionesArn", {
      value: lambdaValidaciones.functionArn, exportName: "IdenteraLambdaValidacionesArn",
    });
    new cdk.CfnOutput(this, "LambdaUsuariosArn", {
      value: lambdaUsuarios.functionArn, exportName: "IdenteraLambdaUsuariosArn",
    });
    new cdk.CfnOutput(this, "LambdaQrArn", {
      value: lambdaQr.functionArn, exportName: "IdenteraLambdaQrArn",
    });
    new cdk.CfnOutput(this, "LambdaCarnetArn", {
      value: lambdaCarnets.functionArn, exportName: "IdenteraLambdaCarnetArn",
    });
  }
}
