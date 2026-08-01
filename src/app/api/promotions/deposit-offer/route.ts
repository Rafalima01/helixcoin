import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleGetDepositOffer } from "@/modules/promotions/controllers/promotions-public.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleGetDepositOffer(req, auth)));
