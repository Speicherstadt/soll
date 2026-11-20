import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/*
 * The tables of Better Auth (users, sessions, accounts, organizations, members, invitations,
 * passkeys), as better-auth 1.7 with the organization, username and passkey plugins expects them
 * (getAuthTables). They belong to Better Auth: no betrieb_id, outside the audit chain; changes of
 * membership and role reach the chain through hooks (src/auth/hooks.ts, CLAUDE.md).
 */

const zeit = (name: string) => integer(name, { mode: "timestamp_ms" });
const ja = (name: string) => integer(name, { mode: "boolean" });

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: ja("email_verified").notNull(),
  image: text("image"),
  createdAt: zeit("created_at").notNull(),
  updatedAt: zeit("updated_at").notNull(),
  username: text("username").unique(),
  displayUsername: text("display_username"),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: zeit("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: zeit("created_at").notNull(),
  updatedAt: zeit("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: zeit("access_token_expires_at"),
  refreshTokenExpiresAt: zeit("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: zeit("created_at").notNull(),
  updatedAt: zeit("updated_at").notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: zeit("expires_at").notNull(),
  createdAt: zeit("created_at").notNull(),
  updatedAt: zeit("updated_at").notNull(),
});

export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: zeit("created_at").notNull(),
  metadata: text("metadata"),
});

export const member = sqliteTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: zeit("created_at").notNull(),
});

export const invitation = sqliteTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull(),
  expiresAt: zeit("expires_at").notNull(),
  createdAt: zeit("created_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const passkey = sqliteTable("passkey", {
  id: text("id").primaryKey(),
  name: text("name"),
  publicKey: text("public_key").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  credentialID: text("credential_id").notNull(),
  counter: integer("counter").notNull(),
  deviceType: text("device_type").notNull(),
  backedUp: ja("backed_up").notNull(),
  transports: text("transports"),
  createdAt: zeit("created_at"),
  aaguid: text("aaguid"),
});
