export const notes = [
  {
    id: 1,
    topic: "JavaScript Promises",
    content:
      "Promises in JavaScript are objects that represent the eventual completion or failure of an asynchronous operation. They have three states: pending, fulfilled, and rejected. The then() method handles successful results, while catch() handles errors.",
  },
  {
    id: 2,
    topic: "Async Await",
    content:
      "Async and await provide a cleaner way to write asynchronous JavaScript code. The async keyword makes a function return a Promise, while await pauses execution inside an async function until a Promise settles. Try-catch blocks can be used to handle errors.",
  },
  {
    id: 3,
    topic: "JavaScript Event Loop",
    content:
      "The event loop is responsible for coordinating synchronous and asynchronous operations in JavaScript. It manages the call stack, task queue, and microtask queue. Promise callbacks are processed through the microtask queue.",
  },
  {
    id: 4,
    topic: "React Components",
    content:
      "React applications are built using reusable components. A component is an independent piece of user interface that can contain its own logic and presentation. Components help developers organize large applications into smaller manageable parts.",
  },
  {
    id: 5,
    topic: "React State",
    content:
      "State in React is data that belongs to a component and can change over time. The useState hook allows functional components to maintain state. When state changes, React schedules a re-render to update the user interface.",
  },
  {
    id: 6,
    topic: "Node.js Event Loop",
    content:
      "Node.js uses an event-driven, non-blocking I/O model. Its event loop allows it to handle multiple operations without waiting synchronously for tasks such as file reading or network requests to finish.",
  },
  {
    id: 7,
    topic: "MongoDB Indexing",
    content:
      "Indexes in MongoDB improve the speed of database queries by allowing the database to locate documents without scanning every document in a collection. However, indexes consume storage and can increase the cost of write operations.",
  },
  {
    id: 8,
    topic: "Database Transactions",
    content:
      "Database transactions ensure that a group of operations is executed reliably. ACID properties include atomicity, consistency, isolation, and durability. Transactions are useful when multiple database operations must succeed or fail together.",
  },
  {
    id: 9,
    topic: "REST APIs",
    content:
      "REST is an architectural style for designing web APIs. It commonly uses HTTP methods such as GET, POST, PUT, PATCH, and DELETE to perform operations on resources. APIs usually exchange data in JSON format.",
  },
  {
    id: 10,
    topic: "Authentication and JWT",
    content:
      "JSON Web Tokens are commonly used for stateless authentication. After a successful login, a server can issue a signed token to the client. The client sends this token with subsequent requests so the server can verify the user's identity.",
  },
  {
    id: 11,
    topic: "Machine Learning",
    content:
      "Machine learning is a field of artificial intelligence where systems learn patterns from data to make predictions or decisions. Common learning approaches include supervised learning, unsupervised learning, and reinforcement learning.",
  },
  {
    id: 12,
    topic: "Neural Networks",
    content:
      "Neural networks are machine learning models inspired by interconnected neurons. They consist of layers of nodes that process input data and learn patterns by adjusting weights during training using optimization algorithms.",
  },
];
