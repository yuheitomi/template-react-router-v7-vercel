# AGENTS guideline

## Commands

- `pnpm dev` - Start development server with HMR (http://localhost:5173)
- `pnpm build` - Production build
- `pnpm typecheck` - Run type checking
- `pnpm deploy` - Build and deploy to Cloudflare Workers
- `pnpm preview` - Preview production build locally

## Architecture

This template targets Vercel with React Router v7 SSR enabled end-to-end.

**Key technologies:**

- React Router v7 with SSR enabled and v8 middleware future flag
- Vercel integration through `@vercel/react-router` presets/adapters
- File-based routing via `react-router-auto-routes`
- Tailwind CSS v4

**Routing:**

- Routes are auto-generated from `app/routes/` directory
- `app/routes.ts` uses `autoRoutes()` to discover routes automatically
- Route files in `app/routes/` follow React Router's file-based routing conventions

**Project structure:**

- `app/` - Application code (routes, components, root layout)
- `app/routes/` - File-based routes
- `app/root.tsx` - Root layout component
- `react-router.config.ts` - React Router configuration
- `vite.config.ts` - Vite config with Tailwind, and React Router plugins

## React Router Best Practices

### File based Routing (react-router-auto-routes)

Convention-based file routing from `app/routes/` structure:

- `index.tsx` → matches parent path
- `_layout.tsx` → wraps child routes (no URL segment)
- `$param/` or `$param.tsx` → becomes `:param` in URL
- `$.tsx` → catch-all
- `+components/`, `+utils/` → colocated files (not routes)
- `+actions.server.ts` / `+actions.server/{actions}.ts` - Server actions
- `+utils.client.ts` - Client utilities

### Essential patterns

- Import from `react-router`, NOT `react-router-dom`
- Use `<Outlet />` in layouts for child routes
- Use `href()` function for type-safe URLs
- Loaders for data, Actions for form submission

### Middleware Patterns

- `+middleware.ts` - Route-specific middleware (e.g., data loading, context setup)
- Use `createContext()` from `react-router` for route-specific contexts
- Context values can be promises (async data loading)
- Middleware functions receive `{ request, context }` and return `next()` or redirect

## Development Best Practices

**Code Quality:**

- Avoid `any` types - use appropriate types or `unknown`
- Prefer nullish coalescing (`??`) over `||` operator
- Use Biome linting: `pnpm lint:fix`
- Always run `pnpm typecheck` after route changes

**Error Handling:**

- Wrap database calls in try/catch
- Validate organization slugs and IDs before queries
- Use proper error boundaries in components

**Documentation:**

See `./docs/` directory:

- `react-router-v7.md` - Essential best practices and patterns
- `react-router-v7-advanced.md` - Advanced techniques (auth, data loading, forms, caching)
