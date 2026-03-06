import { Users, TrendingUp, Activity } from "lucide-react";
import { SummaryCards } from "./KPIDashboard/SummaryCards";
import { AccuracyDistribution } from "./KPIDashboard/AccuracyDistribution";
import { LevelDistribution } from "./KPIDashboard/LevelDistribution";
import { TimeStatistics } from "./KPIDashboard/TimeStatistics";
import { SuspiciousUsers } from "./UserAnalyticsTab/SuspiciousUsers";
import { ActiveUsersTable } from "./UserAnalyticsTab/ActiveUsersTable";

export function UserAnalyticsTab({ userAnalytics }) {
  if (!userAnalytics) return null;

  const summaryData = [
    {
      icon: Users,
      label: "Total Users",
      value: userAnalytics.summary.totalUsers,
      color: "#2563FF",
    },
    {
      icon: TrendingUp,
      label: "Acceptance Rate",
      value: `${userAnalytics.summary.acceptanceRate}%`,
      color: "#10B981",
    },
    {
      icon: Activity,
      label: "Repeat Rate",
      value: `${userAnalytics.summary.repeatRate}%`,
      color: "#F59E0B",
    },
  ];

  return (
    <div className="space-y-6">
      <SummaryCards cards={summaryData} />
      <AccuracyDistribution
        distribution={userAnalytics.distribution.accuracy}
        totalUsers={userAnalytics.summary.totalUsers}
      />
      <LevelDistribution distribution={userAnalytics.distribution.level} />
      <TimeStatistics timeStats={userAnalytics.timeStats} />
      {userAnalytics.suspiciousUsers.length > 0 && (
        <SuspiciousUsers users={userAnalytics.suspiciousUsers} />
      )}
      <ActiveUsersTable users={userAnalytics.activeUsers} />
    </div>
  );
}

