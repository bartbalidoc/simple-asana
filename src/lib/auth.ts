import { type NextAuthOptions, type DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { writeAuditLog } from "./audit";

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
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user || !user.passwordHash || !user.isActive) {
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      // Credentials login is already verified in authorize()
      if (account?.provider === "credentials") {
        return true;
      }

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

          // Record the login for the Team Activity view. The `if (user)` branch
          // runs once per real sign-in (not on silent token refresh), so this is
          // our login-frequency signal. Best-effort — never block auth.
          try {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { lastSeenAt: new Date() },
            });
            await writeAuditLog({
              actorId: dbUser.id,
              action: "USER_LOGIN",
              resource: "user",
              resourceId: dbUser.id,
              // No NextRequest in NextAuth callbacks → ipAddress stays null.
            });
          } catch (e) {
            console.error("login activity capture failed:", e);
          }
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
    // 12h: one login covers a full workday (feedback: the 30-minute timeout
    // forced 3+ logins per shift). Idle-tab warning still comes from
    // SessionTimeoutWarning, which has its own (longer) idle timer.
    maxAge: 12 * 60 * 60,
  },
  jwt: {
    maxAge: 12 * 60 * 60,
  },
};
