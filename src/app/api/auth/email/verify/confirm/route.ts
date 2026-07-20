import { createRouteHandler } from "@/server/http";
import { handleConfirmEmailVerification } from "@/modules/identity/controllers/email-verification.controller";

export const POST = createRouteHandler(handleConfirmEmailVerification);
