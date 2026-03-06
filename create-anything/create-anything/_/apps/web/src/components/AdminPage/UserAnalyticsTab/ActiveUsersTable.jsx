export function ActiveUsersTable({ users }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-6">
      <h3 className="text-[16px] font-semibold text-[#2B2B2B] mb-4">
        Recently Active Users
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F1F1F1]">
              <th className="text-left text-[12px] font-medium text-[#7A7A7A] pb-3">
                Email
              </th>
              <th className="text-left text-[12px] font-medium text-[#7A7A7A] pb-3">
                Level
              </th>
              <th className="text-left text-[12px] font-medium text-[#7A7A7A] pb-3">
                Tasks
              </th>
              <th className="text-left text-[12px] font-medium text-[#7A7A7A] pb-3">
                Accuracy
              </th>
              <th className="text-left text-[12px] font-medium text-[#7A7A7A] pb-3">
                Avg Time
              </th>
              <th className="text-left text-[12px] font-medium text-[#7A7A7A] pb-3">
                Last Login
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-[#F6F6F6] last:border-0"
              >
                <td className="py-3 text-[13px] text-[#2B2B2B]">
                  {user.email}
                </td>
                <td className="py-3 text-[13px] text-[#2563FF] font-medium">
                  Lv{user.level}
                </td>
                <td className="py-3 text-[13px] text-[#7A7A7A]">
                  {user.correctTasks}/{user.completedTasks}
                </td>
                <td className="py-3 text-[13px] text-[#7A7A7A]">
                  {user.accuracyRate.toFixed(1)}%
                </td>
                <td className="py-3 text-[13px] text-[#7A7A7A]">
                  {(user.avgTimeMs / 1000).toFixed(2)}s
                </td>
                <td className="py-3 text-[12px] text-[#7A7A7A]">
                  {new Date(user.lastLoginAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

