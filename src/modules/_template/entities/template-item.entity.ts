/**
 * Domain entity — the shape business logic operates on. Deliberately NOT
 * the Prisma model type: a repository implementation maps between this and
 * whatever the persistence layer uses, so the service layer never depends
 * on Prisma's generated types directly (swap persistence without touching
 * business logic).
 */
export interface TemplateItem {
  id: string;
  name: string;
  createdAt: Date;
}
