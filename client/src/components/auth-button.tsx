import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

export function AuthButton() {
  const { data } = useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      const response = await fetch("/api/auth");
      return response.json();
    },
  });

  if (!data) return null;

  console.log(data);

  if (data.authenticated) {
    return (
      <div className="fixed right-4 top-4 flex gap-2 items-center">
        <img src={data.profile.avatar} className="w-8 h-8 rounded-full" />
        <a href="/api/logout" />
      </div>
    );
  }

  return (
    <Link to="/login" className="fixed right-4 top-4">
      Login
    </Link>
  );
}
