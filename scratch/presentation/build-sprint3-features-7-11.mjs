import fs from "node:fs/promises";
import path from "node:path";

import {
  Presentation,
  PresentationFile,
  column,
  row,
  grid,
  text,
  rule,
  fill,
  hug,
  wrap,
  fixed,
  fr,
  auto,
} from "file:///C:/Users/hyper/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";
import { paint } from "file:///C:/Users/hyper/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/presentation-jsx/index.mjs";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "output");
const SCRATCH_DIR = path.join(ROOT, "scratch", "presentation");
const PREVIEW_DIR = path.join(SCRATCH_DIR, "previews");
const PARITY_DIR = path.join(SCRATCH_DIR, "pptx-parity");
const OUTPUT_PPTX = path.join(
  OUTPUT_DIR,
  "sprint-3-features-7-11-presentation.pptx",
);
const FALLBACK_OUTPUT_PPTX = path.join(
  OUTPUT_DIR,
  "sprint-3-features-7-11-presentation-updated.pptx",
);

const SLIDE = { width: 1920, height: 1080 };
const FRAME = { left: 0, top: 0, width: SLIDE.width, height: SLIDE.height };

const colors = {
  ink: "#0F172A",
  muted: "#475569",
  soft: "#CBD5E1",
  pale: "#F8FAFC",
  accent: "#0F766E",
  accent2: "#2563EB",
  warm: "#B45309",
  danger: "#BE123C",
};

function setBackground(slide, color = colors.pale) {
  slide.background.fill = paint(color);
}

function compose(slide, tree) {
  slide.compose(tree, { frame: FRAME, baseUnit: 8 });
}

function sectionLabel(value) {
  return text(value, {
    name: `label-${value.toLowerCase().replaceAll(/\s+/g, "-")}`,
    width: fill,
    height: hug,
    style: {
      fontSize: 18,
      bold: true,
      color: colors.accent,
    },
  });
}

function titleText(value, width = wrap(1340), size = 54) {
  return text(value, {
    name: `title-${value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
    width,
    height: hug,
    style: {
      fontSize: size,
      bold: true,
      color: colors.ink,
    },
  });
}

function bodyText(name, value, width = fill, size = 24, color = colors.muted) {
  return text(value, {
    name,
    width,
    height: hug,
    style: {
      fontSize: size,
      color,
    },
  });
}

function codeText(name, value) {
  return text(value, {
    name,
    width: fill,
    height: hug,
    style: {
      fontFamily: "Consolas",
      fontSize: 22,
      color: colors.ink,
    },
  });
}

function miniCodeText(name, value) {
  return text(value, {
    name,
    width: fill,
    height: hug,
    style: {
      fontFamily: "Consolas",
      fontSize: 18,
      color: colors.ink,
    },
  });
}

function footerText(value) {
  return text(value, {
    name: `footer-${value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
    width: fill,
    height: hug,
    style: {
      fontSize: 16,
      color: colors.muted,
    },
  });
}

function stepBlock(number, title, detail) {
  return column({ width: fill, height: hug, gap: 8 }, [
    text(`${number}. ${title}`, {
      name: `step-${number}-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
      width: fill,
      height: hug,
      style: {
        fontSize: 26,
        bold: true,
        color: colors.ink,
      },
    }),
    bodyText(
      `step-detail-${number}`,
      detail,
      fill,
      22,
      colors.muted,
    ),
  ]);
}

function challengeCell({ name, title, wrongCode, fix }) {
  return column({ name, width: fill, height: hug, gap: 10 }, [
    text(title, {
      name: `${name}-title`,
      width: fill,
      height: hug,
      style: {
        fontSize: 25,
        bold: true,
        color: colors.ink,
      },
    }),
    codeText(`${name}-wrong-code`, wrongCode),
    bodyText(`${name}-fix`, `Fix: ${fix}`, fill, 20, colors.muted),
  ]);
}

function addTitleSlide(presentation) {
  const slide = presentation.slides.add();
  setBackground(slide, "#FFFFFF");

  compose(
    slide,
    row(
      {
        name: "title-root",
        width: fill,
        height: fill,
        padding: { x: 96, y: 80 },
        gap: 56,
      },
      [
        column({ width: wrap(980), height: fill, gap: 20 }, [
          sectionLabel("Sprint 3 Presentation"),
          titleText("Sprint 3: Features 7 and 11", wrap(980), 62),
          rule({
            name: "title-rule",
            width: fixed(220),
            stroke: colors.accent,
            weight: 6,
          }),
          bodyText(
            "title-subtitle",
            "Node.js + TypeScript + Express + Prisma\nA walkthrough of request flow, Prisma integration, HTMX rendering, debugging, and the move from in-memory logic to database-backed repositories.",
            wrap(930),
            28,
            colors.muted,
          ),
          bodyText(
            "title-name",
            "Prepared by: Team 8\nPresenter name: Your Name",
            wrap(640),
            24,
            colors.ink,
          ),
          footerText(
            "6-minute live demo deck. The name field is editable because no presenter name was provided in the request.",
          ),
        ]),
        column(
          {
            width: fill,
            height: fill,
            gap: 12,
          },
          [
            text("07", {
              name: "ghost-seven",
              width: fill,
              height: hug,
              style: {
                fontSize: 220,
                bold: true,
                color: "#D9F3EE",
              },
            }),
            text("11", {
              name: "ghost-eleven",
              width: fill,
              height: hug,
              style: {
                fontSize: 220,
                bold: true,
                color: "#DBEAFE",
              },
            }),
            bodyText(
              "ghost-caption",
              "Two Sprint 3 features, one shared architecture: session-aware routes, thin controllers, focused services, and Prisma repositories that own the query details.",
              wrap(520),
              24,
              colors.muted,
            ),
          ],
        ),
      ],
    ),
  );
}

function addFeatureSevenSlide(presentation) {
  const slide = presentation.slides.add();
  setBackground(slide);

  compose(
    slide,
    column(
      {
        name: "feature-seven-root",
        width: fill,
        height: fill,
        padding: { x: 96, y: 68 },
        gap: 28,
      },
      [
        sectionLabel("Feature Demo – My RSVPs"),
        titleText("My RSVPs Dashboard", wrap(1200), 52),
        bodyText(
          "feature-seven-intro",
          "The /my-rsvps flow now stays clean: the route requires a session, the controller reads session.authenticatedUser, the service takes only userId, and Prisma loads RSVP rows from eventAttendee.",
          wrap(1500),
          26,
          colors.muted,
        ),
        column({ name: "feature-seven-content", width: fill, height: fill, gap: 14 }, [
          stepBlock(
            "1",
            "Session authentication",
            "Express session middleware stores the authenticated user, and the /my-rsvps route only continues when requireAuthenticated confirms that session state exists.",
          ),
          stepBlock(
            "2",
            "Route -> controller -> service",
            "showMyRSVPs pulls const user = session.authenticatedUser!, extracts userId, handles the role gate in the controller, and then calls this.service.getMyRSVPs(userId).",
          ),
          stepBlock(
            "3",
            "Repository and Prisma",
            "PrismaEventRepository.getRSVPsByUser uses eventAttendee.findMany({ where: { userId }, include: { event: true } }) and returns rows with event data attached.",
          ),
          stepBlock(
            "4",
            "Service responsibility",
            "The service does not authorize. It only turns the repository rows into upcoming and past buckets by checking RSVP status and event end time.",
          ),
          bodyText(
            "feature-seven-code-label",
            "Actual code used in this flow:",
            fill,
            20,
            colors.muted,
          ),
          miniCodeText(
            "feature-seven-code",
            `const user = session.authenticatedUser!;\nconst userId = user.userId;\nconst result = await this.service.getMyRSVPs(userId);\n\nawait this.prisma.eventAttendee.findMany({\n  where: { userId },\n  include: { event: true },\n});`,
          ),
          footerText(
            "That keeps session and rendering concerns in the controller while the repository owns the Prisma query.",
          ),
        ]),
      ],
    ),
  );
}

function addFeatureElevenSlide(presentation) {
  const slide = presentation.slides.add();
  setBackground(slide);

  compose(
    slide,
    column(
      {
        name: "feature-eleven-root",
        width: fill,
        height: fill,
        padding: { x: 96, y: 68 },
        gap: 28,
      },
      [
        sectionLabel("Feature Demo – Archive"),
        titleText("Past Event Archive", wrap(1280), 52),
        bodyText(
          "feature-eleven-intro",
          "The archive page follows the same separation: authenticated route, thin controller, tiny service, and a repository query that filters past events directly in Prisma.",
          wrap(1520),
          26,
          colors.muted,
        ),
        column({ name: "feature-eleven-content", width: fill, height: fill, gap: 14 }, [
          stepBlock(
            "1",
            "Authenticated route",
            "GET /events/archive first passes through requireAuthenticated, so only logged-in users can reach the archive controller.",
          ),
          stepBlock(
            "2",
            "Category passed through cleanly",
            "showArchive reads req.query.category and passes that optional filter straight into this.service.getArchivedEvents(category).",
          ),
          stepBlock(
            "3",
            "Service delegates to repository",
            "EventService.getArchivedEvents no longer loops over all events. It now returns this.repo.getArchivedEvents(category) and lets Prisma own the date filter.",
          ),
          stepBlock(
            "4",
            "Prisma query",
            "PrismaEventRepository.getArchivedEvents uses event.findMany with endDatetime < new Date(), an optional category filter, and startDatetime descending.",
          ),
          bodyText(
            "feature-eleven-code-label",
            "Actual repository query:",
            fill,
            20,
            colors.muted,
          ),
          miniCodeText(
            "feature-eleven-code",
            `const events = await this.prisma.event.findMany({\n  where: {\n    endDatetime: { lt: new Date() },\n    ...(category ? { category: { equals: category } } : {}),\n  },\n  orderBy: { startDatetime: "desc" },\n});`,
          ),
          footerText(
            "The service is intentionally thin here: it just delegates to the repository and returns the Result.",
          ),
        ]),
      ],
    ),
  );
}

function addChallengesSlide(presentation) {
  const slide = presentation.slides.add();
  setBackground(slide, "#FFFCF8");

  compose(
    slide,
    column(
      {
        name: "challenges-root",
        width: fill,
        height: fill,
        padding: { x: 92, y: 64 },
        gap: 24,
      },
      [
        sectionLabel("Technical Challenges"),
        titleText("Technical Challenges", wrap(1320), 50),
        bodyText(
          "challenges-intro",
          "These are the three bugs that actually changed the final architecture for Features 7 and 11.",
          wrap(1500),
          24,
          colors.muted,
        ),
        grid(
          {
            name: "challenge-grid",
            width: fill,
            height: fill,
            columns: [fr(1), fr(1)],
            rows: [auto, auto],
            columnGap: 52,
            rowGap: 26,
          },
          [
            challengeCell({
              name: "hardcoded-role",
              title: "Session vs hardcoded role bug",
              wrongCode: `if (role === "staff") {\n  res.redirect("/events");\n  return;\n}`,
              fix: "The access decision belongs in the controller because it is an HTTP/session concern. The controller now reads session.authenticatedUser and handles the block before calling the service.",
            }),
            challengeCell({
              name: "result-pattern",
              title: "Misused Result contract",
              wrongCode: `if (!result.ok) {\n  return result.error.message;\n}`,
              fix: "This project stores both success and failure payloads on result.value. Using result.error breaks because the local Result type is { ok, value }.",
            }),
            challengeCell({
              name: "service-vs-repo",
              title: "Logic in the wrong layer",
              wrongCode: `const result = await repo.listEvents();\nconst past = result.value.filter(...);\nreturn Ok(past);`,
              fix: "Archive filtering belonged in PrismaEventRepository.findMany, so the service now delegates instead of reading all events and filtering in memory.",
            }),
          ],
        ),
      ],
    ),
  );
}

function addAiSlide(presentation) {
  const slide = presentation.slides.add();
  setBackground(slide, "#FFFFFF");

  compose(
    slide,
    column(
      {
        name: "ai-root",
        width: fill,
        height: fill,
        padding: { x: 96, y: 70 },
        gap: 26,
      },
      [
        sectionLabel("Generative AI Experience"),
        titleText("Generative AI Experience", wrap(1380), 50),
        row({ name: "ai-columns", width: fill, height: fill, gap: 64 }, [
          column({ width: fill, height: fill, gap: 16 }, [
            text("What AI helped with", {
              name: "ai-helped-title",
              width: fill,
              height: hug,
              style: {
                fontSize: 30,
                bold: true,
                color: colors.accent,
              },
            }),
            bodyText(
              "ai-helped-body",
              "AI was useful for drafting Prisma query shapes, sketching the controller -> service -> repository structure, and suggesting the HTMX split between full-page renders and partial updates.",
              wrap(760),
              24,
              colors.muted,
            ),
            bodyText(
              "ai-helped-detail",
              "That saved time on first-pass scaffolding, especially for eventAttendee.findMany and archive filtering with an optional category condition.",
              wrap(760),
              22,
              colors.muted,
            ),
          ]),
          column({ width: fill, height: fill, gap: 16 }, [
            text("What AI got wrong", {
              name: "ai-wrong-title",
              width: fill,
              height: hug,
              style: {
                fontSize: 30,
                bold: true,
                color: colors.danger,
              },
            }),
            bodyText(
              "ai-wrong-body",
              "AI also hallucinated fake APIs and wrong local conventions. The clearest example was suggesting result.error even though this codebase stores failures in result.value.",
              wrap(760),
              24,
              colors.muted,
            ),
            bodyText(
              "ai-wrong-detail",
              "It also pushed the wrong architecture at times: role checks in the service, archive filtering outside the repository, and code samples that did not match the real Prisma calls.",
              wrap(760),
              22,
              colors.muted,
            ),
          ]),
        ]),
        footerText(
          "The productive pattern was: let AI draft, then compare every suggestion against the real Result type, route flow, and repository contracts.",
        ),
      ],
    ),
  );
}

function addArchitectureSlide(presentation) {
  const slide = presentation.slides.add();
  setBackground(slide);

  compose(
    slide,
    column(
      {
        name: "architecture-root",
        width: fill,
        height: fill,
        padding: { x: 96, y: 68 },
        gap: 28,
      },
      [
        sectionLabel("Code Walkthrough"),
        titleText("Architecture", wrap(1280), 52),
        bodyText(
          "architecture-intro",
          "These two features follow the same shape: controller for HTTP and session concerns, service for orchestration and view-model shaping, repository for Prisma queries.",
          wrap(1500),
          26,
          colors.muted,
        ),
        row({ name: "architecture-pipeline", width: fill, height: hug, gap: 26 }, [
          text("Session + Route", {
            name: "pipeline-1",
            width: wrap(220),
            height: hug,
            style: { fontSize: 30, bold: true, color: colors.ink },
          }),
          text("->", {
            name: "pipeline-arrow-1",
            width: fixed(60),
            height: hug,
            style: { fontSize: 34, bold: true, color: colors.accent2 },
          }),
          text("Controller", {
            name: "pipeline-2",
            width: wrap(180),
            height: hug,
            style: { fontSize: 30, bold: true, color: colors.ink },
          }),
          text("->", {
            name: "pipeline-arrow-2",
            width: fixed(60),
            height: hug,
            style: { fontSize: 34, bold: true, color: colors.accent2 },
          }),
          text("Service", {
            name: "pipeline-3",
            width: wrap(160),
            height: hug,
            style: { fontSize: 30, bold: true, color: colors.ink },
          }),
          text("->", {
            name: "pipeline-arrow-3",
            width: fixed(60),
            height: hug,
            style: { fontSize: 34, bold: true, color: colors.accent2 },
          }),
          text("Prisma Repository", {
            name: "pipeline-4",
            width: wrap(260),
            height: hug,
            style: { fontSize: 30, bold: true, color: colors.ink },
          }),
          text("->", {
            name: "pipeline-arrow-4",
            width: fixed(60),
            height: hug,
            style: { fontSize: 34, bold: true, color: colors.accent2 },
          }),
          text("SQLite via Prisma", {
            name: "pipeline-5",
            width: wrap(260),
            height: hug,
            style: { fontSize: 30, bold: true, color: colors.ink },
          }),
        ]),
        rule({
          name: "architecture-rule",
          width: fill,
          stroke: colors.soft,
          weight: 2,
        }),
        row({ name: "architecture-body", width: fill, height: fill, gap: 56 }, [
          column({ width: fill, height: fill, gap: 16 }, [
            bodyText(
              "architecture-left-1",
              "Feature 7 starts in the controller: read session.authenticatedUser, decide whether the request is allowed, then call getMyRSVPs(userId). The service shapes rows into upcoming and past groups.",
              wrap(740),
              24,
              colors.muted,
            ),
            bodyText(
              "architecture-left-2",
              "Feature 11 is even thinner. The controller passes category, the service delegates, and the repository runs a single Prisma query for archived events.",
              wrap(740),
              24,
              colors.muted,
            ),
          ]),
          column({ width: fill, height: fill, gap: 16 }, [
            bodyText(
              "architecture-right-1",
              "That separation matters because Prisma details stay close to the data layer: relation includes, date filters, category filters, and ordering do not leak into controllers.",
              wrap(740),
              24,
              colors.muted,
            ),
            bodyText(
              "architecture-right-2",
              "Compared with the earlier in-memory approach, the final version is easier to test, easier to explain, and closer to the intended separation of concerns.",
              wrap(740),
              24,
              colors.muted,
            ),
          ]),
        ]),
      ],
    ),
  );
}

function addCodeControllerSlide(presentation) {
  const slide = presentation.slides.add();
  setBackground(slide, "#F8FAFC");

  compose(
    slide,
    column(
      {
        name: "code-controller-root",
        width: fill,
        height: fill,
        padding: { x: 96, y: 68 },
        gap: 24,
      },
      [
        sectionLabel("Code Slide – Controller"),
        titleText("Controller", fixed(760), 50),
        bodyText(
          "code-controller-intro",
          "This slide shows the real `showMyRSVPs` controller flow. The controller owns the session read and the access decision, then passes only userId into the service.",
          wrap(1480),
          24,
          colors.muted,
        ),
        codeText(
          "show-my-rsvps-code",
          `const user = session.authenticatedUser!;\nconst userId = user.userId;\n\nconst result = await this.service.getMyRSVPs(userId);\n\nres.render("my-rsvps", {\n  upcoming: result.value.upcoming,\n  past: result.value.past,\n});`,
        ),
        footerText(
          "In the real controller, the organizer/staff block happens before this call, and HTMX uses the same method for partial rendering.",
        ),
      ],
    ),
  );
}

function addCodeRepositorySlide(presentation) {
  const slide = presentation.slides.add();
  setBackground(slide, "#FFFCF8");

  compose(
    slide,
    column(
      {
        name: "code-repo-root",
        width: fill,
        height: fill,
        padding: { x: 96, y: 68 },
        gap: 24,
      },
      [
        sectionLabel("Code Slide – Prisma Repository"),
        column({ name: "repo-title-stack", width: fill, height: hug, gap: 0 }, [
          text("Repository", {
            name: "repo-title-line-1",
            width: fill,
            height: hug,
            style: { fontSize: 44, bold: true, color: colors.ink },
          }),
        ]),
        bodyText(
          "code-repo-intro",
          "This is the real archive query shape: Prisma owns the past-event filter and the ordering, and the optional category clause is added only when it exists.",
          wrap(1480),
          24,
          colors.muted,
        ),
        codeText(
          "get-archived-events-code",
          `const events = await this.prisma.event.findMany({\n  where: {\n    endDatetime: { lt: new Date() },\n    ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),\n  },\n  orderBy: { startDatetime: "desc" },\n});\nreturn Ok(events.map((e) => toEvent(e)));`,
        ),
        footerText(
          "Compared with the older service-level array filtering, this version is simpler, faster, and easier to explain in the architecture story.",
        ),
      ],
    ),
  );
}

function addCodeHtmxSlide(presentation) {
  const slide = presentation.slides.add();
  setBackground(slide, "#FFFFFF");

  compose(
    slide,
    column(
      {
        name: "code-htmx-root",
        width: fill,
        height: fill,
        padding: { x: 96, y: 68 },
        gap: 24,
      },
      [
        sectionLabel("Code Slide – HTMX Branch"),
        titleText("HTMX", wrap(1120), 46),
        bodyText(
          "code-htmx-intro",
          "The archive controller shows the HTMX branch clearly: same data, different render target depending on the request header.",
          wrap(1480),
          24,
          colors.muted,
        ),
        codeText(
          "archive-htmx-code",
          `if (req.get("HX-Request") === "true") {\n  return res.render("partials/archive-list", {\n    events: result.value,\n    session,\n    layout: false,\n  });\n}\n\nreturn res.render("archive", { pageError: null, session, events: result.value });`,
        ),
        footerText(
          "Feature 7 uses the same idea during RSVP toggles: HTMX refreshes only the dashboard columns instead of reloading the full page.",
        ),
      ],
    ),
  );
}

async function writeBlob(filePath, blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await fs.writeFile(filePath, bytes);
}

async function saveDeckWithFallback(pptx) {
  try {
    await pptx.save(OUTPUT_PPTX);
    return OUTPUT_PPTX;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EBUSY") {
      await pptx.save(FALLBACK_OUTPUT_PPTX);
      return FALLBACK_OUTPUT_PPTX;
    }
    throw error;
  }
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  await fs.mkdir(PARITY_DIR, { recursive: true });

  const presentation = Presentation.create({
    slideSize: { width: SLIDE.width, height: SLIDE.height },
  });

  addTitleSlide(presentation);
  addFeatureSevenSlide(presentation);
  addFeatureElevenSlide(presentation);
  addChallengesSlide(presentation);
  addAiSlide(presentation);
  addArchitectureSlide(presentation);
  addCodeControllerSlide(presentation);
  addCodeRepositorySlide(presentation);
  addCodeHtmxSlide(presentation);

  const sourceSlides = presentation.slides.items;
  for (let index = 0; index < sourceSlides.length; index += 1) {
    const png = await sourceSlides[index].export();
    const filePath = path.join(
      PREVIEW_DIR,
      `slide-${String(index + 1).padStart(2, "0")}.png`,
    );
    await writeBlob(filePath, png);
  }

  const pptx = await PresentationFile.exportPptx(presentation);
  const savedPath = await saveDeckWithFallback(pptx);

  const savedDeck = await fs.readFile(savedPath);
  const parityDeck = await PresentationFile.importPptx(new Uint8Array(savedDeck));
  const paritySlides = parityDeck.slides.items;

  for (let index = 0; index < paritySlides.length; index += 1) {
    const png = await paritySlides[index].export();
    const filePath = path.join(
      PARITY_DIR,
      `slide-${String(index + 1).padStart(2, "0")}.png`,
    );
    await writeBlob(filePath, png);
  }

  const summary = {
    exportedDeck: savedPath,
    previewDir: PREVIEW_DIR,
    parityDir: PARITY_DIR,
    slideCount: sourceSlides.length,
  };

  await fs.writeFile(
    path.join(SCRATCH_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
