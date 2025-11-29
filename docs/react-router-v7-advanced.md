# React Router v7 Framework Mode - Advanced Techniques

## Advanced Authentication & Session Management

### Cookie Session Storage

```tsx
// app/sessions.server.ts
import { createCookieSessionStorage } from "react-router";

// app/routes/protected.tsx
import { requireAuth } from "~/auth.server";

export const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: "__session",
    secrets: ["s3cret1"],
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

// app/auth.server.ts
export async function requireAuth(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");

  if (!userId) {
    throw redirect("/login", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }

  return userId;
}

export async function getUser(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");

  if (!userId) return null;

  return await db.user.findUnique({ where: { id: userId } });
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireAuth(request);
  const user = await db.user.findUnique({ where: { id: userId } });
  return { user };
}
```

### Login/Logout Flow

```tsx
// app/routes/login.tsx
import type { Route } from "./+types/login";
import { getSession, commitSession } from "~/sessions.server";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");

  const user = await authenticateUser(email, password);
  if (!user) {
    return data({ error: "Invalid credentials" }, { status: 400 });
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.set("userId", user.id);

  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

// app/routes/logout.tsx
export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));

  return redirect("/", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}
```

## Advanced Data Loading Patterns

### Combined Server/Client Loading with Hydration

```tsx
// app/routes/product-details.tsx
import type { Route } from "./+types/product-details";

// Server-side data load
export async function loader({ params }: Route.LoaderArgs) {
  return await database.getProduct(params.id);
}

// Additional client-side enhancements
export async function clientLoader({ serverLoader, params }: Route.ClientLoaderArgs) {
  // Get server data
  const serverData = await serverLoader();

  // Enhance with client-only data
  const userPreferences = JSON.parse(localStorage.getItem("preferences") || "{}");
  const viewHistory = JSON.parse(localStorage.getItem("viewHistory") || "[]");

  return {
    ...serverData,
    isFavorite: userPreferences.favorites?.includes(params.id),
    lastViewed: viewHistory.find((item: any) => item.id === params.id)?.timestamp,
    relatedProducts: await fetch(`/api/recommendations/${params.id}`).then((r) => r.json()),
  };
}

// For initial load hydration (run clientLoader during SSR hydration)
clientLoader.hydrate = true as const;

// Show during hydration
export function HydrateFallback() {
  return <ProductSkeleton />;
}

export default function ProductDetails({ loaderData }: Route.ComponentProps) {
  // Access both server and client data
  return (
    <div>
      <h1>{loaderData.name}</h1>
      {loaderData.isFavorite && <FavoriteIcon />}
      {loaderData.lastViewed && (
        <p>Last viewed: {new Date(loaderData.lastViewed).toLocaleDateString()}</p>
      )}
      <RelatedProducts products={loaderData.relatedProducts} />
    </div>
  );
}
```

### Conditional Data Loading

```tsx
// app/routes/dashboard.tsx
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const view = url.searchParams.get("view") || "overview";

  // Load different data based on query params
  const baseData = await getBaseDashboardData();

  switch (view) {
    case "analytics":
      return {
        ...baseData,
        analytics: await getAnalyticsData(),
        chartData: await getChartData(),
      };
    case "settings":
      return {
        ...baseData,
        settings: await getUserSettings(),
        billing: await getBillingInfo(),
      };
    default:
      return baseData;
  }
}
```

### Data Streaming and Deferred Loading

```tsx
// app/routes/dashboard.tsx
import { defer } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  // Load critical data immediately
  const user = await getUser(request);

  // Defer non-critical data
  const analytics = getAnalyticsData(); // Promise, don't await
  const reports = getReportsData(); // Promise, don't await

  return defer({
    user, // Available immediately
    analytics, // Streamed later
    reports, // Streamed later
  });
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1>Welcome, {loaderData.user.name}</h1>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <Await resolve={loaderData.analytics}>
          {(analytics) => <AnalyticsChart data={analytics} />}
        </Await>
      </Suspense>

      <Suspense fallback={<ReportsSkeleton />}>
        <Await resolve={loaderData.reports}>{(reports) => <ReportsTable data={reports} />}</Await>
      </Suspense>
    </div>
  );
}
```

## Advanced Form Handling & Validation

### Multi-Step Forms with Session State

```tsx
// app/routes/onboarding.step-1.tsx
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const session = await getSession(request.headers.get("Cookie"));

  // Store step data in session
  const onboardingData = session.get("onboarding") || {};
  onboardingData.step1 = {
    name: formData.get("name"),
    email: formData.get("email"),
  };
  session.set("onboarding", onboardingData);

  return redirect("/onboarding/step-2", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

// app/routes/onboarding.step-2.tsx
export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const onboardingData = session.get("onboarding");

  if (!onboardingData?.step1) {
    return redirect("/onboarding/step-1");
  }

  return { step1Data: onboardingData.step1 };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const session = await getSession(request.headers.get("Cookie"));
  const onboardingData = session.get("onboarding") || {};

  // Complete onboarding
  const user = await createUser({
    ...onboardingData.step1,
    preferences: formData.get("preferences"),
  });

  // Clear onboarding data and set user session
  session.unset("onboarding");
  session.set("userId", user.id);

  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
```

### Advanced Form Validation with Zod

```tsx
// app/routes/user-profile.tsx
import { z } from "zod";

const UpdateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
});

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const result = UpdateProfileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    bio: formData.get("bio"),
    website: formData.get("website"),
  });

  if (!result.success) {
    return data({ errors: result.error.flatten().fieldErrors }, { status: 400 });
  }

  await updateUserProfile(result.data);
  return data({ success: true });
}

export default function UserProfile({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <Form method="post">
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          defaultValue={loaderData.user.name}
          aria-invalid={actionData?.errors?.name ? true : undefined}
        />
        {actionData?.errors?.name && <div className="error">{actionData.errors.name[0]}</div>}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={loaderData.user.email}
          aria-invalid={actionData?.errors?.email ? true : undefined}
        />
        {actionData?.errors?.email && <div className="error">{actionData.errors.email[0]}</div>}
      </div>

      <button type="submit">Update Profile</button>

      {actionData?.success && <div className="success">Profile updated successfully!</div>}
    </Form>
  );
}
```

## Advanced Optimistic UI Patterns

### Optimistic Updates with Revalidation

```tsx
// app/routes/todo-list.tsx
function TodoItem({ todo }: { todo: Todo }) {
  const fetcher = useFetcher();

  // Optimistic state
  const optimisticCompleted = fetcher.formData
    ? fetcher.formData.get("completed") === "true"
    : todo.completed;

  return (
    <div className={optimisticCompleted ? "completed" : ""}>
      <fetcher.Form method="post" action="/api/todos/toggle">
        <input type="hidden" name="id" value={todo.id} />
        <input type="hidden" name="completed" value={(!optimisticCompleted).toString()} />
        <button type="submit" className={`toggle ${fetcher.state !== "idle" ? "pending" : ""}`}>
          {optimisticCompleted ? "✓" : "○"}
        </button>
      </fetcher.Form>
      <span>{todo.text}</span>
    </div>
  );
}

// Optimistic deletion
function DeleteButton({ todoId }: { todoId: string }) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post" action="/api/todos/delete">
      <input type="hidden" name="id" value={todoId} />
      <button type="submit" disabled={isDeleting} className={isDeleting ? "deleting" : ""}>
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
    </fetcher.Form>
  );
}
```

## Advanced Error Handling

### Global Error Boundary with Context

```tsx
// app/error-context.tsx
import { createContext, useContext } from "react";

interface ErrorContextType {
  reportError: (error: Error, context?: string) => void;
}

const ErrorContext = createContext<ErrorContextType | null>(null);

export function ErrorProvider({ children }: { children: React.ReactNode }) {
  const reportError = (error: Error, context?: string) => {
    // Send to error reporting service
    console.error(`Error in ${context}:`, error);
    // analytics.track('error', { message: error.message, context });
  };

  return <ErrorContext.Provider value={{ reportError }}>{children}</ErrorContext.Provider>;
}

export function useErrorReporting() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error("useErrorReporting must be used within ErrorProvider");
  }
  return context;
}

// app/root.tsx
export function ErrorBoundary() {
  const error = useRouteError();
  const { reportError } = useErrorReporting();

  useEffect(() => {
    reportError(error, "root");
  }, [error, reportError]);

  if (isRouteErrorResponse(error)) {
    return (
      <div className="error-page">
        <h1>
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
        <Link to="/">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="error-page">
      <h1>Oops! Something went wrong</h1>
      <p>We've been notified of this error and will fix it soon.</p>
      <Link to="/">Go Home</Link>
    </div>
  );
}
```

### Custom Error Types and Handling

```tsx
// app/errors.ts
export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// app/routes/admin.tsx
export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);

  if (!user?.isAdmin) {
    throw new UnauthorizedError("Admin access required");
  }

  return { adminData: await getAdminData() };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (error instanceof UnauthorizedError) {
    return (
      <div className="unauthorized">
        <h1>Access Denied</h1>
        <p>{error.message}</p>
        <Link to="/login">Login</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Error</h1>
      <p>{error.message}</p>
    </div>
  );
}
```

## Advanced Caching & Performance

### HTTP Caching Headers

```tsx
// app/routes/api.products.$id.tsx
export async function loader({ params }: Route.LoaderArgs) {
  const product = await db.product.findUnique({
    where: { id: params.id }
  });

  if (!product) {
    throw data("Product not found", { status: 404 });
  }

  return data(product, {
    headers: {
      "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      "ETag": `"${product.updatedAt.getTime()}"`,
    },
  });
}

// Conditional requests
export async function loader({ request, params }: Route.LoaderArgs) {
  const product = await db.product.findUnique({
    where: { id: params.id }
  });

  if (!product) {
    throw data("Product not found", { status: 404 });
  }

  const etag = `"${product.updatedAt.getTime()}"`;
  const ifNoneMatch = request.headers.get("If-None-Match");

  if (ifNoneMatch === etag) {
    return data(null, { status: 304 }); // Not Modified
  }

  return data(product, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "ETag": etag,
    },
  });
}
```

### Client-Side Caching with Browser APIs

```tsx
// app/utils/cache.ts
class ClientCache {
  private cache = new Map();

  async get(key: string) {
    // Try memory cache first
    if (this.cache.has(key)) {
      const { data, expiry } = this.cache.get(key);
      if (Date.now() < expiry) {
        return data;
      }
      this.cache.delete(key);
    }

    // Try IndexedDB for persistent cache
    if ("indexedDB" in window) {
      return await this.getFromIndexedDB(key);
    }

    return null;
  }

  set(key: string, data: any, ttl: number = 5 * 60 * 1000) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data, expiry });

    // Also store in IndexedDB
    if ("indexedDB" in window) {
      this.setInIndexedDB(key, { data, expiry });
    }
  }

  private async getFromIndexedDB(key: string) {
    // IndexedDB implementation
    return null;
  }

  private async setInIndexedDB(key: string, value: any) {
    // IndexedDB implementation
  }
}

export const clientCache = new ClientCache();

// app/routes/products.$id.tsx
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const cacheKey = `product-${params.id}`;

  // Try cache first
  const cached = await clientCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from API
  const product = await fetch(`/api/products/${params.id}`).then((r) => r.json());

  // Cache the result
  clientCache.set(cacheKey, product);

  return product;
}
```

## Advanced Real-Time Features

### WebSocket Integration

```tsx
// app/utils/websocket.ts
class WebSocketManager {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<(data: any) => void>>();

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(process.env.WS_URL || "ws://localhost:3001");

    this.ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      const typeListeners = this.listeners.get(type);
      if (typeListeners) {
        typeListeners.forEach((listener) => listener(data));
      }
    };

    this.ws.onclose = () => {
      // Reconnect after delay
      setTimeout(() => this.connect(), 1000);
    };
  }

  subscribe(type: string, callback: (data: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    return () => {
      const typeListeners = this.listeners.get(type);
      if (typeListeners) {
        typeListeners.delete(callback);
      }
    };
  }

  send(type: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }
}

export const wsManager = new WebSocketManager();

// app/routes/chat.tsx
export default function Chat({ loaderData }: Route.ComponentProps) {
  const [messages, setMessages] = useState(loaderData.messages);
  const revalidator = useRevalidator();

  useEffect(() => {
    wsManager.connect();

    const unsubscribe = wsManager.subscribe("new_message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    const unsubscribeUserJoined = wsManager.subscribe("user_joined", () => {
      // Revalidate to get updated user list
      revalidator.revalidate();
    });

    return () => {
      unsubscribe();
      unsubscribeUserJoined();
    };
  }, [revalidator]);

  const sendMessage = (message: string) => {
    wsManager.send("send_message", { message });
  };

  return (
    <div>
      <MessageList messages={messages} />
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
```

## Advanced Security Patterns

### CSRF Protection

```tsx
// app/utils/csrf.server.ts
import { createCookieSessionStorage } from "react-router";

const { getSession, commitSession } = createCookieSessionStorage({
  cookie: {
    name: "__csrf",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
});

export async function generateCSRFToken(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  const token = crypto.randomUUID();
  session.set("csrfToken", token);

  return {
    token,
    cookie: await commitSession(session),
  };
}

export async function validateCSRFToken(request: Request, token: string) {
  const session = await getSession(request.headers.get("Cookie"));
  const sessionToken = session.get("csrfToken");

  if (!sessionToken || sessionToken !== token) {
    throw data("Invalid CSRF token", { status: 403 });
  }
}

// app/routes/protected-form.tsx
export async function loader({ request }: Route.LoaderArgs) {
  const { token, cookie } = await generateCSRFToken(request);

  return data({ csrfToken: token }, { headers: { "Set-Cookie": cookie } });
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const csrfToken = formData.get("_csrf");

  await validateCSRFToken(request, csrfToken);

  // Process form...
  return { success: true };
}

export default function ProtectedForm({ loaderData }: Route.ComponentProps) {
  return (
    <Form method="post">
      <input type="hidden" name="_csrf" value={loaderData.csrfToken} />
      <input name="data" placeholder="Enter data" />
      <button type="submit">Submit</button>
    </Form>
  );
}
```

### Rate Limiting

```tsx
// app/utils/rate-limit.server.ts
interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: Request) => string;
}

class RateLimit {
  private requests = new Map<string, number[]>();

  constructor(private options: RateLimitOptions) {}

  check(request: Request): boolean {
    const key = this.options.keyGenerator?.(request) || this.getIP(request);
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const userRequests = this.requests.get(key)!;

    // Clean old requests
    const validRequests = userRequests.filter((time) => time > windowStart);

    if (validRequests.length >= this.options.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  private getIP(request: Request): string {
    return request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  }
}

const loginRateLimit = new RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
});

// app/routes/login.tsx
export async function action({ request }: Route.ActionArgs) {
  if (!loginRateLimit.check(request)) {
    throw data("Too many login attempts, please try again later", { status: 429 });
  }

  // Process login...
}
```

## Rendering Strategies

### Static Pre-rendering with Dynamic Routes

```tsx
// react-router.config.ts
export default {
  async prerender() {
    // Static routes
    const staticRoutes = ["/", "/about", "/contact"];

    // Dynamic routes from database
    const products = await db.product.findMany({ select: { id: true } });
    const productRoutes = products.map((p) => `/products/${p.id}`);

    const categories = await db.category.findMany({ select: { slug: true } });
    const categoryRoutes = categories.map((c) => `/categories/${c.slug}`);

    return [...staticRoutes, ...productRoutes, ...categoryRoutes];
  },
} satisfies Config;
```

### Hybrid Rendering Strategy

```tsx
// react-router.config.ts
export default {
  ssr: true,
  async prerender({ getStaticPaths }) {
    // Pre-render popular pages
    const popularProducts = await getPopularProducts();
    return popularProducts.map((p) => `/products/${p.id}`);
  },
} satisfies Config;

// app/routes/products.$id.tsx
export async function loader({ params, context }: Route.LoaderArgs) {
  // This will run on server for SSR and pre-rendered pages
  const product = await db.product.findUnique({
    where: { id: params.id },
  });

  if (!product) {
    throw data("Product not found", { status: 404 });
  }

  return { product, isPrerendered: context.isPrerendered };
}
```
