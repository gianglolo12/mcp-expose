import { v4 as uuidv4 } from "uuid";

export interface User {
  id: string;
  createdAt: Date;
  lastActiveAt: Date;
}

const users = new Map<string, User>();

export function generateUserId(): string {
  return uuidv4().split("-")[0]; // Short 8-char ID
}

export function registerUser(customId?: string): User {
  const id = customId || generateUserId();

  if (users.has(id)) {
    const existing = users.get(id)!;
    existing.lastActiveAt = new Date();
    return existing;
  }

  const user: User = {
    id,
    createdAt: new Date(),
    lastActiveAt: new Date(),
  };
  users.set(id, user);
  return user;
}

export function getUser(id: string): User | null {
  const user = users.get(id);
  if (user) {
    user.lastActiveAt = new Date();
  }
  return user || null;
}

export function listUsers(): User[] {
  return Array.from(users.values());
}

export function deleteUser(id: string): boolean {
  return users.delete(id);
}

export function userExists(id: string): boolean {
  return users.has(id);
}
