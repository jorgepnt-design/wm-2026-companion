import { createContext, useContext, type ReactNode } from "react";
import { useGoalAlerts } from "../hooks/useGoalAlerts";

type GoalAlerts = ReturnType<typeof useGoalAlerts>;

const GoalAlertsContext = createContext<GoalAlerts | null>(null);

export function GoalAlertsProvider({ children }: { children: ReactNode }) {
  const value = useGoalAlerts();
  return <GoalAlertsContext.Provider value={value}>{children}</GoalAlertsContext.Provider>;
}

export function useGoalAlertsContext(): GoalAlerts {
  const ctx = useContext(GoalAlertsContext);
  if (!ctx) throw new Error("useGoalAlertsContext muss innerhalb von GoalAlertsProvider verwendet werden.");
  return ctx;
}
