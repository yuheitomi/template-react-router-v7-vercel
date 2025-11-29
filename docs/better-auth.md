# **Instruction: Better Auth Setup (React Router + Drizzle + D1)**

Follow these steps to integrate authentication into a React Router v7 application running on Cloudflare Workers with D1 and Drizzle.

## **1. Dependencies**

Install the core package and Drizzle adapter using pnpm.

- `pnpm add better-auth drizzle-orm`
- `pnpm add -D drizzle-kit`

## **2. Cloudflare D1 Setup (wrangler.jsonc)**

Configure your D1 database binding. This links the Cloudflare environment to your code.

```jsonc
// wrangler.jsonc
"d1_databases": [
    {
        "binding": "DB", // Accessed in code as env.DB
        "database_name": "my-app-db",
        "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // From: npx wrangler d1 create my-app-db
        "migrations_dir": "drizzle" // Must match drizzle.config.ts 'out'
    }
]
```

## **3. Server Configuration (auth.server.ts)**

Initialize Better Auth with the Drizzle adapter first. This allows you to configure plugins and options before generating the schema.

```ts
// app/lib/auth.server.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "~/db"; // Your Drizzle D1 instance

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Add social providers or plugins here
});
```

## **4. Database Schema (Auto-Generate)**

Use the Better Auth CLI to generate the Drizzle schema. Point it explicitly to your auth file and desired output location to automate the process.

```bash
pnpx @better-auth/cli generate --config ./app/lib/auth.server.ts --output ./app/db/schema.ts --yes
```

- --config: Specifies the path to your Better Auth instance defined in Step 3.
- --output: Saves the generated schema directly to your Drizzle schema file.
- --yes: Skips interactive prompts.

## **5. Drizzle Config**

Create a drizzle.config.ts file in your project root to configure Drizzle Kit.

```typescript
// drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http", // or "d1" if using local D1 exclusively
} satisfies Config;
```

## **6. API Route Mount**

Create a "Resource Route" in React Router to handle auth requests. This acts as the API endpoint.

```typescript
// app/routes/api.auth.$.ts
import { auth } from "~/lib/auth.server";
import type { Route } from "./+types/api.auth.$"; // RRv7 Type Gen or standard LoaderArgs

export async function loader({ request }: Route.LoaderArgs) {
  return auth.handler(request);
}

export async function action({ request }: Route.ActionArgs) {
  return auth.handler(request);
}
```

## **7. Client Configuration (auth-client.ts)**

Create the client-side hook for React components.

```typescript
// app/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:5173", // Set to your production URL in env
});

export const { signIn, signUp, useSession, signOut } = authClient;
```

## **8. Environment Variables**

Ensure .env (and Cloudflare secrets) contains:

- BETTER_AUTH_SECRET: A generated secure string.
- BETTER_AUTH_URL: The full URL of your app (e.g., https://myapp.pages.dev).

## **9. Migration**

Use Drizzle Kit to generate migrations and apply them to Cloudflare D1.

```bash
# Generate SQL migration files based on your schema
pnpm drizzle-kit generate

# Apply migrations to local D1 (dev)
pnpm wrangler d1 migrations apply my-app-db --local

# Apply migrations to remote D1 (prod)
pnpm wrangler d1 migrations apply my-app-db --remote
```
