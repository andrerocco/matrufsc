import * as Sentry from "@sentry/solid";

Sentry.init({
    dsn: "https://5588216dbedb1b9d8030a87937ba8b90@o4512504391598081.ingest.us.sentry.io/4512504393826304",
    enabled: import.meta.env.PROD,
    // The data fetches and the plan in the URL catch their errors and only log them.
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});
