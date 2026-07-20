/**
 * Reference wiring for the module convention (src/modules/_template) —
 * proves route → controller → service → repository → events → audit →
 * error handling → response envelope all connect correctly end to end.
 * Not a product feature: delete this route (and _template) once real
 * modules exist to copy the pattern from.
 *
 * Lives at `template-reference`, not `_template` — Next.js App Router
 * treats a leading-underscore folder under `app/` as a private folder and
 * silently excludes it from routing (this bit us once already: the route
 * built with zero errors and simply didn't exist).
 */
import { createRouteHandler } from "@/server/http";
import {
  handleCreateTemplateItem,
  handleListTemplateItems,
} from "@/modules/_template/controllers/template-item.controller";

export const GET = createRouteHandler(handleListTemplateItems);
export const POST = createRouteHandler(handleCreateTemplateItem);
