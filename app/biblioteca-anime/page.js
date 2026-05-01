import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AnimeLibraryIndexPage() {
  redirect("/biblioteca-anime/en-seguimiento");
}
