# ER-діаграма Event Management System

```mermaid
erDiagram
    USER ||--o{ EVENT : organizes
    VENUE ||--o{ EVENT : hosts
    EVENT ||--o{ SCHEDULE : contains
    EVENT ||--o{ TICKET_TYPE : offers
    EVENT ||--o{ REGISTRATION : receives
    PARTICIPANT ||--o{ REGISTRATION : makes
    REGISTRATION ||--o{ TICKET : issues
    TICKET_TYPE ||--o{ TICKET : categorizes
    USER ||--o{ REFRESH_TOKEN : owns
    USER ||--o{ UPLOADED_FILE : uploads
    USER ||--o{ NOTIFICATION : receives

    USER {
      int id PK
      string name
      string email UK
      string passwordHash
      enum role
    }
    EVENT {
      int id PK
      string title
      string description
      enum status
      datetime startsAt
      datetime endsAt
      int capacity
      int venueId FK
      int organizerId FK
    }
    VENUE {
      int id PK
      string name
      string address
      string city
      int capacity
    }
    PARTICIPANT {
      int id PK
      string name
      string email UK
      string phone
    }
    REGISTRATION {
      int id PK
      int eventId FK
      int participantId FK
      string status
      datetime registeredAt
    }
    TICKET_TYPE {
      int id PK
      int eventId FK
      string name
      decimal price
      int quantity
    }
    TICKET {
      int id PK
      string code UK
      int registrationId FK
      int ticketTypeId FK
      string status
    }
    SCHEDULE {
      int id PK
      int eventId FK
      string title
      datetime startsAt
      datetime endsAt
      string speaker
      string location
    }
```

## Основні зв'язки

- Один організатор може створити багато подій; кожна подія має одного організатора.
- Одна локація може приймати багато подій; подія може бути без призначеної локації.
- Подія містить багато пунктів розкладу та типів квитків.
- Учасник може реєструватися на різні події; для пари «подія — учасник» встановлено унікальне обмеження.
- Реєстрація може містити один або кілька квитків.
- Кожен квиток належить одному типу квитка.
