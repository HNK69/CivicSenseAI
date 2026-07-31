import { createFileRoute } from "@tanstack/react-router";
import { AuthenticationLayout } from "@/components/auth/AuthenticationLayout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CivicSenseAI — Sign in to the Civic Intelligence Platform" },
      {
        name: "description",
        content:
          "Sign in to CivicSenseAI as a citizen or officer. Report civic issues, track resolutions and coordinate municipal response with AI-assisted triage.",
      },
      { property: "og:title", content: "CivicSenseAI — Civic Intelligence Platform" },
      {
        property: "og:description",
        content:
          "Smarter civic intelligence. Connecting citizens and officers through AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <AuthenticationLayout />;
}
