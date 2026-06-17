import { type NextAuthOptions, type DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "MEMBER";
    } & DefaultSession["user"];
  }

  interface JWT {
    id?: string;
    role?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
      if (!allowedDomain) {
        return true;
      }

      const email = profile?.email || account?.providerAccountId || "";
      const isAllowed = email.endsWith(`@${allowedDomain}`);

      if (!isAllowed) {
        return false;
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (user && !user.isActive) {
        return false;
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        try {
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
          });

          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || "User",
              },
            });
          }

          token.id = dbUser.id;
          token.role = dbUser.role;
        } catch (error) {
          console.error("Error creating/fetching user:", error);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "MEMBER";
      }

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 60,
  },
  jwt: {
    maxAge: 30 * 60,
  },
};
