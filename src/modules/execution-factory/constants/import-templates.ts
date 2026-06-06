export const OPENAPI_OPERATOR_TEMPLATE = `openapi: "3.0.3"
info:
  title: "示例算子 API"
  description: "请描述算子的功能与用途"
  version: "1.0.0"
servers:
  - url: "http://127.0.0.1:9000"
paths:
  /execute:
    post:
      summary: "执行算子"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
      responses:
        "200":
          description: "成功"
`;

export const OPENAPI_TOOLBOX_TEMPLATE = `openapi: "3.0.3"
info:
  title: "示例工具箱 API"
  version: "1.0.0"
servers:
  - url: "http://127.0.0.1:9000"
paths:
  /sample:
    get:
      summary: "示例工具"
      responses:
        "200":
          description: "成功"
`;
