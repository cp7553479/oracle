import type { SessionLifecycleMetadata, SessionMetadata } from "../sessionManager.js";
import type { EngineMode } from "./engine.js";

export interface BuildSessionLifecycleOptions {
  engine: EngineMode;
  detached: boolean;
  workerPid?: number;
  reattachCommand: string;
}

export function buildSessionLifecycle({
  engine,
  detached,
  workerPid,
  reattachCommand,
}: BuildSessionLifecycleOptions): SessionLifecycleMetadata {
  return {
    engine,
    execution: detached ? "background" : "foreground",
    attached: !detached,
    detached,
    workerPid,
    reattachCommand,
  };
}

export function formatSessionLifecycleBlock(meta: SessionMetadata): string[] {
  const lifecycle = meta.lifecycle;
  if (!lifecycle) {
    return [];
  }
  const detachValue = lifecycle.detached
    ? lifecycle.execution === "background"
      ? "yes, polling"
      : "yes"
    : "no";
  const lines = [
    `Session: ${meta.id}`,
    `Mode: ${lifecycle.engine} ${lifecycle.execution}`,
    `Detach: ${detachValue}`,
    `Reattach: ${lifecycle.reattachCommand}`,
  ];
  return lines;
}

export function formatSessionExecutionLabel(meta: SessionMetadata): string {
  const lifecycle = meta.lifecycle;
  if (!lifecycle) {
    return meta.mode ?? meta.options?.mode ?? "api";
  }
  const engine = lifecycle.engine === "browser" ? "br" : lifecycle.engine;
  const execution = lifecycle.execution === "background" ? "bg" : "fg";
  return `${engine}/${execution}`;
}
