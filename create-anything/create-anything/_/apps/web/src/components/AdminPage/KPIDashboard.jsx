import { DollarSign, Users, Activity } from "lucide-react";
import { SummaryCards } from "./KPIDashboard/SummaryCards";
import { TasksCompleted } from "./KPIDashboard/TasksCompleted";
import { AccuracyDistribution } from "./KPIDashboard/AccuracyDistribution";
import { LevelDistribution } from "./KPIDashboard/LevelDistribution";
import { TimeStatistics } from "./KPIDashboard/TimeStatistics";

export function KPIDashboard({ analytics }) {
  if (!analytics) return null;

  const summaryData = [
    {
      icon: DollarSign,
      label: "Total Balance",
      value: `$${analytics.summary.totalBalance}`,
      color: "#2563FF",
    },
    {
      icon: Users,
      label: "Total Users",
      value: analytics.summary.totalUsers,
      color: "#2563FF",
    },
    {
      icon: Activity,
      label: "Active Users",
      value: analytics.summary.activeUsers,
      color: "#F59E0B",
    },
  ];

  return (
    <div className="space-y-6">
      <SummaryCards cards={summaryData} />
      <TasksCompleted summary={analytics.summary} />
      <AccuracyDistribution
        distribution={analytics.distribution.accuracy}
        totalUsers={analytics.summary.totalUsers}
      />
      <LevelDistribution distribution={analytics.distribution.level} />
      <TimeStatistics timeStats={analytics.timeStats} />
    </div>
  );
}

