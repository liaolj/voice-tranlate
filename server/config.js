export const config = {
  port: Number.parseInt(process.env.PORT ?? "8787", 10),
  astUrl:
    process.env.AST_URL ??
    "wss://openspeech.bytedance.com/api/v4/ast/v2/translate",
  appKey: process.env.AST_APP_KEY ?? "",
  accessKey: process.env.AST_ACCESS_KEY ?? "",
  resourceId: process.env.AST_RESOURCE_ID ?? "volc.service_type.10053",
};

export const hasAstCredentials = () =>
  Boolean(config.appKey && config.accessKey && config.resourceId);
