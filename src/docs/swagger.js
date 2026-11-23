
import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Event Management API",
      version: "3.0.0",
      description: `
REST API для керування подіями, учасниками, квитками, локаціями та розкладом.

Сервер підтримує Socket.IO для обміну подіями в реальному часі.
Події Socket.IO описані в README.md.
      `.trim(),
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Локальний сервер",
      },
    ],
    tags: [
      { name: "Авторизація", description: "Реєстрація, вхід і керування токенами" },
      { name: "Користувачі", description: "Користувачі системи" },
      { name: "Події", description: "Керування подіями, учасниками, квитками, локаціями та розкладом" },
      { name: "Реєстрації", description: "Реєстрації учасників та видані квитки" },
      { name: "Файли", description: "Завантаження та керування файлами" },
      { name: "Сповіщення", description: "Персональні сповіщення користувачів" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Notification: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            userId: { type: "integer", example: 16 },
            type: { type: "string", example: "event:published" },
            priority: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH"],
              example: "MEDIUM",
            },
            message: {
              type: "string",
              example: "Подію опубліковано",
            },
            isRead: { type: "boolean", example: false },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string", example: "Необхідна авторизація" },
          },
        },
      },
    },
    paths: {
      "/api/events": {
        get: {
          tags: ["Події"], summary: "Отримати події організатора", security: [{ bearerAuth: [] }],
          parameters: [{ in: "query", name: "search", schema: { type: "string" } }, { in: "query", name: "page", schema: { type: "integer", minimum: 1 } }, { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100 } }],
          responses: { "200": { description: "Список подій з пагінацією" }, "401": { description: "Необхідна авторизація" } }
        },
        post: {
          tags: ["Події"], summary: "Створити подію", security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["title", "startsAt", "endsAt"], properties: { title: { type: "string", example: "IT Conference 2026" }, description: { type: "string" }, status: { type: "string", enum: ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"] }, startsAt: { type: "string", format: "date-time" }, endsAt: { type: "string", format: "date-time" }, venueId: { type: "integer", nullable: true }, capacity: { type: "integer", nullable: true } } } } } },
          responses: { "201": { description: "Подію створено" }, "400": { description: "Помилка валідації" } }
        }
      },
      "/api/events/venues": {
        get: { tags: ["Події"], summary: "Список локацій", security: [{ bearerAuth: [] }], responses: { "200": { description: "Локації" } } },
        post: { tags: ["Події"], summary: "Створити локацію", security: [{ bearerAuth: [] }], responses: { "201": { description: "Локацію створено" } } }
      },
      "/api/events/participants": {
        get: { tags: ["Події"], summary: "Список учасників", security: [{ bearerAuth: [] }], responses: { "200": { description: "Учасники" } } },
        post: { tags: ["Події"], summary: "Додати учасника", security: [{ bearerAuth: [] }], responses: { "201": { description: "Учасника збережено" } } }
      },
      "/api/events/registrations": {
        get: { tags: ["Реєстрації"], summary: "Список реєстрацій", security: [{ bearerAuth: [] }], responses: { "200": { description: "Реєстрації та видані квитки" } } }
      },
      "/api/events/{id}/registrations": {
        post: { tags: ["Реєстрації"], summary: "Зареєструвати учасника та видати квиток", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["participantId", "ticketTypeId"], properties: { participantId: { type: "integer" }, ticketTypeId: { type: "integer" } } } } } }, responses: { "201": { description: "Реєстрацію створено та квиток видано" }, "409": { description: "Немає місць або учасник уже зареєстрований" } } }
      },
      "/api/events/{id}/ticket-types": {
        get: { tags: ["Події"], summary: "Список типів квитків", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Типи квитків" } } },
        post: { tags: ["Події"], summary: "Створити тип квитка", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "201": { description: "Тип квитка створено" } } }
      },
      "/api/events/{id}/schedule": {
        get: { tags: ["Події"], summary: "Отримати розклад події", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Розклад" } } },
        post: { tags: ["Події"], summary: "Додати пункт розкладу", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "201": { description: "Пункт розкладу додано" } } }
      },
      "/api/events/{id}": {
        get: { tags: ["Події"], summary: "Деталі події", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Дані події" }, "404": { description: "Подію не знайдено" } } },
        put: { tags: ["Події"], summary: "Оновити подію", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Подію оновлено" }, "400": { description: "Некоректні дані" } } },
        delete: { tags: ["Події"], summary: "Видалити подію", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "204": { description: "Подію видалено" } } }
      },
      "/api/events/venues/{id}": {
        put: { tags: ["Події"], summary: "Оновити локацію", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Локацію оновлено" }, "409": { description: "Місткість несумісна з подіями" } } },
        delete: { tags: ["Події"], summary: "Видалити локацію", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "204": { description: "Локацію видалено" } } }
      },
      "/api/events/participants/{id}": {
        put: { tags: ["Події"], summary: "Оновити учасника", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Учасника оновлено" }, "409": { description: "Email вже використовується" } } },
        delete: { tags: ["Події"], summary: "Видалити учасника", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "204": { description: "Учасника видалено" } } }
      },
      "/api/events/tickets/{id}/check-in": {
        patch: { tags: ["Реєстрації"], summary: "Позначити квиток використаним під час входу", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Квиток відмічено як використаний" }, "404": { description: "Квиток не знайдено" }, "409": { description: "Квиток уже використано або скасовано" } } }
      },
      "/api/events/registrations/{id}/cancel": {
        patch: { tags: ["Реєстрації"], summary: "Скасувати реєстрацію та квитки", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Реєстрацію скасовано" }, "404": { description: "Реєстрацію не знайдено" } } }
      },
      "/api/events/{id}/ticket-types/{ticketTypeId}": {
        put: { tags: ["Події"], summary: "Оновити тип квитка", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }, { in: "path", name: "ticketTypeId", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Тип квитка оновлено" }, "409": { description: "Неможливо зменшити кількість нижче вже виданих" } } },
        delete: { tags: ["Події"], summary: "Видалити тип квитка без виданих квитків", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }, { in: "path", name: "ticketTypeId", required: true, schema: { type: "integer" } }], responses: { "204": { description: "Тип квитка видалено" }, "409": { description: "Тип уже використовувався" } } }
      },
      "/api/events/{id}/schedule/{itemId}": {
        put: { tags: ["Події"], summary: "Оновити пункт розкладу", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }, { in: "path", name: "itemId", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Пункт розкладу оновлено" }, "400": { description: "Час поза межами події" } } },
        delete: { tags: ["Події"], summary: "Видалити пункт розкладу", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }, { in: "path", name: "itemId", required: true, schema: { type: "integer" } }], responses: { "204": { description: "Пункт розкладу видалено" } } }
      },
      "/api/notifications": {
        get: {
          tags: ["Сповіщення"],
          summary: "Отримати сповіщення поточного користувача",
          description:
            "Повертає персональні сповіщення з пагінацією та кількістю непрочитаних сповіщень.",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: "query",
              name: "page",
              schema: { type: "integer", minimum: 1, default: 1 },
            },
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            },
          ],
          responses: {
            "200": {
              description: "Список сповіщень",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      notifications: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/Notification",
                        },
                      },
                      unreadCount: { type: "integer", example: 2 },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Необхідна авторизація",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/api/notifications/read-all": {
        patch: {
          tags: ["Сповіщення"],
          summary: "Позначити всі сповіщення прочитаними",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Сповіщення позначено прочитаними" },
            "401": { description: "Необхідна авторизація" },
          },
        },
      },
      "/api/notifications/{id}/read": {
        patch: {
          tags: ["Сповіщення"],
          summary: "Позначити сповіщення прочитаним",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": { description: "Сповіщення позначено прочитаним" },
            "401": { description: "Необхідна авторизація" },
            "404": { description: "Сповіщення не знайдено" },
          },
        },
      },
      "/api/notifications/{id}": {
        delete: {
          tags: ["Сповіщення"],
          summary: "Видалити власне сповіщення",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            "204": { description: "Сповіщення видалено" },
            "401": { description: "Необхідна авторизація" },
            "404": { description: "Сповіщення не знайдено" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
