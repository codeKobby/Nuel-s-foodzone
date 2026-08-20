import { redirect } from "next/navigation";

export default function LegacyMenuRedirect() {
  redirect("/dinner/menu");
}
