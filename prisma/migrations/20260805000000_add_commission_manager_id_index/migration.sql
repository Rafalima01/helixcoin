-- Commission.managerId had no covering index. Both ManagerService.getDashboard
-- (sumAmountCents({managerId})) and the new getNetworkWithStats
-- (getNetworkAggregates({managerId}) groupBy) filter by managerId alone,
-- which at scale (millions of Commission rows) forced a full table scan.
CREATE INDEX "Commission_managerId_idx" ON "Commission"("managerId");
