import { useState, useRef } from "react";
import { Text, Box, useInput } from "ink";
import { TextInput, CheckboxSelect } from "../components/text-input.js";
import { SoulkillerProtocolPanel } from "../animation/soulkiller-protocol-panel.js";
import { WorldDistillPanel } from "../components/world-distill-panel.js";
import { WorldDistillReview } from "./world-distill-review.js";
import {
  createWorld,
  worldExists,
  deleteWorld,
  saveWorld,
  loadWorld,
} from "../../world/manifest.js";
import { loadAllEntries } from "../../world/entry.js";
import {
  WorldDistiller,
  type WorldDistillProgress,
  type GeneratedEntry,
} from "../../world/distill.js";
import { captureWorld } from "../../agent/world-capture-agent.js";
import { WorldCaptureStrategy } from "../../agent/strategy/world-capture-strategy.js";
import { extractPageContent } from "../../agent/search/page-extractor.js";
import { getLLMClient } from "../../llm/client.js";
import { loadConfig } from "../../config/loader.js";
import { AgentLogger } from "../../utils/agent-logger.js";
import {
  parseWorldTags,
  emptyWorldTagSet,
  type WorldTagSet,
} from "../../tags/world-taxonomy.js";
import { bindWorld } from "../../world/binding.js";
import type {
  WorldType,
  WorldClassification,
} from "../../agent/strategy/world-dimensions.js";
import type { CaptureProgress } from "../../agent/strategy/capture-strategy.js";
import type {
  ToolCallDisplay,
  AgentPhase,
  SearchPlanDimDisplay,
} from "../animation/soulkiller-protocol-panel.js";
import { PRIMARY, ACCENT, DIM, DARK, WARNING } from "../animation/colors.js";
import { t } from "../../i18n/index.js";
import { logger } from "../../utils/logger.js";

/**
 * Flow:
 *   type-select → name → name-conflict? → display-name → description → tags → confirm
 *   → data-sources
 *   → [if web-search] capturing → search-confirm
 *   → [if markdown/url] source-path
 *   → distilling → review → creating → bind-prompt? → done
 */
type WorldCreateStep =
  | "type-select"
  | "name"
  | "name-conflict"
  | "display-name"
  | "description"
  | "tags"
  | "confirm"
  | "data-sources"
  | "capturing"
  | "search-confirm"
  | "source-path"
  | "distilling"
  | "review"
  | "creating"
  | "bind-prompt"
  | "done"
  | "error";

type DataSourceOption = "web-search" | "markdown" | "url-list";

const TYPE_OPTIONS: { value: WorldType; labelKey: string; descKey: string }[] =
  [
    {
      value: "fictional-existing",
      labelKey: "world.type.fictional_existing",
      descKey: "world.type.fictional_existing_desc",
    },
    {
      value: "fictional-original",
      labelKey: "world.type.fictional_original",
      descKey: "world.type.fictional_original_desc",
    },
    {
      value: "real",
      labelKey: "world.type.real",
      descKey: "world.type.real_desc",
    },
  ];

interface WorldCreateWizardProps {
  soulDir?: string;
  /** When provided, enter supplement mode directly (skip to data-sources) */
  supplementWorld?: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function WorldCreateWizard({
  soulDir,
  supplementWorld,
  onComplete,
  onCancel,
}: WorldCreateWizardProps) {
  // If supplementWorld provided, load manifest and start at data-sources
  const initState = (() => {
    if (supplementWorld) {
      const existing = loadWorld(supplementWorld);
      if (existing) {
        return {
          step: "data-sources" as WorldCreateStep,
          worldName: existing.name,
          displayName: existing.display_name,
          description: existing.description,
          worldType: existing.worldType,
          tags: existing.tags,
          supplementMode: true,
        };
      }
    }
    return {
      step: "type-select" as WorldCreateStep,
      worldName: "",
      displayName: "",
      description: "",
      worldType: "fictional-existing" as WorldType,
      tags: emptyWorldTagSet(),
      supplementMode: false,
    };
  })();

  const [step, setStep] = useState<WorldCreateStep>(initState.step);
  const [worldType, setWorldType] = useState<WorldType>(initState.worldType);
  const [worldName, setWorldName] = useState(initState.worldName);
  const [displayName, setDisplayName] = useState(initState.displayName);
  const [description, setDescription] = useState(initState.description);
  const [tags, setTags] = useState<WorldTagSet>(initState.tags);
  const [parsingTags, setParsingTags] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [supplementMode, setSupplementMode] = useState(
    initState.supplementMode,
  );

  // Cursor states
  const [typeCursor, setTypeCursor] = useState(0);
  const [conflictCursor, setConflictCursor] = useState(0);
  const [confirmCursor, setConfirmCursor] = useState(0);
  const [searchConfirmCursor, setSearchConfirmCursor] = useState(0);
  const [bindCursor, setBindCursor] = useState(0);

  // Data source state
  const [selectedSources, setSelectedSources] = useState<DataSourceOption[]>(
    [],
  );
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [sourcePaths, setSourcePaths] = useState<Map<DataSourceOption, string>>(
    new Map(),
  );

  // Agent state
  const [classification, setClassification] = useState<string | undefined>();
  const [origin, setOrigin] = useState<string | undefined>();
  const [capturedDimensions, setCapturedDimensions] = useState<
    any[] | undefined
  >();
  const [toolCalls, setToolCalls] = useState<ToolCallDisplay[]>([]);
  const [protocolPhase, setProtocolPhase] = useState<AgentPhase>("initiating");
  const currentPhaseRef = useRef<AgentPhase>("initiating");
  const [agentSessionDir, setAgentSessionDir] = useState<string | undefined>();
  const [agentElapsed, setAgentElapsed] = useState(0);
  const [searchPlan, setSearchPlan] = useState<SearchPlanDimDisplay[]>([]);
  const [chunkCount, setChunkCount] = useState(0);
  const [filterProgress, setFilterProgress] = useState<
    { kept: number; total: number } | undefined
  >();
  // Per-dimension chunk breakdown from agent extractions
  const [dimBreakdown, setDimBreakdown] = useState<Record<string, number>>({});

  // Distill state
  const [distillEntries, setDistillEntries] = useState<GeneratedEntry[]>([]);
  const [entries, setEntries] = useState<GeneratedEntry[]>([]);
  const [distillProgress, setDistillProgress] =
    useState<WorldDistillProgress | null>(null);

  const worldStrategy = new WorldCaptureStrategy();
  const classificationLabels = worldStrategy.getClassificationLabels();

  // --- Input handling ---
  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (step === "type-select") {
      if (key.upArrow)
        setTypeCursor(
          (c) => (c - 1 + TYPE_OPTIONS.length) % TYPE_OPTIONS.length,
        );
      if (key.downArrow) setTypeCursor((c) => (c + 1) % TYPE_OPTIONS.length);
      if (key.return) {
        setWorldType(TYPE_OPTIONS[typeCursor]!.value);
        setStep("name");
      }
      return;
    }

    if (step === "name-conflict") {
      if (key.upArrow || key.downArrow) setConflictCursor((c) => (c + 1) % 2);
      if (key.return) {
        if (conflictCursor === 0) {
          // Overwrite: delete existing and start fresh
          deleteWorld(worldName);
          setSupplementMode(false);
          setStep("display-name");
        } else {
          // Supplement: load existing world data, skip to data-sources
          const existing = loadWorld(worldName);
          if (existing) {
            setDisplayName(existing.display_name);
            setDescription(existing.description);
            setWorldType(existing.worldType);
            setTags(existing.tags);
            setSupplementMode(true);
            setStep("data-sources");
          } else {
            setErrorMsg(`Failed to load world "${worldName}"`);
            setStep("error");
          }
        }
      }
      return;
    }

    if (step === "confirm") {
      if (key.upArrow || key.downArrow) setConfirmCursor((c) => (c + 1) % 2);
      if (key.return) {
        if (confirmCursor === 0) setStep("data-sources");
        else setStep("type-select");
      }
      return;
    }

    if (step === "search-confirm") {
      const optionCount = classification === "UNKNOWN_SETTING" ? 2 : 2;
      if (key.upArrow || key.downArrow)
        setSearchConfirmCursor((c) => (c + 1) % optionCount);
      if (key.return) {
        if (classification === "UNKNOWN_SETTING") {
          if (searchConfirmCursor === 0) {
            setWorldName("");
            setStep("name");
          } else proceedAfterSearch();
        } else {
          if (searchConfirmCursor === 0) proceedAfterSearch();
          else {
            resetSearchState();
            setWorldName("");
            setStep("name");
          }
        }
      }
      return;
    }

    if (step === "bind-prompt") {
      if (key.upArrow || key.downArrow) setBindCursor((c) => (c + 1) % 2);
      if (key.return) {
        if (bindCursor === 0 && soulDir) bindWorld(soulDir, worldName);
        setStep("done");
        setTimeout(onComplete, 100);
      }
      return;
    }
  });

  function resetSearchState() {
    setClassification(undefined);
    setOrigin(undefined);
    setToolCalls([]);
    setSearchPlan([]);
    setAgentSessionDir(undefined);
    setDimBreakdown({});
    setChunkCount(0);
  }

  // After search confirm, proceed to collect other source paths or start distill
  function proceedAfterSearch() {
    const needsPath = selectedSources.filter((s) => s !== "web-search");
    if (needsPath.length > 0) {
      setCurrentSourceIndex(0);
      setStep("source-path");
    } else {
      startDistill();
    }
  }

  // --- Input handlers ---
  function handleName(value: string) {
    const name = value.trim();
    if (!name) return;
    setWorldName(name);
    if (worldExists(name)) setStep("name-conflict");
    else setStep("display-name");
  }

  function handleDisplayName(value: string) {
    setDisplayName(value.trim() || worldName);
    setStep("description");
  }

  function handleDescription(value: string) {
    setDescription(value.trim());
    setStep("tags");
  }

  async function handleTags(value: string) {
    if (!value.trim()) {
      setTags(emptyWorldTagSet());
      setStep("confirm");
      return;
    }
    setParsingTags(true);
    try {
      const client = getLLMClient();
      setTags(await parseWorldTags(value, client));
    } catch {
      setTags(emptyWorldTagSet());
    }
    setParsingTags(false);
    setStep("confirm");
  }

  function handleDataSourcesSubmit(sources: DataSourceOption[]) {
    if (sources.length === 0) {
      // No sources at all → create empty world
      doCreate([]);
      return;
    }
    setSelectedSources(sources);

    if (sources.includes("web-search")) {
      startCapture();
    } else {
      // No AI search, go straight to path collection or distill
      const needsPath = sources.filter((s) => s !== "web-search");
      if (needsPath.length > 0) {
        setCurrentSourceIndex(0);
        setStep("source-path");
      } else {
        startDistill();
      }
    }
  }

  function handleSourcePath(path: string) {
    if (!path.trim()) return;
    const nonWebSources = selectedSources.filter((s) => s !== "web-search");
    const current = nonWebSources[currentSourceIndex]!;
    const newPaths = new Map(sourcePaths);
    newPaths.set(current, path.trim());
    setSourcePaths(newPaths);

    if (currentSourceIndex < nonWebSources.length - 1) {
      setCurrentSourceIndex(currentSourceIndex + 1);
    } else {
      startDistill();
    }
  }

  // --- AI Search ---
  async function startCapture() {
    setStep("capturing");
    setProtocolPhase("initiating");
    currentPhaseRef.current = "initiating";
    setToolCalls([]);
    setClassification(undefined);
    setOrigin(undefined);
    setSearchPlan([]);

    try {
      const config = loadConfig();
      if (!config) {
        setErrorMsg("Config not loaded");
        setStep("error");
        return;
      }

      const result = await captureWorld(
        worldName,
        config,
        (progress: CaptureProgress) => {
          if (progress.type === "phase") {
            setProtocolPhase(progress.phase);
            currentPhaseRef.current = progress.phase;
          } else if (progress.type === "tool_call") {
            setToolCalls((prev) => [
              ...prev,
              {
                tool: progress.tool,
                query: progress.query,
                status: "running",
                phase: currentPhaseRef.current,
              },
            ]);
          } else if (progress.type === "tool_result") {
            setToolCalls((prev) => {
              const updated = [...prev];
              const last = updated.findLastIndex(
                (tc) => tc.tool === progress.tool && tc.status === "running",
              );
              if (last !== -1)
                updated[last] = {
                  ...updated[last]!,
                  status: "done",
                  resultCount: progress.resultCount,
                };
              return updated;
            });
          } else if (progress.type === "classification") {
            setClassification(progress.classification);
            setOrigin(progress.origin);
          } else if (progress.type === "search_plan") {
            setSearchPlan(progress.dimensions);
          } else if (progress.type === "filter_progress") {
            setFilterProgress({ kept: progress.kept, total: progress.total });
          } else if (progress.type === "chunks_extracted") {
            setChunkCount(progress.count);
          }
        },
        description || undefined,
      );

      setClassification(result.classification);
      setOrigin(result.origin);
      setAgentElapsed(result.elapsedMs);
      if (result.sessionDir) {
        setAgentSessionDir(result.sessionDir);
        logger.info(
          `[world-create] Capture complete. sessionDir=${result.sessionDir}, classification=${result.classification}`,
        );
        // Count total search results across all dimension caches
        try {
          const nodeFs = await import("node:fs");
          const nodePath = await import("node:path");
          const files = nodeFs
            .readdirSync(result.sessionDir)
            .filter((f: string) => f.endsWith(".json"));
          let total = 0;
          for (const f of files) {
            const data = JSON.parse(
              nodeFs.readFileSync(nodePath.join(result.sessionDir, f), "utf-8"),
            );
            total += data.results?.length ?? 0;
          }
          setChunkCount(total);
          logger.info(
            `[world-create] Dimension cache: ${files.length} dimensions, ${total} total results`,
          );
        } catch (err) {
          logger.error(
            `[world-create] Failed to count cache results:`,
            String(err),
          );
        }
      } else {
        logger.warn(`[world-create] Capture returned no sessionDir`);
      }
      if (result.dimensionPlan)
        setCapturedDimensions(result.dimensionPlan.dimensions);

      // Build dimension breakdown from quality scores
      if (result.dimensionScores) {
        const breakdown: Record<string, number> = {};
        for (const [dim, score] of Object.entries(result.dimensionScores)) {
          breakdown[dim] = score.qualifiedCount;
        }
        setDimBreakdown(breakdown);
      }

      if (result.classification === "UNKNOWN_SETTING") {
        setProtocolPhase("unknown");
        setTimeout(() => setStep("search-confirm"), 1500);
      } else {
        setStep("search-confirm");
      }
    } catch (err) {
      setErrorMsg(String(err));
      setStep("error");
    }
  }

  // --- Distill ---
  async function startDistill() {
    setStep("distilling");
    setDistillProgress(null);
    const config = loadConfig();
    if (!config) {
      setErrorMsg("Config not loaded");
      setStep("error");
      return;
    }

    const client = getLLMClient();
    const collectedEntries: GeneratedEntry[] = [];

    const agentLog = new AgentLogger(`World Distill: ${worldName}`, {
      model: "world-distill",
      provider: "openrouter",
    });
    try {
      const distiller = new WorldDistiller(client);
      distiller.on("progress", (p: WorldDistillProgress) =>
        setDistillProgress(p),
      );

      // Path A: web-search results — use distillFromCache (already organized by dimension)
      if (
        selectedSources.includes("web-search") &&
        agentSessionDir &&
        capturedDimensions
      ) {
        logger.info(
          `[world-create] Distilling from cache: sessionDir=${agentSessionDir}, dimensions=${capturedDimensions.length}`,
        );
        const plan: import("../../agent/planning/dimension-framework.js").DimensionPlan =
          {
            classification: classification ?? "",
            englishName: worldName,
            localName: worldName,
            origin: origin ?? "",
            dimensions: capturedDimensions as any,
          };
        const cacheEntries = await distiller.distillFromCache(
          worldName,
          agentSessionDir,
          plan,
          agentLog,
        );
        logger.info(
          `[world-create] distillFromCache produced ${cacheEntries.length} entries`,
        );
        collectedEntries.push(...cacheEntries);
      } else {
        logger.warn(
          `[world-create] Skipped distillFromCache: web-search=${selectedSources.includes("web-search")}, sessionDir=${!!agentSessionDir}, dimensions=${!!capturedDimensions}`,
        );
      }

      // Path B: markdown source — use existing distill (classify → cluster → extract)
      if (selectedSources.includes("markdown") && sourcePaths.has("markdown")) {
        const mdEntries = await distiller.distill(
          worldName,
          sourcePaths.get("markdown")!,
          "markdown",
          classification as WorldClassification | undefined,
          capturedDimensions,
          agentLog,
        );
        collectedEntries.push(...mdEntries);
      }

      // Path C: URL list — extract pages then distill as markdown
      if (selectedSources.includes("url-list") && sourcePaths.has("url-list")) {
        const urlsText = sourcePaths.get("url-list")!;
        const urls = urlsText
          .split(/[\n,]/)
          .map((u) => u.trim())
          .filter(Boolean);
        const nodeFs = await import("node:fs");
        const nodePath = await import("node:path");
        const os = await import("node:os");
        const tmpDir = nodeFs.mkdtempSync(
          nodePath.join(os.tmpdir(), "soulkiller-world-"),
        );
        let urlIdx = 0;
        for (const url of urls) {
          try {
            const content = await extractPageContent(url);
            if (content) {
              nodeFs.writeFileSync(
                nodePath.join(tmpDir, `url-${urlIdx++}.md`),
                content,
              );
            }
          } catch {
            /* skip */
          }
        }
        if (urlIdx > 0) {
          const urlEntries = await distiller.distill(
            worldName,
            tmpDir,
            "markdown",
            classification as WorldClassification | undefined,
            capturedDimensions,
            agentLog,
          );
          collectedEntries.push(...urlEntries);
        }
        nodeFs.rmSync(tmpDir, { recursive: true });
      }

      agentLog.close();
      if (collectedEntries.length === 0) {
        doCreate([]);
      } else {
        setDistillEntries(collectedEntries);
        setStep("review");
      }
    } catch (err) {
      agentLog.close();
      setErrorMsg(String(err));
      setStep("error");
    }
  }

  function handleReviewComplete(accepted: GeneratedEntry[]) {
    setEntries(accepted);
    doCreate(accepted);
  }

  async function doCreate(finalEntries: GeneratedEntry[]) {
    setStep("creating");
    try {
      let manifest;
      if (supplementMode) {
        // Supplement: add entries to existing world
        manifest = loadWorld(worldName);
        if (!manifest) {
          setErrorMsg(`World "${worldName}" not found`);
          setStep("error");
          return;
        }
      } else {
        // Create new world
        manifest = createWorld(
          worldName,
          displayName || worldName,
          description,
          worldType,
          tags,
        );
      }

      // Route through WorldDistiller.writeEntries so that chronicleType='timeline'
      // entries merge into history/timeline.md, 'events' entries go to
      // history/events/, and _index.md files are refreshed per dimension.
      // Using addEntry directly would bypass all of that and dump everything
      // flat at <dimension>/ top level.
      const client = await getLLMClient();
      const distiller = new WorldDistiller(client);
      await distiller.writeEntries(worldName, finalEntries);

      // Update manifest (writeEntries also updates entry_count, but we need
      // to set the other wizard-captured fields here).
      manifest = loadWorld(worldName) ?? manifest;
      const allEntries = loadAllEntries(worldName);
      manifest.entry_count = allEntries.length;
      if (classification)
        manifest.classification = classification as WorldClassification;
      if (origin) manifest.origin = origin;
      if (capturedDimensions) manifest.dimensions = capturedDimensions;
      saveWorld(manifest);

      if (soulDir) setStep("bind-prompt");
      else {
        setStep("done");
        setTimeout(onComplete, 100);
      }
    } catch (err) {
      setErrorMsg(String(err));
      setStep("error");
    }
  }

  // --- Render ---
  if (step === "error") {
    setTimeout(onCancel, 100);
    return <Text color="red">ERROR: {errorMsg}</Text>;
  }

  if (step === "done") {
    return (
      <Box flexDirection="column">
        <Text color={PRIMARY} bold>
          ✓{" "}
          {supplementMode
            ? t("wizard.done_supplement", { name: worldName })
            : t("wizard.done", { name: worldName })}
        </Text>
        <Text color={DIM}>
          {" "}
          {displayName} — {description}
        </Text>
        <Text color={DIM}>
          {" "}
          {t("wizard.done_entries", { count: String(entries.length) })}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color={ACCENT} bold>
        {t("wizard.title")}
      </Text>
      <Text color={DIM}> {t("wizard.esc_hint")}</Text>
      <Text> </Text>

      {step === "type-select" && (
        <Box flexDirection="column">
          <Text color={DIM}>{t("world.type.select")}</Text>
          {TYPE_OPTIONS.map((opt, i) => (
            <Text key={opt.value}>
              <Text color={i === typeCursor ? ACCENT : DIM}>
                {i === typeCursor ? "  ❯ " : "    "}
              </Text>
              <Text
                color={i === typeCursor ? PRIMARY : DIM}
                bold={i === typeCursor}
              >
                {t(opt.labelKey).padEnd(14)}
              </Text>
              <Text color={DIM}>{t(opt.descKey)}</Text>
            </Text>
          ))}
        </Box>
      )}

      {step === "name" && (
        <Box>
          <Text color={DIM}>{t("wizard.step.name")}: </Text>
          <TextInput onSubmit={handleName} />
        </Box>
      )}

      {step === "name-conflict" && (
        <Box flexDirection="column">
          <Text color={WARNING}>
            ⚠ {t("wizard.conflict.title", { name: worldName })}
          </Text>
          {[
            t("wizard.conflict.overwrite"),
            t("wizard.conflict.supplement"),
          ].map((label, i) => (
            <Text key={i}>
              <Text color={i === conflictCursor ? ACCENT : DIM}>
                {i === conflictCursor ? "  ❯ " : "    "}
              </Text>
              <Text color={i === conflictCursor ? PRIMARY : DIM}>{label}</Text>
            </Text>
          ))}
        </Box>
      )}

      {step === "display-name" && (
        <Box>
          <Text color={DIM}>
            {t("wizard.step.display_name", { name: worldName })}:{" "}
          </Text>
          <TextInput onSubmit={handleDisplayName} />
        </Box>
      )}

      {step === "description" && (
        <Box>
          <Text color={DIM}>{t("wizard.step.description")}: </Text>
          <TextInput onSubmit={handleDescription} />
        </Box>
      )}

      {step === "tags" && (
        <Box flexDirection="column">
          {parsingTags ? (
            <Text color={ACCENT}>{t("world.tags.parsing")}</Text>
          ) : (
            <>
              <Text color={DIM}>{t("world.tags.prompt")}</Text>
              <Text color={DIM}> {t("world.tags.skip_hint")}</Text>
              <Box>
                <Text color={ACCENT}>❯ </Text>
                <TextInput onSubmit={handleTags} />
              </Box>
            </>
          )}
        </Box>
      )}

      {step === "confirm" && (
        <Box flexDirection="column">
          <Text color={ACCENT} bold>
            {t("wizard.confirm.title")}
          </Text>
          <Text color={DIM}>
            {" "}
            {t("world.confirm.worldType")}:{" "}
            <Text color={PRIMARY}>
              {t(`world.type.${worldType.replace(/-/g, "_")}` as any)}
            </Text>
          </Text>
          <Text color={DIM}>
            {" "}
            {t("wizard.confirm.name")}: <Text color={PRIMARY}>{worldName}</Text>
          </Text>
          <Text color={DIM}>
            {" "}
            {t("wizard.confirm.display_name")}:{" "}
            <Text color={PRIMARY}>{displayName || worldName}</Text>
          </Text>
          <Text color={DIM}>
            {" "}
            {t("wizard.confirm.description")}:{" "}
            <Text color={PRIMARY}>{description || "—"}</Text>
          </Text>
          {hasAnyTag(tags) && (
            <Text color={DIM}>
              {" "}
              {t("world.confirm.tags")}:{" "}
              <Text color={PRIMARY}>{formatTags(tags)}</Text>
            </Text>
          )}
          <Text> </Text>
          {[t("wizard.confirm.confirm"), t("wizard.confirm.modify")].map(
            (label, i) => (
              <Text key={i}>
                <Text color={i === confirmCursor ? ACCENT : DIM}>
                  {i === confirmCursor ? "  ❯ " : "    "}
                </Text>
                <Text color={i === confirmCursor ? PRIMARY : DIM}>{label}</Text>
              </Text>
            ),
          )}
        </Box>
      )}

      {/* Data sources — BEFORE AI search */}
      {step === "data-sources" && (
        <Box flexDirection="column">
          <Text color={DIM}>{t("world.datasource.title")}</Text>
          <CheckboxSelect
            items={[
              ...(worldType !== "fictional-original"
                ? [
                    {
                      value: "web-search" as DataSourceOption,
                      label: t("world.datasource.web_search"),
                      checked: true,
                    },
                  ]
                : []),
              {
                value: "markdown" as DataSourceOption,
                label: t("world.datasource.markdown"),
              },
              {
                value: "url-list" as DataSourceOption,
                label: t("world.datasource.url_list"),
              },
            ]}
            onSubmit={handleDataSourcesSubmit}
            onEscape={onCancel}
          />
        </Box>
      )}

      {/* AI search */}
      {step === "capturing" && (
        <SoulkillerProtocolPanel
          mode="world"
          targetName={worldName}
          classification={classification}
          classificationLabels={classificationLabels}
          origin={origin}
          toolCalls={toolCalls}
          totalFragments={chunkCount}
          elapsedTime={agentElapsed}
          filterProgress={filterProgress}
          phase={protocolPhase}
          searchPlan={searchPlan}
        />
      )}

      {/* Search confirm — with dimension breakdown */}
      {step === "search-confirm" && (
        <Box flexDirection="column">
          <Text color={ACCENT} bold>
            ── {t("protocol.target_acquired")} ──
          </Text>
          <Text> </Text>
          <Text>
            {" "}
            <Text color={PRIMARY}>{t("protocol.classification")}:</Text>{" "}
            {classification
              ? (classificationLabels[classification] ?? classification)
              : "—"}
          </Text>
          {origin && (
            <Text>
              {" "}
              <Text color={PRIMARY}>{t("protocol.origin")}:</Text> {origin}
            </Text>
          )}
          <Text>
            {" "}
            <Text color={PRIMARY}>{t("protocol.dimensions")}:</Text>{" "}
            {chunkCount} qualified articles
          </Text>

          {/* Dimension quality breakdown */}
          {Object.keys(dimBreakdown).length > 0 && (
            <>
              <Text> </Text>
              {Object.entries(dimBreakdown).map(([dim, qualified]) => {
                const dimDef = capturedDimensions?.find(
                  (d: any) => d.name === dim,
                );
                const minRequired = dimDef?.minArticles ?? 2;
                const sufficient = qualified >= minRequired;
                const bar = "█".repeat(Math.min(qualified, 10));
                const pLabel =
                  dimDef?.priority === "required"
                    ? t("protocol.priority.required")
                    : dimDef?.priority === "important"
                      ? t("protocol.priority.important")
                      : t("protocol.priority.supplementary");
                return (
                  <Text key={dim} color={DIM}>
                    {"    "}
                    {dim.padEnd(20)}{" "}
                    <Text color={sufficient ? PRIMARY : WARNING}>{bar}</Text>{" "}
                    {qualified}/{minRequired}{" "}
                    <Text color={DARK}>({pLabel})</Text>
                  </Text>
                );
              })}
            </>
          )}

          <Text> </Text>
          {classification === "UNKNOWN_SETTING"
            ? [t("world.search.retry"), t("world.search.manual_source")].map(
                (label, i) => (
                  <Text key={i}>
                    <Text color={i === searchConfirmCursor ? ACCENT : DIM}>
                      {i === searchConfirmCursor ? "  ❯ " : "    "}
                    </Text>
                    <Text color={i === searchConfirmCursor ? PRIMARY : DIM}>
                      {label}
                    </Text>
                  </Text>
                ),
              )
            : [t("wizard.confirm.confirm"), t("world.search.retry")].map(
                (label, i) => (
                  <Text key={i}>
                    <Text color={i === searchConfirmCursor ? ACCENT : DIM}>
                      {i === searchConfirmCursor ? "  ❯ " : "    "}
                    </Text>
                    <Text color={i === searchConfirmCursor ? PRIMARY : DIM}>
                      {label}
                    </Text>
                  </Text>
                ),
              )}
        </Box>
      )}

      {/* Source path collection */}
      {step === "source-path" &&
        (() => {
          const nonWebSources = selectedSources.filter(
            (s) => s !== "web-search",
          );
          const current = nonWebSources[currentSourceIndex];
          const label =
            current === "markdown" ? "Markdown path" : "URLs (comma separated)";
          return (
            <Box>
              <Text color={DIM}>{label}: </Text>
              <TextInput
                pathCompletion={current === "markdown"}
                onSubmit={handleSourcePath}
              />
            </Box>
          );
        })()}

      {/* Distilling — with visual panel */}
      {step === "distilling" && (
        <WorldDistillPanel progress={distillProgress} worldName={worldName} />
      )}

      {step === "review" && (
        <WorldDistillReview
          entries={distillEntries}
          onComplete={handleReviewComplete}
        />
      )}

      {step === "creating" && <Text color={DIM}>{t("wizard.creating")}</Text>}

      {step === "bind-prompt" && (
        <Box flexDirection="column">
          <Text color={PRIMARY} bold>
            ✓ {t("wizard.done", { name: worldName })}
          </Text>
          <Text> </Text>
          <Text color={DIM}>{t("world.bind.prompt")}</Text>
          {[t("world.bind.yes"), t("world.bind.no")].map((label, i) => (
            <Text key={i}>
              <Text color={i === bindCursor ? ACCENT : DIM}>
                {i === bindCursor ? "  ❯ " : "    "}
              </Text>
              <Text color={i === bindCursor ? PRIMARY : DIM}>{label}</Text>
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

function hasAnyTag(tags: WorldTagSet): boolean {
  return Object.values(tags).some((arr) => arr.length > 0);
}

function formatTags(tags: WorldTagSet): string {
  return Object.entries(tags)
    .filter(([, arr]) => arr.length > 0)
    .map(([, arr]) => arr.join(", "))
    .join(" | ");
}
