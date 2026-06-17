import { Session } from "next-auth";

export interface CustomSession extends Session {
  user: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "MEMBER";
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
