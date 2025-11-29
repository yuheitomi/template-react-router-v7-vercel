import { createContext } from "react-router";

interface User {
	name: string;
}

export const userContext = createContext<User | null>(null);
