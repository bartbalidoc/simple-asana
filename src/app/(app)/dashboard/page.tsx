import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-900">My Tasks</h2>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">
          Welcome, <strong>{session?.user.name}</strong>!
        </p>
        <p className="text-gray-600 mt-2">
          Task dashboard will display your assigned tasks here.
        </p>
        <p className="text-gray-500 text-sm mt-4">
          Visit <a href="/projects" className="text-blue-600 hover:underline">Projects</a> to get started.
        </p>
      </div>
    </div>
  );
}
