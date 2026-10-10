import { useCallback, useEffect, useRef, useState } from "react";

import { Banner } from "@components/fileHarbourComponent/shared/Banner";
import { Button } from "@components/fileHarbourComponent/shared/Button";
import { FormBody } from "@components/fileHarbourComponent/shared/FormBody";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { TitleBlock } from "@components/fileHarbourComponent/shared/TitleBlock";
import { getDirSummaries } from "@/index/db";
import { syncIndex } from "@/index/sync";
import type { DirSummary, ServiceError, SyncReport } from "@/types/domain";

// Temporary sync report (TaskList 5.7). It scans Saved Messages on the device and shows each
// folder path with its file count and each caption that did not parse. Task 6.5 replaces it
// with frames 04 (list) and 05 (empty).

type State =
  | { kind: "loading"; loaded: number }
  | { kind: "done"; report: SyncReport; dirs: DirSummary[] }
  | { kind: "error"; error: ServiceError };

function errorText(error: ServiceError): string {
  if (error.kind === "rate_limited") {
    return `Telegram is rate-limiting. Try again in ${error.retryAfter ?? 0} s.`;
  }
  return `The sync did not complete: ${error.code}`;
}

export default function FoldersScreen() {
  const [state, setState] = useState<State>({ kind: "loading", loaded: 0 });
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const report = await syncIndex((loaded) => {
      if (mounted.current) setState({ kind: "loading", loaded });
    });
    const dirs = report.ok ? await getDirSummaries() : null;
    if (!mounted.current) return;
    if (!report.ok) {
      setState({ kind: "error", error: report.error });
    } else if (dirs && !dirs.ok) {
      setState({ kind: "error", error: { kind: "failed", code: dirs.message } });
    } else if (dirs?.ok) {
      setState({ kind: "done", report: report.value, dirs: dirs.value });
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const syncAgain = (): void => {
    setState({ kind: "loading", loaded: 0 });
    void load();
  };

  const loading = state.kind === "loading";
  const r = state.kind === "done" ? state.report : null;

  return (
    <Screen>
      <FormBody>
        <TitleBlock
          title={loading ? "Reading Saved Messages" : "Sync report"}
          body={
            loading
              ? `${state.loaded} messages read`
              : r
                ? `${r.scanned} messages · ${r.indexed} files · ${r.other} other · ${r.skipped.length} skipped`
                : undefined
          }
        />
        {state.kind === "error" ? (
          <Banner
            text={errorText(state.error)}
            icon={state.error.kind === "rate_limited" ? "timer" : "triangle-alert"}
            tone={state.error.kind === "rate_limited" ? "warn" : "danger"}
          />
        ) : null}
        {state.kind === "done" && state.dirs.length === 0 ? (
          <Banner text="No file has a FileHarbor caption." icon="folder" />
        ) : null}
        {state.kind === "done"
          ? state.dirs.map((d) => (
              <Banner
                key={d.dirPath}
                text={`/${d.dirPath} · ${d.fileCount} ${d.fileCount === 1 ? "file" : "files"}`}
                icon="folder"
              />
            ))
          : null}
        {r?.skipped.map((s) => (
          <Banner
            key={s.messageId}
            text={`Message ${s.messageId} · ${s.reason === "bad_caption" ? "caption does not parse" : "not a document"}: ${JSON.stringify(s.caption)}`}
            icon="triangle-alert"
            tone="warn"
          />
        ))}
        <Button
          label="Sync again"
          variant="secondary"
          onPress={syncAgain}
          loading={loading}
          fullWidth
        />
      </FormBody>
    </Screen>
  );
}
