import { userContext } from "~/lib/context";

import type { Route } from "./+types/index";

export function meta() {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export const middleware: Route.MiddlewareFunction[] = [
  async ({ context }) => {
    context.set(userContext, { name: "Test user" });
    console.log("[middleware] set user in context:", context.get(userContext));
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  console.log("[loader] get user from context:", user);
  return { user };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <div>Home {loaderData.user?.name}</div>;
}
